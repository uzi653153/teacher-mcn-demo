const CATEGORIES = ['全部', '早教', '小初', '高中']
const STAGES = ['早教', '小学', '初中', '高中', '其他']
const BOOKING_STATUS = { PENDING: 0, CONTACTED: 1, CANCELED: 2 }
const COURSE_STATUS = { UPCOMING: 0, LIVE: 1, ENDED: 2 }
const PHONE_RE = /^1[3-9]\d{9}$/
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

function parseListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 10))
  const category = CATEGORIES.includes(query.category) ? query.category : '全部'
  const keyword = String(query.keyword || '').trim().slice(0, 30)

  return { page, pageSize, category, keyword }
}

function validateBooking(body = {}) {
  const errors = {}

  const name = String(body.name || '').trim()
  if (name.length < 2 || name.length > 20) {
    errors.name = '姓名需为 2-20 个字符'
  }

  const phone = String(body.phone || '').trim()
  if (!PHONE_RE.test(phone)) {
    errors.phone = '请输入正确的 11 位手机号'
  }

  const teacherId = Number.parseInt(body.teacherId, 10)
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    errors.teacherId = '请选择意向名师'
  }

  const stage = STAGES.includes(body.stage) ? body.stage : '其他'
  const remark = String(body.remark || '').trim().slice(0, 200)

  return {
    errors,
    value: { name, phone, teacherId, stage, remark }
  }
}

function validateAuth(body = {}, { register = false } = {}) {
  const errors = {}

  const username = String(body.username || '').trim()
  if (!USERNAME_RE.test(username)) {
    errors.username = '用户名需为 3-20 位字母、数字或下划线'
  }

  const password = String(body.password || '')
  if (password.length < 6 || password.length > 32) {
    errors.password = '密码需为 6-32 个字符'
  }

  let nickname = String(body.nickname || '').trim()
  if (register) {
    if (!nickname) nickname = username
    if (nickname.length > 20) {
      errors.nickname = '昵称最多 20 个字符'
    }
  }

  return { errors, value: { username, password, nickname } }
}

function normalizeStringList(value, max = 8) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、\n]/)
  return [...new Set(raw.map(item => String(item).trim()).filter(Boolean))].slice(0, max)
}

function validateSearchKeyword(body = {}) {
  const keyword = String(body.keyword || '').trim().slice(0, 30)
  return {
    errors: keyword ? {} : { keyword: '请输入搜索关键词' },
    value: { keyword }
  }
}

function validateTeacherPayload(body = {}, { partial = false } = {}) {
  const errors = {}
  const value = {}
  const has = key => body[key] !== undefined

  if (!partial || has('name')) {
    const name = String(body.name || '').trim()
    if (name.length < 2 || name.length > 20) errors.name = '姓名需为 2-20 个字符'
    value.name = name
  }

  if (!partial || has('title')) {
    value.title = String(body.title || '').trim().slice(0, 40)
  }

  if (!partial || has('stage')) {
    value.stage = STAGES.includes(body.stage) ? body.stage : '其他'
  }

  if (!partial || has('subject')) {
    value.subject = String(body.subject || '').trim().slice(0, 16)
  }

  if (!partial || has('tags')) {
    value.tags = normalizeStringList(body.tags)
    if (!value.tags.length) errors.tags = '至少填写 1 个标签，如：小学、语文'
  }

  if (!partial || has('fans')) {
    const fans = Number(body.fans)
    if (!Number.isFinite(fans) || fans < 0 || fans > 1e10) {
      errors.fans = '粉丝量需为 0-100 亿之间的数字'
    }
    value.fans = Math.round(Number.isFinite(fans) ? fans : 0)
  }

  if (!partial || has('avatar')) {
    value.avatar = String(body.avatar || '').trim().slice(0, 255)
  }

  if (!partial || has('intro')) {
    value.intro = String(body.intro || '').trim().slice(0, 300)
  }

  if (!partial || has('highlights')) {
    value.highlights = normalizeStringList(body.highlights)
  }

  if (!partial || has('courses')) {
    value.courses = normalizeStringList(body.courses)
  }

  if (!partial || has('years')) {
    const years = Number(body.years)
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      errors.years = '教龄需为 0-60 的整数'
    }
    value.years = Number.isInteger(years) ? years : 0
  }

  if (!partial || has('status')) {
    const status = body.status === undefined ? 1 : Number(body.status)
    if (![0, 1].includes(status)) {
      errors.status = '状态仅支持上架(1)或下架(0)'
    }
    value.status = status
  }

  return { errors, value }
}

module.exports = {
  CATEGORIES,
  STAGES,
  BOOKING_STATUS,
  COURSE_STATUS,
  parseListQuery,
  validateBooking,
  validateAuth,
  validateSearchKeyword,
  validateTeacherPayload
}
