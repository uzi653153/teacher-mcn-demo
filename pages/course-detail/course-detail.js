const request = require('../../utils/request')
const { decorateCourse } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    id: 0,
    course: null,
    loading: true,
    error: '',
    submitting: false
  },

  onLoad(options) {
    const id = Number(options.id) || 0
    this.setData({ id })
    this.fetchCourse()
  },

  onShow() {
    // 从登录页返回时刷新报名状态
    if (this.data.course) this.fetchCourse()
  },

  onPullDownRefresh() {
    this.fetchCourse(true)
  },

  fetchCourse(fromPullDown = false) {
    if (!this.data.id) return

    this.setData({ loading: true, error: '' })

    request
      .get(`/api/courses/${this.data.id}`)
      .then(course => {
        this.setData({ course: decorateCourse(course), loading: false })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '课程加载失败' })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onAction() {
    if (!this.data.course) return
    if (this.data.course.enrolledByMe) {
      this.onCancelEnroll()
      return
    }
    this.onEnroll()
  },

  onEnroll() {
    const course = this.data.course
    if (!course || !course.canEnroll || this.data.submitting) return

    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }

    this.setData({ submitting: true })

    request
      .post(`/api/courses/${course.id}/enroll`)
      .then(data => {
        wx.showToast({ title: data.already ? '已报名' : '报名成功', icon: 'success' })
        this.setData({ submitting: false })
        this.fetchCourse()
      })
      .catch(err => {
        wx.showToast({ title: err.message || '报名失败', icon: 'none' })
        this.setData({ submitting: false })
      })
  },

  onCancelEnroll() {
    const course = this.data.course
    if (!course || !course.enrolledByMe || this.data.submitting) return

    const that = this
    wx.showModal({
      title: '取消报名',
      content: '取消后名额将释放给其他同学，确定取消吗？',
      success(res) {
        if (!res.confirm) return

        that.setData({ submitting: true })
        request
          .del(`/api/courses/${course.id}/enroll`)
          .then(() => {
            wx.showToast({ title: '已取消报名', icon: 'none' })
            that.setData({ submitting: false })
            that.fetchCourse()
          })
          .catch(err => {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
            that.setData({ submitting: false })
          })
      }
    })
  },

  onTeacher() {
    const course = this.data.course
    if (!course) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${course.teacherId}` })
  },

  onAllCourses() {
    wx.navigateTo({ url: '/pages/courses/courses' })
  },

  onRetry() {
    this.fetchCourse()
  },

  onShareAppMessage() {
    const course = this.data.course
    return {
      title: course ? `${course.title} · 有因有果直播课` : '有因有果 · 直播公开课',
      path: `/pages/course-detail/course-detail?id=${this.data.id}`
    }
  }
})
