const request = require('../../utils/request')
const { formatFans } = require('../../utils/format')
const { isLoggedIn, getUser } = require('../../utils/auth')

Page({
  data: {
    isAdmin: false,
    loading: true,
    error: '',
    stats: null,
    trend: [],
    topTeachers: []
  },

  onLoad() {
    const user = isLoggedIn() ? getUser() : null

    if (!user || user.role !== 'admin') {
      this.setData({ isAdmin: false, loading: false })
      return
    }

    this.setData({ isAdmin: true })
    this.fetchStats()
  },

  onShow() {
    if (this.data.isAdmin && this.data.stats) {
      this.fetchStats()
    }
  },

  onPullDownRefresh() {
    this.fetchStats(true)
  },

  fetchStats(fromPullDown = false) {
    this.setData({ loading: !this.data.stats, error: '' })

    request
      .get('/api/admin/stats')
      .then(data => {
        const counts = (data.trend || []).map(item => Number(item.count) || 0)
        const max = Math.max(1, ...counts)

        const trend = (data.trend || []).map((item, index) => ({
          date: item.date,
          label: item.date.slice(5),
          count: Number(item.count) || 0,
          height: Math.max(6, Math.round(((Number(item.count) || 0) / max) * 100)),
          isToday: index === data.trend.length - 1
        }))

        this.setData({
          stats: data,
          trend,
          topTeachers: (data.topTeachers || []).map((item, index) => ({
            ...item,
            rank: index + 1,
            fansText: formatFans(item.fans)
          })),
          loading: false
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '看板加载失败' })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onBookings() {
    wx.navigateTo({ url: '/pages/admin-bookings/admin-bookings' })
  },

  onTeachers() {
    wx.navigateTo({ url: '/pages/admin-teachers/admin-teachers' })
  },

  onCourses() {
    wx.navigateTo({ url: '/pages/courses/courses' })
  },

  onRetry() {
    this.fetchStats()
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
