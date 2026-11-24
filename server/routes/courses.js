const express = require('express')
const { requireAuth, optionalAuth } = require('../auth')
const { createLogger } = require('../logger')

const logger = createLogger('course')
const router = express.Router()

const STATUS_FILTER = { all: null, upcoming: 0, live: 1, ended: 2 }

router.get('/', optionalAuth, async (req, res) => {
  const userId = req.user ? req.user.id : null
  const list = await req.app.locals.repo.listCourses({ userId })
  const key = String(req.query.status || 'all')
  const filter = Object.prototype.hasOwnProperty.call(STATUS_FILTER, key)
    ? STATUS_FILTER[key]
    : null
  const courses = filter === null ? list : list.filter(item => item.status === filter)

  res.json({
    code: 0,
    message: 'ok',
    data: {
      list: courses,
      total: courses.length,
      summary: {
        live: list.filter(item => item.status === 1).length,
        upcoming: list.filter(item => item.status === 0).length,
        ended: list.filter(item => item.status === 2).length
      }
    }
  })
})

router.get('/mine', requireAuth, async (req, res) => {
  const list = await req.app.locals.repo.listMyCourses(req.user.id)
  res.json({
    code: 0,
    message: 'ok',
    data: { list, total: list.length }
  })
})

router.get('/:id', optionalAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '课程 ID 不合法' })
  }

  const course = await req.app.locals.repo.getCourse(id, req.user ? req.user.id : null)

  if (!course) {
    return res.status(404).json({ code: 404, message: '课程不存在' })
  }

  res.json({ code: 0, message: 'ok', data: course })
})

router.post('/:id/enroll', requireAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '课程 ID 不合法' })
  }

  const result = await req.app.locals.repo.enrollCourse(req.user.id, id)

  if (!result.ok) {
    const message =
      result.reason === 'not_found'
        ? '课程不存在'
        : result.reason === 'full'
          ? '名额已满，下次早点来哦'
          : '课程已结束，无法报名'

    return res.status(result.reason === 'not_found' ? 404 : 409).json({
      code: result.reason === 'not_found' ? 404 : 409,
      message
    })
  }

  logger.info('课程报名', {
    courseId: id,
    userId: req.user.id,
    already: result.already,
    requestId: req.id
  })

  const course = await req.app.locals.repo.getCourse(id, req.user.id)

  res.status(result.already ? 200 : 201).json({
    code: 0,
    message: result.already ? '你已报名该课程' : '报名成功',
    data: { course, already: result.already }
  })
})

router.delete('/:id/enroll', requireAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '课程 ID 不合法' })
  }

  const ok = await req.app.locals.repo.cancelCourseEnrollment(req.user.id, id)

  if (!ok) {
    return res.status(409).json({ code: 409, message: '你还没有报名该课程' })
  }

  logger.info('取消课程报名', { courseId: id, userId: req.user.id, requestId: req.id })

  res.json({ code: 0, message: '已取消报名', data: { courseId: id } })
})

module.exports = router
