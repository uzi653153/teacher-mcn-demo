const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const config = require('./config')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false

  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')

  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  )
}

function readToken(req) {
  const header = String(req.get('Authorization') || '')
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function parseToken(token) {
  const payload = jwt.verify(token, config.jwtSecret)
  return {
    id: Number(payload.sub),
    username: payload.username,
    role: payload.role
  }
}

function requireAuth(req, res, next) {
  const token = readToken(req)
  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录' })
  }

  try {
    req.user = parseToken(token)
    next()
  } catch (err) {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}

function optionalAuth(req, res, next) {
  const token = readToken(req)
  if (token) {
    try {
      req.user = parseToken(token)
    } catch (err) {}
  }
  next()
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' })
  }
  next()
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  optionalAuth,
  requireAdmin
}
