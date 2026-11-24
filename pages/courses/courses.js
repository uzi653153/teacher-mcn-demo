const request = require('../../utils/request')
const { decorateCourse } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'live', label: '直播中' },
  { key: 'upcoming', label: '预告' },
  { key: 'ended', label: '已结束' }
]

Page({
  data: {
    tabs: TABS,
    activeKey: 'all',
    summary: { live: 0, upcoming: 0, ended: 0 },
    list: [],
    loading: true,
    error: '',
    pendingId: 0
  },

  onLoad() {
    this.fetchCourses()
  },

  onPullDownRefresh() {
    this.fetchCourses(true)
  },

  fetchCourses(fromPullDown = false) {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/courses', { status: this.data.activeKey })
      .then(data => {
        this.setData({
          list: (data.list || []).map(decorateCourse),
          summary: data.summary || { live: 0, upcoming: 0, ended: 0 },
          loading: false
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '课程加载失败' })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.activeKey) return
    this.setData({ activeKey: key })
    this.fetchCourses()
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${id}` })
  },

  onEnroll(e) {
    const id = Number(e.currentTarget.dataset.id)
    const target = this.data.list.find(item => item.id === id)
    if (!target || !target.canEnroll) {
      if (target && target.enrolledByMe) this.onDetail(e)
      return
    }

    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    if (this.data.pendingId) return
    this.setData({ pendingId: id })

    const done = () => this.setData({ pendingId: 0 })

    request
      .post(`/api/courses/${id}/enroll`)
      .then(data => {
        wx.showToast({ title: data.already ? '已报名' : '报名成功', icon: 'success' })
        this.fetchCourses()
        done()
      })
      .catch(err => {
        wx.showToast({ title: err.message || '报名失败', icon: 'none' })
        done()
      })
  },

  onMine() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/my-courses/my-courses' })
  },

  onRetry() {
    this.fetchCourses()
  },

  onShareAppMessage() {
    return { title: '有因有果 · 名师直播公开课', path: '/pages/courses/courses' }
  }
})
