const express = require('express')
const config = require('../config')
const cache = require('../cache')
const { parseListQuery } = require('../validators')

const router = express.Router()

router.get('/', async (req, res) => {
  const params = parseListQuery(req.query)
  const repo = req.app.locals.repo
  const cacheKey = `teachers:list:${params.category}:${params.keyword}:${params.page}:${params.pageSize}`

  const result = await cache.wrap(cacheKey, config.cacheTtl, () => repo.listTeachers(params))

  res.json({
    code: 0,
    message: 'ok',
    data: {
      list: result.list,
      summary: result.summary,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total: result.total,
        hasMore: params.page * params.pageSize < result.total
      }
    }
  })
})

router.get('/compare', async (req, res) => {
  const ids = [
    ...new Set(
      String(req.query.ids || '')
        .split(',')
        .map(item => Number.parseInt(item, 10))
        .filter(id => Number.isInteger(id) && id > 0)
    )
  ].slice(0, 3)

  if (ids.length < 2) {
    return res.status(400).json({ code: 400, message: '请选择 2-3 位名师进行对比' })
  }

  const repo = req.app.locals.repo
  const teachers = (await Promise.all(ids.map(id => repo.getTeacher(id)))).filter(Boolean)

  if (teachers.length < 2) {
    return res.status(404).json({ code: 404, message: '部分名师不存在，无法对比' })
  }

  res.json({ code: 0, message: 'ok', data: { list: teachers } })
})

router.get('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: '名师 ID 不合法' })
  }

  const repo = req.app.locals.repo
  const teacher = await cache.wrap(`teachers:detail:${id}`, config.cacheTtl, () =>
    repo.getTeacher(id)
  )

  if (!teacher) {
    return res.status(404).json({ code: 404, message: '名师不存在' })
  }

  res.json({ code: 0, message: 'ok', data: teacher })
})

module.exports = router
