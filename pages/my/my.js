const request = require('../../utils/request')
const config = require('../../utils/config')
const { formatDate } = require('../../utils/format')
const { isLoggedIn, getUser, clearAuth } = require('../../utils/auth')

const STATUS_MAP = {
  0: { text: '待联系', className: 'status--pending' },
  1: { text: '已联系', className: 'status--done' },
  2: { text: '已取消', className: 'status--cancel' }
}

Page({
  data: {
    nickname: '',
    initial: '我',
    profileSub: '登录后同步收藏与预约',
    loggedIn: false,
    user: null,
    isAdmin: false,
    favCount: 0,
    bookings: [],
    loading: true,
    error: '',
    unread: 0,
    stats: { total: 0, pending: 0 }
  },

  onShow() {
    this.loadProfile()
    this.fetchBookings()
    this.fetchFavCount()
    this.fetchUnread()
  },

  fetchUnread() {
    if (!isLoggedIn()) {
      this.setData({ unread: 0 })
      return
    }

    request
      .get('/api/notifications/unread-count')
      .then(data => {
        this.setData({ unread: Number(data.count) || 0 })
      })
      .catch(() => {})
  },

  loadProfile() {
    const user = isLoggedIn() ? getUser() : null
    const profile = wx.getStorageSync('profile') || {}
    const nickname = user
      ? user.nickname || user.username
      : profile.nickname || profile.name || config.defaultNickname

    this.setData({
      nickname,
      initial: nickname.slice(0, 1),
      profileSub: user
        ? `@${user.username} · ${user.role === 'admin' ? '管理员' : '学员'}`
        : '登录后同步收藏与预约',
      loggedIn: !!user,
      user,
      isAdmin: !!user && user.role === 'admin'
    })
  },

  fetchFavCount() {
    if (!isLoggedIn()) {
      this.setData({ favCount: 0 })
      return
    }

    request
      .get('/api/favorites/ids')
      .then(data => {
        this.setData({ favCount: (data.ids || []).length })
      })
      .catch(() => {})
  },

  fetchBookings(fromPullDown = false) {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/bookings')
      .then(data => {
        const list = (data.list || []).map(item => {
          const status = STATUS_MAP[item.status] || STATUS_MAP[0]

          return {
            ...item,
            teacherInitial: (item.teacherName || '').slice(0, 1),
            timeText: formatDate(item.createdAt),
            statusText: status.text,
            statusClass: status.className,
            canCancel: item.status === 0
          }
        })

        this.setData({
          bookings: list,
          loading: false,
          stats: {
            total: list.length,
            pending: list.filter(item => item.status === 0).length
          }
        })

        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({
          loading: false,
          error: err.message || '加载失败'
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onPullDownRefresh() {
    this.fetchBookings(true)
  },

  onEditNickname() {
    const that = this

    wx.showModal({
      title: '设置昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: this.data.nickname,
      success(res) {
        if (!res.confirm) return

        const value = String(res.content || '').trim().slice(0, 12)
        if (!value) return

        const profile = wx.getStorageSync('profile') || {}
        wx.setStorageSync('profile', { ...profile, nickname: value })
        that.loadProfile()
      }
    })
  },

  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onLogout() {
    const that = this

    wx.showModal({
      title: '退出登录',
      content: '退出后收藏和预约将不再显示在当前账号',
      success(res) {
        if (!res.confirm) return

        clearAuth()
        getApp().globalData.user = null
        that.loadProfile()
        that.fetchFavCount()
        that.fetchBookings()
        wx.showToast({ title: '已退出', icon: 'none' })
      }
    })
  },

  onFavorites() {
    if (!this.data.loggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  onMessages() {
    if (!this.data.loggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/messages/messages' })
  },

  onMyCourses() {
    if (!this.data.loggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/my-courses/my-courses' })
  },

  onDashboard() {
    wx.navigateTo({ url: '/pages/admin-dashboard/admin-dashboard' })
  },

  onTeacherManage() {
    wx.navigateTo({ url: '/pages/admin-teachers/admin-teachers' })
  },

  onAdmin() {
    wx.navigateTo({ url: '/pages/admin-bookings/admin-bookings' })
  },

  onBook() {
    wx.navigateTo({ url: '/pages/booking/booking' })
  },

  onAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  onCancel(e) {
    const id = e.currentTarget.dataset.id
    const that = this

    wx.showModal({
      title: '取消预约',
      content: '确定要取消这条预约吗？',
      success(res) {
        if (!res.confirm) return

        request
          .patch(`/api/bookings/${id}/cancel`)
          .then(() => {
            wx.showToast({ title: '已取消', icon: 'success' })
            that.fetchBookings()
          })
          .catch(err => {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
          })
      }
    })
  },

  onRetry() {
    this.fetchBookings()
  }
})
