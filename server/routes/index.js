const express = require('express')

const router = express.Router()

router.use('/', require('./system'))
router.use('/docs', require('./docs'))
router.use('/auth', require('./auth'))
router.use('/teachers', require('./teachers'))
router.use('/favorites', require('./favorites'))
router.use('/bookings', require('./bookings'))
router.use('/courses', require('./courses'))
router.use('/search', require('./search'))
router.use('/notifications', require('./notifications'))
router.use('/admin', require('./admin'))

module.exports = router
