const express = require('express')
const { requireAuth, requireAdmin } = require('../auth')
const { BOOKING_STATUS, validateTeacherPayload } = require('../validators')
const { upload } = require('../upload')
const { createLogger } = require('../logger')

const logger = createLogger('admin')
const router = express.Router()

router.use(requireAuth, requireAdmin)

router.get('/stats', async (req, res) => {
  const stats = await req.app.locals.repo.getAdminStats()
  res.json({ code: 0, message: 'ok', data: stats })
})

router.get('/teachers', async (req, res) => {
  const list = await req.app.locals.repo.listAllTeachers()
  res.json({ code: 0, message: 'ok', data: { list, total: list.length } })
})

router.post('/teachers/upload', (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? '图片不能超过 2MB'
          : err.code === 'UNSUPPORTED_TYPE'
            ? err.message
            : '图片上传失败'
      return res.status(400).json({ code: 400, message })
    }

    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的图片' })
    }

    logger.info('上传名师头像', {
      file: req.file.filename,
      size: req.file.size,
      operatorId: req.user.id,
      requestId: req.id
    })

    res.status(201).json({
      code: 0,
      message: '上传成功',
      data: { url: `/uploads/${req.file.filename}` }
    })
  })
})

router.post('/teachers', async (req, res) => {
  const { errors, value } = validateTeacherPayload(req.body)

  if (Object.keys(errors).length) {
    return res.status(422).json({ code: 422, message: '请检查名师信息', errors })
  }

  try {
    const teacher = await req.app.locals.repo.createTeacher(value)
    logger.info('新增名师', {
      teacherId: teacher.id,
      name: teacher.name,
      operatorId: req.user.id,
      requestId: req.id
    })
    res.status(201).json({ code: 0, message: '新增成功', data: teacher })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: '同名名师已存在' })
    }
    throw err
  }
})

router.patch('/teachers/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '名师 ID 不合法' })
  }

  const { errors, value } = validateTeacherPayload(req.body, { partial: true })

  if (Object.keys(errors).length) {
    return res.status(422).json({ code: 422, message: '请检查名师信息', errors })
  }

  try {
    const teacher = await req.app.locals.repo.updateTeacher(id, value)

    if (!teacher) {
      return res.status(404).json({ code: 404, message: '名师不存在或没有需要更新的内容' })
    }

    logger.info('更新名师', {
      teacherId: id,
      fields: Object.keys(value),
      operatorId: req.user.id,
      requestId: req.id
    })

    res.json({ code: 0, message: '更新成功', data: teacher })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: '同名名师已存在' })
    }
    throw err
  }
})

router.get('/bookings', async (req, res) => {
  const raw = String(req.query.status ?? '').trim()
  let status = null

  if (raw !== '' && raw !== 'all') {
    const parsed = Number.parseInt(raw, 10)
    if (![0, 1, 2].includes(parsed)) {
      return res.status(400).json({ code: 400, message: '预约状态不合法' })
    }
    status = parsed
  }

  const list = await req.app.locals.repo.listAllBookings(status)

  res.json({
    code: 0,
    message: 'ok',
    data: { list, total: list.length }
  })
})

router.patch('/bookings/:id/status', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)
  const status = Number.parseInt(req.body.status, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '预约 ID 不合法' })
  }

  if (![BOOKING_STATUS.CONTACTED, BOOKING_STATUS.CANCELED].includes(status)) {
    return res.status(400).json({ code: 400, message: '仅支持标记为已联系或已取消' })
  }

  const repo = req.app.locals.repo
  const booking = await repo.getBookingById(id)

  if (!booking) {
    return res.status(404).json({ code: 404, message: '预约不存在' })
  }

  const ok = await repo.updateBookingStatus(id, status)

  if (!ok) {
    return res.status(409).json({ code: 409, message: '预约不存在或已结束，无法再变更' })
  }

  if (booking.userId) {
    await repo.createNotification({
      userId: booking.userId,
      type: 'booking',
      title: status === BOOKING_STATUS.CONTACTED ? '预约已确认' : '预约已取消',
      content:
        status === BOOKING_STATUS.CONTACTED
          ? `你向 ${booking.teacherName} 发起的预约已由运营老师联系，请保持电话畅通。`
          : `你向 ${booking.teacherName} 发起的预约已被取消，可重新选择老师预约。`,
      relatedId: id
    })
  }

  logger.info('预约状态变更', {
    bookingId: id,
    status,
    operatorId: req.user.id,
    requestId: req.id
  })

  res.json({
    code: 0,
    message: status === BOOKING_STATUS.CONTACTED ? '已标记为已联系' : '已取消预约',
    data: { id, status }
  })
})

module.exports = router
