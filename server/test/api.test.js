const { test, before, after } = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')

const PORT = 3199
const BASE = `http://127.0.0.1:${PORT}`

let child = null

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch (err) {}
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error('测试服务启动超时')
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-Client-Id': 'test_client_001',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json()
  return { status: res.status, body: json }
}

before(async () => {
  child = spawn(process.execPath, ['app.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PORT: '1', // 强制连接失败，使用内存仓库，避免污染演示数据
      REDIS_URL: '',
      WX_MOCK: '1',
      LOG_LEVEL: 'error',
      LOG_DIR: path.join(os.tmpdir(), 'yyyg-test-logs')
    },
    stdio: 'ignore'
  })

  await waitForServer()
})

after(() => {
  if (child) child.kill()
})

let adminToken = ''
let studentToken = ''

test('健康检查返回服务状态', async () => {
  const { status, body } = await api('/api/health')
  assert.strictEqual(status, 200)
  assert.strictEqual(body.code, 0)
  assert.strictEqual(body.data.status, 'ok')
})

test('名师列表可用', async () => {
  const { status, body } = await api('/api/teachers?page=1&pageSize=3')
  assert.strictEqual(status, 200)
  assert.ok(body.data.list.length > 0)
  assert.ok(body.data.pagination.total >= body.data.list.length)
})

test('管理员登录并可查看看板', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  })
  assert.strictEqual(login.status, 200)
  adminToken = login.body.data.token
  assert.ok(adminToken)

  const stats = await api('/api/admin/stats', { token: adminToken })
  assert.strictEqual(stats.status, 200)
  assert.ok(stats.body.data.bookings.total >= 0)
  assert.strictEqual(stats.body.data.trend.length, 7)
})

test('学员登录后可报名与取消课程', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'student', password: 'student123' }
  })
  assert.strictEqual(login.status, 200)
  studentToken = login.body.data.token

  const list = await api('/api/courses', { token: studentToken })
  assert.strictEqual(list.status, 200)
  const target = list.body.data.list.find(item => item.status === 0)
  assert.ok(target, '应存在预告中的课程')

  const enroll = await api(`/api/courses/${target.id}/enroll`, {
    method: 'POST',
    token: studentToken
  })
  assert.ok([200, 201].includes(enroll.status))

  const mine = await api('/api/courses/mine', { token: studentToken })
  assert.ok(mine.body.data.list.some(item => item.id === target.id))

  const cancel = await api(`/api/courses/${target.id}/enroll`, {
    method: 'DELETE',
    token: studentToken
  })
  assert.strictEqual(cancel.status, 200)
})

test('课程报名需要登录', async () => {
  const res = await api('/api/courses/1/enroll', { method: 'POST' })
  assert.strictEqual(res.status, 401)
})

test('微信静默登录自动建号并复用 JWT', async () => {
  const first = await api('/api/auth/wx-login', {
    method: 'POST',
    body: { code: 'mock_openid_test_001' }
  })
  assert.strictEqual(first.status, 200)
  assert.strictEqual(first.body.data.isNew, true)
  assert.ok(first.body.data.token)
  assert.strictEqual(first.body.data.user.role, 'user')

  const second = await api('/api/auth/wx-login', {
    method: 'POST',
    body: { code: 'mock_openid_test_001' }
  })
  assert.strictEqual(second.status, 200)
  assert.strictEqual(second.body.data.isNew, false)
  assert.strictEqual(second.body.data.user.id, first.body.data.user.id)

  const me = await api('/api/auth/me', { token: second.body.data.token })
  assert.strictEqual(me.status, 200)
  assert.strictEqual(me.body.data.id, first.body.data.user.id)
})

test('微信登录缺少 code 时返回 422', async () => {
  const res = await api('/api/auth/wx-login', { method: 'POST', body: {} })
  assert.strictEqual(res.status, 422)
})

test('搜索热词记录后出现在热搜榜', async () => {
  const keyword = '测试关键词'
  const record = await api('/api/search/record', { method: 'POST', body: { keyword } })
  assert.strictEqual(record.status, 200)

  const hot = await api('/api/search/hot?limit=10')
  assert.strictEqual(hot.status, 200)
  assert.ok(hot.body.data.list.some(item => item.keyword === keyword))
})

test('消息中心返回列表与未读数', async () => {
  const unread = await api('/api/notifications/unread-count', { token: studentToken })
  assert.strictEqual(unread.status, 200)
  assert.ok(unread.body.data.count >= 1)

  const list = await api('/api/notifications', { token: studentToken })
  assert.strictEqual(list.status, 200)
  assert.ok(list.body.data.list.length > 0)

  await api('/api/notifications/read-all', { method: 'PATCH', token: studentToken })
  const after = await api('/api/notifications/unread-count', { token: studentToken })
  assert.strictEqual(after.body.data.count, 0)
})

test('管理员可新增名师并下架', async () => {
  const created = await api('/api/admin/teachers', {
    method: 'POST',
    token: adminToken,
    body: {
      name: '测试老师',
      title: '集成测试账号',
      stage: '初中',
      subject: '数学',
      tags: ['初中', '数学'],
      fans: 1000,
      intro: '用于自动化测试',
      years: 3
    }
  })
  assert.strictEqual(created.status, 201)
  const id = created.body.data.id

  const offline = await api(`/api/admin/teachers/${id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 0 }
  })
  assert.strictEqual(offline.status, 200)
  assert.strictEqual(offline.body.data.status, 0)

  const detail = await api(`/api/teachers/${id}`)
  assert.strictEqual(detail.status, 404)
})

test('接口文档可访问', async () => {
  const res = await fetch(`${BASE}/api/docs`)
  const html = await res.text()
  assert.strictEqual(res.status, 200)
  assert.ok(html.includes('接口文档'))
})
