const request = require('./request')
const { getToken, setAuth } = require('./auth')

// 调用 wx.login 换取 code，再交给服务端换 openid 并签发 JWT
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      timeout: 10000,
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败，请重试'))
          return
        }

        request
          .post('/api/auth/wx-login', { code: res.code })
          .then(data => {
            setAuth({ token: data.token, user: data.user })
            resolve(data)
          })
          .catch(reject)
      },
      fail() {
        reject(new Error('微信登录失败，请重试'))
      }
    })
  })
}

// 启动时静默登录：已登录直接跳过，失败不打扰用户
function silentLogin() {
  if (getToken()) return Promise.resolve(null)
  return wxLogin().catch(() => null)
}

module.exports = {
  wxLogin,
  silentLogin
}
