const crypto = require('crypto')
const express = require('express')
const { validateAuth } = require('../validators')
const { rateLimit } = require('../middleware')
const { hashPassword, verifyPassword, signToken, requireAuth } = require('../auth')
const { createLogger } = require('../logger')
const config = require('../config')

const logger = createLogger('auth')
const router = express.Router()

const WX_ERRORS = {
  40029: { status: 422, message: '登录凭证已失效，请重新进入小程序' },
  40163: { status: 422, message: '登录凭证已失效，请重新进入小程序' },
  45011: { status: 429, message: '微信登录过于频繁，请稍后再试' },
  '-1': { status: 503, message: '微信服务繁忙，请稍后再试' }
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    createdAt: user.createdAt
  }
}

// 单次 4.5s、失败重试 1 次，总预算 9s，小于小程序端 10s 超时，避免前端先断开
const WX_TIMEOUT_MS = 4500

async function requestWxSession(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(WX_TIMEOUT_MS) })
  if (!response.ok) {
    const error = new Error('微信接口请求失败')
    error.status = 502
    throw error
  }
  return response.json()
}

async function fetchWxSession(code) {
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(config.wx.appId)}` +
    `&secret=${encodeURIComponent(config.wx.appSecret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    '&grant_type=authorization_code'

  try {
    return await requestWxSession(url)
  } catch (err) {
    // 仅对超时/网络错误重试一次（HTTP 错误码和业务 errcode 不重试）
    if (err.status) throw err
    logger.warn('微信登录接口超时，重试一次', { message: err.message })
    return requestWxSession(url)
  }
}


router.post('/register', rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  const { errors, value } = validateAuth(req.body, { register: true })

  if (Object.keys(errors).length) {
    return res.status(422).json({ code: 422, message: '请检查注册信息', errors })
  }

  const repo = req.app.locals.repo
  const exists = await repo.findUserByUsername(value.username)

  if (exists) {
    return res.status(409).json({ code: 409, message: '用户名已被注册' })
  }

  const user = await repo.createUser({
    username: value.username,
    nickname: value.nickname,
    passwordHash: hashPassword(value.password)
  })

  logger.info('用户注册', {
    userId: user.id,
    username: user.username,
    ip: req.ip,
    requestId: req.id
  })

  res.status(201).json({
    code: 0,
    message: '注册成功',
    data: { token: signToken(user), user }
  })
})

router.post('/login', rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  const { errors, value } = validateAuth(req.body)

  if (Object.keys(errors).length) {
    return res.status(422).json({ code: 422, message: '请检查登录信息', errors })
  }

  const repo = req.app.locals.repo
  const user = await repo.findUserByUsername(value.username)

  if (!user || !verifyPassword(value.password, user.passwordHash)) {
    logger.warn('登录失败', {
      username: value.username,
      ip: req.ip,
      requestId: req.id
    })
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  logger.info('用户登录', {
    userId: user.id,
    username: user.username,
    role: user.role,
    requestId: req.id
  })

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token: signToken(user),
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        createdAt: user.createdAt
      }
    }
  })
})

// 微信小程序静默登录：code -> openid -> 查/建用户 -> 复用 JWT
router.post('/wx-login', rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim()

  if (!code || code.length > 128) {
    return res.status(422).json({ code: 422, message: '缺少有效的微信登录凭证' })
  }

  let openid = ''
  let unionid = null

  if (config.wx.mock && code.startsWith('mock_')) {
    openid = code.slice(5)
    if (!openid) {
      return res.status(422).json({ code: 422, message: '缺少有效的微信登录凭证' })
    }
  } else {
    if (!config.wx.appId || !config.wx.appSecret) {
      logger.error('微信登录未配置 WX_APPID / WX_APPSECRET')
      return res.status(503).json({ code: 503, message: '微信登录暂未配置' })
    }

    let session
    try {
      session = await fetchWxSession(code)
    } catch (err) {
      logger.error('请求微信登录接口失败', { message: err.message, requestId: req.id })
      return res.status(err.status || 502).json({ code: err.status || 502, message: '微信登录失败，请稍后重试' })
    }

    if (session.errcode) {
      logger.warn('微信登录返回错误', { errcode: session.errcode, errmsg: session.errmsg, requestId: req.id })
      const known = WX_ERRORS[String(session.errcode)]
      return res.status(known ? known.status : 401).json({
        code: known ? known.status : 401,
        message: known ? known.message : '微信登录失败，请稍后重试'
      })
    }

    openid = session.openid || ''
    unionid = session.unionid || null

    if (!openid) {
      logger.warn('微信登录未返回 openid', { requestId: req.id })
      return res.status(502).json({ code: 502, message: '微信登录失败，请稍后重试' })
    }
  }

  const repo = req.app.locals.repo
  let user = await repo.findUserByOpenid(openid)
  let isNew = false

  if (!user) {
    const username = `wx_${crypto.createHash('sha1').update(openid).digest('hex').slice(0, 12)}`

    try {
      user = await repo.createWxUser({
        username,
        nickname: `微信用户${openid.slice(-4)}`,
        passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')),
        openid,
        unionid
      })
      isNew = true
    } catch (err) {
      // 并发首登时唯一索引冲突，回查即可
      if (err && err.code === 'ER_DUP_ENTRY') {
        user = await repo.findUserByOpenid(openid)
      } else {
        throw err
      }
    }

    if (!user) {
      return res.status(500).json({ code: 500, message: '微信登录失败，请稍后重试' })
    }
  }

  logger.info(isNew ? '微信用户自动建号' : '微信用户登录', {
    userId: user.id,
    requestId: req.id
  })

  res.json({
    code: 0,
    message: isNew ? '登录成功，已为你创建账号' : '登录成功',
    data: {
      token: signToken(user),
      user: publicUser(user),
      isNew
    }
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await req.app.locals.repo.findUserById(req.user.id)

  if (!user) {
    return res.status(401).json({ code: 401, message: '账号不存在，请重新登录' })
  }

  res.json({ code: 0, message: 'ok', data: user })
})

module.exports = router
