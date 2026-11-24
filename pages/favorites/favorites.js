const request = require('../../utils/request')
const { isLoggedIn } = require('../../utils/auth')
const { decorateTeacher } = require('../../utils/format')

const MAX_COMPARE = 3

Page({
  data: {
    loggedIn: false,
    list: [],
    selectedCount: 0,
    maxCompare: MAX_COMPARE,
    loading: true,
    error: ''
  },

  onShow() {
    const loggedIn = isLoggedIn()
    this.setData({ loggedIn })

    if (!loggedIn) {
      this.setData({ loading: false })
      return
    }

    this.fetchFavorites()
  },

  fetchFavorites() {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/favorites')
      .then(data => {
        const list = (data.list || []).map(item => ({
          ...decorateTeacher(item),
          selected: false
        }))

        this.setData({ list, loading: false, selectedCount: 0 })
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '收藏加载失败' })
      })
  },

  onToggleSelect(e) {
    const id = Number(e.currentTarget.dataset.id)
    const list = this.data.list
    const target = list.find(item => item.id === id)
    if (!target) return

    if (!target.selected && this.data.selectedCount >= MAX_COMPARE) {
      wx.showToast({ title: `最多对比 ${MAX_COMPARE} 位老师`, icon: 'none' })
      return
    }

    target.selected = !target.selected
    this.setData({
      list,
      selectedCount: list.filter(item => item.selected).length
    })
  },

  onRemove(e) {
    const id = Number(e.currentTarget.dataset.id)
    const that = this

    wx.showModal({
      title: '取消收藏',
      content: '确定要移除这位老师吗？',
      success(res) {
        if (!res.confirm) return

        request
          .request({ url: `/api/favorites/${id}`, method: 'DELETE' })
          .then(() => {
            const list = that.data.list.filter(item => item.id !== id)
            that.setData({
              list,
              selectedCount: list.filter(item => item.selected).length
            })
            wx.showToast({ title: '已移除', icon: 'success' })
          })
          .catch(err => {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' })
          })
      }
    })
  },

  onCompare() {
    const selected = this.data.list.filter(item => item.selected)

    if (selected.length < 2) {
      wx.showToast({ title: '至少选择 2 位老师', icon: 'none' })
      return
    }

    wx.navigateTo({
      url: `/pages/compare/compare?ids=${selected.map(item => item.id).join(',')}`
    })
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onRetry() {
    this.fetchFavorites()
  }
})
