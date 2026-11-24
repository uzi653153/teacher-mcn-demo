const CLIENT_KEY = 'yyyg_client_id'

function ensureClientId() {
  let id = wx.getStorageSync(CLIENT_KEY)
  if (!id) {
    id = `wx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    wx.setStorageSync(CLIENT_KEY, id)
  }
  return id
}

module.exports = {
  ensureClientId
}
