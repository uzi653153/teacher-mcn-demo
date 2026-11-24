const express = require('express')
const cache = require('../cache')
const { rateLimit } = require('../middleware')
const { validateSearchKeyword } = require('../validators')

const router = express.Router()

const HOT_KEY = 'search:hot'
const FALLBACK_HOT = ['小学数学', '阅读理解', '初升高', '高考英语', '作文提分', '物理竞赛']

router.get('/hot', async (req, res) => {
  const limit = Math.min(10, Math.max(1, Number.parseInt(req.query.limit, 10) || 8))
  const rows = await cache.zrevrange(HOT_KEY, limit)

  const list = rows.map(row => ({ keyword: row.member, count: row.score }))
  const exists = new Set(list.map(item => item.keyword))

  for (const keyword of FALLBACK_HOT) {
    if (list.length >= limit) break
    if (exists.has(keyword)) continue
    list.push({ keyword, count: 0 })
    exists.add(keyword)
  }

  res.json({ code: 0, message: 'ok', data: { list } })
})

router.post('/record', rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const { errors, value } = validateSearchKeyword(req.body)

  if (Object.keys(errors).length) {
    return res.status(422).json({ code: 422, message: '请检查搜索关键词', errors })
  }

  await cache.zincrby(HOT_KEY, value.keyword, 1)

  res.json({ code: 0, message: 'ok', data: { keyword: value.keyword } })
})

module.exports = router
