const express = require('express')
const { requireAuth } = require('../auth')

const router = express.Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const list = await req.app.locals.repo.listFavoriteTeachers(req.user.id)

  res.json({
    code: 0,
    message: 'ok',
    data: { list, total: list.length }
  })
})

router.get('/ids', async (req, res) => {
  const ids = await req.app.locals.repo.listFavoriteIds(req.user.id)
  res.json({ code: 0, message: 'ok', data: { ids } })
})

router.post('/:teacherId', async (req, res) => {
  const teacherId = Number.parseInt(req.params.teacherId, 10)

  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ code: 400, message: '名师 ID 不合法' })
  }

  const repo = req.app.locals.repo
  const teacher = await repo.getTeacher(teacherId)

  if (!teacher) {
    return res.status(404).json({ code: 404, message: '名师不存在' })
  }

  await repo.addFavorite(req.user.id, teacherId)
  res.status(201).json({
    code: 0,
    message: '已收藏',
    data: { teacherId, favorited: true }
  })
})

router.delete('/:teacherId', async (req, res) => {
  const teacherId = Number.parseInt(req.params.teacherId, 10)

  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ code: 400, message: '名师 ID 不合法' })
  }

  await req.app.locals.repo.removeFavorite(req.user.id, teacherId)
  res.json({
    code: 0,
    message: '已取消收藏',
    data: { teacherId, favorited: false }
  })
})

module.exports = router
