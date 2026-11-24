const crypto = require('crypto')
const { createLogger } = require('./logger')

const httpLogger = createLogger('http')
const errorLogger = createLogger('error')

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint()
  const requestId = crypto.randomBytes(4).toString('hex')

  req.id = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const duration = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip
    }

    const clientId = req.get('X-Client-Id')
    if (clientId) meta.clientId = clientId
    if (req.user) meta.userId = req.user.id

    if (res.statusCode >= 500) {
      httpLogger.error('请求处理失败', meta)
    } else if (res.statusCode >= 400) {
      httpLogger.warn('请求异常', meta)
    } else if (duration >= 500) {
      httpLogger.warn('慢请求', meta)
    } else {
      httpLogger.info('请求完成', meta)
    }
  })

  next()
}

function notFound(req, res) {
  res.status(404).json({ code: 404, message: '接口不存在' })
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500
  const requestId = req.id || '-'

  errorLogger.error(err.message || '未处理异常', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    status,
    stack: err.stack
  })

  if (res.headersSent) return next(err)

  res.status(status).json({
    code: status,
    message: status >= 500 ? '服务异常，请稍后重试' : err.message,
    requestId
  })
}

function rateLimit({ windowMs = 60000, max = 5, message = '操作过于频繁，请稍后再试' } = {}) {
  const hits = new Map()

  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of hits) {
      if (record.resetAt <= now) hits.delete(key)
    }
  }, windowMs)
  if (typeof timer.unref === 'function') timer.unref()

  return function limitMiddleware(req, res, next) {
    const key = req.get('X-Client-Id') || req.ip || 'anonymous'
    const now = Date.now()
    const record = hits.get(key)

    if (!record || record.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    record.count += 1
    if (record.count > max) {
      res.set('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)))
      return res.status(429).json({ code: 429, message })
    }

    next()
  }
}

module.exports = {
  requestLogger,
  notFound,
  errorHandler,
  rateLimit
}
