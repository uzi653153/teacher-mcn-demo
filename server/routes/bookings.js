const express = require('express')
const { validateBooking } = require('../validators')
const { rateLimit } = require('../middleware')
const { optionalAuth } = require('../auth')
const { createLogger } = require('../logger')

const logger = createLogger('booking')
const router = express.Router()

router.use(optionalAuth)

router.use((req, res, next) => {
  const clientId = String(req.get('X-Client-Id') || '').trim()

  if (!/^[A-Za-z0-9_-]{6,64}$/.test(clientId)) {
    return res.status(400).json({ code: 400, message: '缺少有效的客户端标识' })
  }

  req.clientId = clientId
  next()
})

router.post('/', rateLimit({ windowMs: 60000, max: 5 }), async (req, res) => {
  const { errors, value } = validateBooking(req.body)

  if (Object.keys(errors).length) {
    return res.status(422).json({
      code: 422,
      message: '请检查表单填写',
      errors
    })
  }

  const repo = req.app.locals.repo
  const teacher = await repo.getTeacher(value.teacherId)

  if (!teacher) {
    return res.status(404).json({ code: 404, message: '所选名师不存在' })
  }

  const booking = await repo.createBooking({
    ...value,
    teacherName: teacher.name,
    clientId: req.clientId,
    userId: req.user ? req.user.id : null
  })

  logger.info('创建预约', {
    bookingId: booking.id,
    teacherId: value.teacherId,
    stage: value.stage,
    userId: req.user ? req.user.id : null,
    requestId: req.id
  })

  res.status(201).json({
    code: 0,
    message: '预约成功',
    data: booking
  })
})

router.get('/', async (req, res) => {
  const list = await req.app.locals.repo.listBookings(
    req.clientId,
    req.user ? req.user.id : null
  )

  res.json({
    code: 0,
    message: 'ok',
    data: {
      list,
      total: list.length
    }
  })
})

router.patch('/:id/cancel', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '预约 ID 不合法' })
  }

  const ok = await req.app.locals.repo.cancelBooking(
    id,
    req.clientId,
    req.user ? req.user.id : null
  )

  if (!ok) {
    return res.status(409).json({ code: 409, message: '预约不存在或当前状态不可取消' })
  }

  logger.info('取消预约', {
    bookingId: id,
    userId: req.user ? req.user.id : null,
    requestId: req.id
  })

  res.json({
    code: 0,
    message: '已取消预约',
    data: { id, status: 2 }
  })
})

module.exports = router
