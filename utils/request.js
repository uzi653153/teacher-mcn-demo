const config = require('./config')
const { ensureClientId } = require('./client')
const { getToken, clearAuth } = require('./auth')

function request(options) {
  const { url, method = 'GET', data, header = {}, timeout = config.timeout } = options
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.request({
      url: config.baseUrl + url,
      method,
      data,
      timeout,
      header: {
        'content-type': 'application/json',
        'X-Client-Id': ensureClientId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header
      },
      success(res) {
        const body = res.data || {}

        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }

        if (res.statusCode === 401 && token) {
          clearAuth()
        }

        const requestId =
          (res.header && (res.header['X-Request-Id'] || res.header['x-request-id'])) || ''
        const error = new Error(body.message || '请求失败，请稍后重试')
        error.code = body.code || res.statusCode
        error.statusCode = res.statusCode
        error.errors = body.errors || null
        error.requestId = requestId

        console.warn(
          `[api] ${method} ${url} -> ${res.statusCode} ${error.message}` +
            (requestId ? ` requestId=${requestId}` : ''),
          body.errors || ''
        )
        reject(error)
      },
      fail(err) {
        console.error(`[api] ${method} ${url} 网络请求失败`, err)
        const error = new Error('网络异常，请确认后端服务已启动')
        error.code = -1
        error.raw = err
        reject(error)
      }
    })
  })
}

function get(url, data) {
  return request({ url, method: 'GET', data })
}

function post(url, data) {
  return request({ url, method: 'POST', data })
}

function patch(url, data) {
  return request({ url, method: 'PATCH', data })
}

function del(url, data) {
  return request({ url, method: 'DELETE', data })
}

// wx.uploadFile 不走 request，需要单独处理 token 与响应结构
function upload(url, filePath, { name = 'file', formData } = {}) {
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: config.baseUrl + url,
      filePath,
      name,
      formData,
      header: {
        'X-Client-Id': ensureClientId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || '{}')
        } catch (err) {}

        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }

        const error = new Error(body.message || '上传失败，请稍后重试')
        error.code = body.code || res.statusCode
        reject(error)
      },
      fail(err) {
        const error = new Error('上传失败，请检查网络')
        error.raw = err
        reject(error)
      }
    })
  })
}

module.exports = {
  request,
  get,
  post,
  patch,
  del,
  upload
}
