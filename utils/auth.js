const TOKEN_KEY = 'yyyg_token'
const USER_KEY = 'yyyg_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function setAuth({ token, user }) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

function isLoggedIn() {
  return !!getToken()
}

function isAdmin() {
  const user = getUser()
  return !!user && user.role === 'admin'
}

module.exports = {
  getToken,
  getUser,
  setAuth,
  clearAuth,
  isLoggedIn,
  isAdmin
}
