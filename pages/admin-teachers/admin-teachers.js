const request = require('../../utils/request')
const { formatFans, assetUrl } = require('../../utils/format')
const { isLoggedIn, getUser } = require('../../utils/auth')

const STAGES = ['早教', '小学', '初中', '高中', '其他']

function emptyForm() {
  return {
    id: 0,
    name: '',
    title: '',
    stageIndex: 1,
    subject: '',
    tagsText: '',
    fans: '',
    years: '',
    intro: '',
    avatar: '',
    avatarUrl: '',
    status: 1
  }
}

Page({
  data: {
    isAdmin: false,
    stages: STAGES,
    list: [],
    loading: true,
    error: '',
    showForm: false,
    form: emptyForm(),
    saving: false,
    uploading: false
  },

  onLoad() {
    const user = isLoggedIn() ? getUser() : null

    if (!user || user.role !== 'admin') {
      this.setData({ isAdmin: false, loading: false })
      return
    }

    this.setData({ isAdmin: true })
    this.fetchTeachers()
  },

  onPullDownRefresh() {
    this.fetchTeachers(true)
  },

  fetchTeachers(fromPullDown = false) {
    this.setData({ loading: !this.data.list.length, error: '' })

    request
      .get('/api/admin/teachers')
      .then(data => {
        this.setData({
          list: (data.list || []).map(item => ({
            ...item,
            fansText: formatFans(item.fans),
            avatarUrl: assetUrl(item.avatar),
            initial: String(item.name || '').slice(0, 1)
          })),
          loading: false
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '名师加载失败' })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onCreate() {
    this.setData({ showForm: true, form: emptyForm() })
  },

  onEdit(e) {
    const id = Number(e.currentTarget.dataset.id)
    const teacher = this.data.list.find(item => item.id === id)
    if (!teacher) return

    this.setData({
      showForm: true,
      form: {
        id: teacher.id,
        name: teacher.name,
        title: teacher.title || '',
        stageIndex: Math.max(0, STAGES.indexOf(teacher.stage)),
        subject: teacher.subject || '',
        tagsText: (teacher.tags || []).join('，'),
        fans: String(teacher.fans || 0),
        years: String(teacher.years || 0),
        intro: teacher.intro || '',
        avatar: teacher.avatar || '',
        avatarUrl: teacher.avatarUrl || '',
        status: teacher.status
      }
    })
  },

  onCloseForm() {
    if (this.data.saving) return
    this.setData({ showForm: false })
  },

  noop() {},

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onStageChange(e) {
    this.setData({ 'form.stageIndex': Number(e.detail.value) || 0 })
  },

  onStatusChange(e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 })
  },

  onChooseAvatar() {
    if (this.data.uploading) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        this.uploadAvatar(file.tempFilePath)
      }
    })
  },

  uploadAvatar(filePath) {
    this.setData({ uploading: true })

    request
      .upload('/api/admin/teachers/upload', filePath)
      .then(data => {
        this.setData({
          'form.avatar': data.url,
          'form.avatarUrl': assetUrl(data.url),
          uploading: false
        })
        wx.showToast({ title: '头像已上传', icon: 'none' })
      })
      .catch(err => {
        this.setData({ uploading: false })
        wx.showToast({ title: err.message || '上传失败', icon: 'none' })
      })
  },

  onSave() {
    if (this.data.saving) return

    const form = this.data.form
    const name = form.name.trim()
    const tags = form.tagsText.trim()

    if (name.length < 2 || name.length > 20) {
      wx.showToast({ title: '姓名需为 2-20 个字符', icon: 'none' })
      return
    }
    if (!tags) {
      wx.showToast({ title: '请至少填写一个标签', icon: 'none' })
      return
    }

    const payload = {
      name,
      title: form.title.trim(),
      stage: STAGES[form.stageIndex] || '其他',
      subject: form.subject.trim(),
      tags,
      fans: Number(form.fans) || 0,
      years: Number(form.years) || 0,
      intro: form.intro.trim(),
      avatar: form.avatar,
      status: form.status
    }

    this.setData({ saving: true })
    const isEdit = Boolean(form.id)
    const action = isEdit
      ? request.patch(`/api/admin/teachers/${form.id}`, payload)
      : request.post('/api/admin/teachers', payload)

    action
      .then(() => {
        wx.showToast({ title: isEdit ? '已保存' : '已新增', icon: 'success' })
        this.setData({ saving: false, showForm: false })
        this.fetchTeachers()
      })
      .catch(err => {
        this.setData({ saving: false })
        wx.showToast({ title: err.message || '保存失败', icon: 'none' })
      })
  },

  onToggleStatus(e) {
    const id = Number(e.currentTarget.dataset.id)
    const teacher = this.data.list.find(item => item.id === id)
    if (!teacher) return

    const status = teacher.status === 1 ? 0 : 1

    request
      .patch(`/api/admin/teachers/${id}`, { status })
      .then(() => {
        wx.showToast({ title: status === 1 ? '已上架' : '已下架', icon: 'none' })
        this.fetchTeachers()
      })
      .catch(err => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' })
      })
  },

  onRetry() {
    this.fetchTeachers()
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
