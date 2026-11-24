const request = require('../../utils/request')
const { decorateTeacher } = require('../../utils/format')

const STAGES = ['早教', '小学', '初中', '高中', '其他']

Page({
  data: {
    teachers: [],
    teacherNames: [],
    teacherIndex: 0,
    selectedTeacherName: '',
    stages: STAGES,
    stageIndex: 1,
    form: {
      name: '',
      phone: '',
      remark: ''
    },
    errors: {},
    submitting: false,
    success: false,
    bookedTeacher: '',
    loadingTeachers: true,
    teacherLoadError: ''
  },

  onLoad(query) {
    this.wantId = Number(query.teacherId) || 0
    this.wantName = query.teacherName ? decodeURIComponent(query.teacherName) : ''

    const profile = wx.getStorageSync('profile') || {}
    this.setData({
      'form.name': profile.name || '',
      'form.phone': profile.phone || ''
    })

    this.fetchTeachers()
  },

  fetchTeachers() {
    this.setData({ loadingTeachers: true, teacherLoadError: '' })

    request
      .get('/api/teachers', { page: 1, pageSize: 50 })
      .then(data => {
        const teachers = (data.list || []).map(decorateTeacher)
        let index = teachers.length ? 0 : -1

        if (this.wantId) {
          const found = teachers.findIndex(item => item.id === this.wantId)
          if (found >= 0) index = found
        } else if (this.wantName) {
          const found = teachers.findIndex(item => item.name === this.wantName)
          if (found >= 0) index = found
        }

        this.setData({
          teachers,
          teacherNames: teachers.map(item => item.name),
          teacherIndex: index,
          selectedTeacherName: index >= 0 ? teachers[index].name : '',
          loadingTeachers: false
        })
      })
      .catch(err => {
        this.setData({
          loadingTeachers: false,
          teacherLoadError: err.message || '名师列表加载失败'
        })
      })
  },

  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value,
      'errors.name': ''
    })
  },

  onPhoneInput(e) {
    this.setData({
      'form.phone': e.detail.value,
      'errors.phone': ''
    })
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value })
  },

  onStageChange(e) {
    this.setData({ stageIndex: Number(e.detail.value) })
  },

  onTeacherChange(e) {
    const index = Number(e.detail.value)
    const teacher = this.data.teachers[index]

    this.setData({
      teacherIndex: index,
      selectedTeacherName: teacher ? teacher.name : '',
      'errors.teacher': ''
    })
  },

  validate() {
    const { form, teacherIndex } = this.data
    const errors = {}

    if (form.name.trim().length < 2 || form.name.trim().length > 20) {
      errors.name = '请输入 2-20 个字符的姓名'
    }
    if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
      errors.phone = '请输入正确的 11 位手机号'
    }
    if (teacherIndex < 0) {
      errors.teacher = '请选择意向名师'
    }

    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  onSubmit() {
    if (this.data.submitting || this.data.success) return
    if (!this.validate()) return

    const teacher = this.data.teachers[this.data.teacherIndex]
    if (!teacher) {
      this.setData({ errors: { teacher: '请选择意向名师' } })
      return
    }

    const payload = {
      name: this.data.form.name.trim(),
      phone: this.data.form.phone.trim(),
      stage: STAGES[this.data.stageIndex],
      remark: this.data.form.remark.trim(),
      teacherId: teacher.id
    }

    this.setData({ submitting: true })

    request
      .post('/api/bookings', payload)
      .then(() => {
        wx.setStorageSync('profile', {
          ...(wx.getStorageSync('profile') || {}),
          name: payload.name,
          phone: payload.phone
        })
        this.setData({
          submitting: false,
          success: true,
          bookedTeacher: teacher.name
        })
      })
      .catch(err => {
        const fieldErrors = err.errors ? { ...err.errors } : {}
        if (fieldErrors.teacherId) {
          fieldErrors.teacher = fieldErrors.teacherId
          delete fieldErrors.teacherId
        }

        this.setData({
          submitting: false,
          errors: fieldErrors
        })
        wx.showToast({ title: err.message || '提交失败', icon: 'none' })
      })
  },

  onViewBookings() {
    wx.switchTab({ url: '/pages/my/my' })
  },

  onBookAnother() {
    this.setData({
      success: false,
      bookedTeacher: '',
      'form.remark': ''
    })
  }
})
