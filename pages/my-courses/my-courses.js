const request = require('../../utils/request')
const { decorateCourse } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    list: [],
    loading: true,
    error: '',
    stats: { total: 0, upcoming: 0, ended: 0 }
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
    }
  },

  onShow() {
    if (!isLoggedIn()) return
    this.fetchMine()
  },

  onPullDownRefresh() {
    this.fetchMine(true)
  },

  fetchMine(fromPullDown = false) {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/courses/mine')
      .then(data => {
        const list = (data.list || []).map(decorateCourse)
        this.setData({
          list,
          loading: false,
          stats: {
            total: list.length,
            upcoming: list.filter(item => item.status !== 2).length,
            ended: list.filter(item => item.status === 2).length
          }
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '加载失败' })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${id}` })
  },

  onCancel(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) return

    const that = this
    wx.showModal({
      title: '取消报名',
      content: '取消后名额将释放给其他同学，确定取消吗？',
      success(res) {
        if (!res.confirm) return

        request
          .del(`/api/courses/${id}/enroll`)
          .then(() => {
            wx.showToast({ title: '已取消报名', icon: 'none' })
            that.fetchMine()
          })
          .catch(err => {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
          })
      }
    })
  },

  onBrowse() {
    wx.navigateTo({ url: '/pages/courses/courses' })
  },

  onRetry() {
    this.fetchMine()
  }
})
