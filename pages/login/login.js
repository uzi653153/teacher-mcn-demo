const request = require('../../utils/request')
const { setAuth } = require('../../utils/auth')
const { wxLogin } = require('../../utils/wechat')

Page({
  data: {
    mode: 'login',
    username: '',
    password: '',
    nickname: '',
    submitting: false,
    wxLoading: false,
    error: ''
  },

  onLoad(query) {
    if (query.mode === 'register') {
      this.setData({ mode: 'register' })
    }
  },

  onSwitch(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.setData({ mode, error: '' })
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value, error: '' })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, error: '' })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onSubmit() {
    if (this.data.submitting) return

    const username = this.data.username.trim()
    const password = this.data.password
    const register = this.data.mode === 'register'

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      this.setData({ error: '用户名需为 3-20 位字母、数字或下划线' })
      return
    }
    if (password.length < 6 || password.length > 32) {
      this.setData({ error: '密码需为 6-32 个字符' })
      return
    }

    this.setData({ submitting: true, error: '' })

    const payload = register
      ? { username, password, nickname: this.data.nickname.trim() }
      : { username, password }

    request
      .post(register ? '/api/auth/register' : '/api/auth/login', payload)
      .then(data => {
        setAuth({ token: data.token, user: data.user })
        getApp().globalData.user = data.user

        wx.showToast({ title: register ? '注册成功' : '登录成功', icon: 'success' })
        setTimeout(() => {
          this.goBack()
        }, 500)
      })
      .catch(err => {
        this.setData({ submitting: false, error: err.message || '操作失败' })
      })
  },

  onWxLogin() {
    if (this.data.submitting || this.data.wxLoading) return

    this.setData({ wxLoading: true, error: '' })

    wxLogin()
      .then(data => {
        getApp().globalData.user = data.user
        wx.showToast({ title: data.isNew ? '已自动创建账号' : '登录成功', icon: 'success' })
        setTimeout(() => {
          this.goBack()
        }, 500)
      })
      .catch(err => {
        this.setData({ wxLoading: false, error: err.message || '微信登录失败' })
      })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/my/my' })
    }
  },

  onUseDemo(e) {
    this.setData({
      mode: 'login',
      username: e.currentTarget.dataset.username,
      password: e.currentTarget.dataset.password,
      error: ''
    })
  }
})
