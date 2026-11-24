const express = require('express')
const { requireAuth } = require('../auth')

const router = express.Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20))
  const result = await req.app.locals.repo.listNotifications(req.user.id, { page, pageSize })
  const unread = await req.app.locals.repo.countUnreadNotifications(req.user.id)

  res.json({
    code: 0,
    message: 'ok',
    data: {
      list: result.list,
      total: result.total,
      unread,
      pagination: {
        page,
        pageSize,
        hasMore: page * pageSize < result.total
      }
    }
  })
})

router.get('/unread-count', async (req, res) => {
  const count = await req.app.locals.repo.countUnreadNotifications(req.user.id)
  res.json({ code: 0, message: 'ok', data: { count } })
})

router.patch('/read-all', async (req, res) => {
  const updated = await req.app.locals.repo.markAllNotificationsRead(req.user.id)
  res.json({ code: 0, message: '全部已读', data: { updated } })
})

router.patch('/:id/read', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '通知 ID 不合法' })
  }

  const ok = await req.app.locals.repo.markNotificationRead(req.user.id, id)

  if (!ok) {
    return res.status(404).json({ code: 404, message: '通知不存在' })
  }

  res.json({ code: 0, message: 'ok', data: { id } })
})

module.exports = router
