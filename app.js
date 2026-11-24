const { ensureClientId } = require('./utils/client')
const { getUser } = require('./utils/auth')
const { silentLogin } = require('./utils/wechat')

App({
  globalData: {
    clientId: '',
    nickname: '',
    user: null
  },

  onLaunch() {
    this.globalData.clientId = ensureClientId()
    this.globalData.user = getUser()

    // 未登录时尝试微信静默登录，失败则保持游客态
    silentLogin().then(data => {
      if (data && data.user) {
        this.globalData.user = data.user
      }
    })
  }
})
