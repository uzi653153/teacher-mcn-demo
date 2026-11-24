const express = require('express')
const { ping } = require('../db')
const cache = require('../cache')
const pkg = require('../package.json')

const router = express.Router()

router.get('/health', async (req, res) => {
  const dbOk = await ping()

  res.json({
    code: 0,
    message: 'ok',
    data: {
      status: 'ok',
      version: pkg.version,
      uptime: Math.round(process.uptime()),
      repository: req.app.locals.repoMode,
      database: dbOk ? 'up' : 'down',
      cache: cache.stats()
    }
  })
})

module.exports = router
