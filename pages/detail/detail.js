const request = require('../../utils/request')
const { decorateTeacher } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    teacher: null,
    loading: true,
    error: '',
    favorited: false,
    favoriteLoading: false
  },

  onLoad(query) {
    this.teacherId = query.id
    this.fetchDetail()
  },

  onShow() {
    if (this.data.teacher) {
      this.fetchFavoriteState()
    }
  },

  fetchDetail() {
    const id = Number(this.teacherId)

    if (!id) {
      this.setData({ loading: false, error: '缺少名师信息' })
      return
    }

    this.setData({ loading: true, error: '' })

    request
      .get(`/api/teachers/${id}`)
      .then(data => {
        const teacher = decorateTeacher(data)
        this.setData({ teacher, loading: false })
        wx.setNavigationBarTitle({ title: teacher.name })
        this.fetchFavoriteState()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '加载失败' })
      })
  },

  onRetry() {
    this.fetchDetail()
  },

  fetchFavoriteState() {
    if (!isLoggedIn()) {
      if (this.data.favorited) this.setData({ favorited: false })
      return
    }

    request
      .get('/api/favorites/ids')
      .then(data => {
        const ids = data.ids || []
        this.setData({ favorited: ids.includes(Number(this.teacherId)) })
      })
      .catch(() => {})
  },

  onToggleFavorite() {
    if (this.data.favoriteLoading) return

    if (!isLoggedIn()) {
      wx.showModal({
        title: '收藏名师',
        content: '登录后即可收藏，收藏会跟随账号同步',
        confirmText: '去登录',
        success(res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }

    const next = !this.data.favorited
    const id = Number(this.teacherId)

    this.setData({ favoriteLoading: true })

    request
      .request({
        url: `/api/favorites/${id}`,
        method: next ? 'POST' : 'DELETE'
      })
      .then(() => {
        this.setData({ favorited: next, favoriteLoading: false })
        wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' })
      })
      .catch(err => {
        this.setData({ favoriteLoading: false })
        if (err.statusCode === 401) {
          wx.navigateTo({ url: '/pages/login/login' })
          return
        }
        wx.showToast({ title: err.message || '操作失败', icon: 'none' })
      })
  },

  onBook() {
    const teacher = this.data.teacher
    if (!teacher) return

    wx.navigateTo({
      url: `/pages/booking/booking?teacherId=${teacher.id}&teacherName=${encodeURIComponent(
        teacher.name
      )}`
    })
  },

  onShareAppMessage() {
    const teacher = this.data.teacher || {}

    return {
      title: `${teacher.name || '名师'} · 有因有果名师推荐`,
      path: `/pages/detail/detail?id=${this.teacherId}`
    }
  }
})
