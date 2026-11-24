const os = require('os')
const path = require('path')
const express = require('express')
const cors = require('cors')
const config = require('./config')
const routes = require('./routes')
const scheduler = require('./scheduler')
require('./upload')
const { initCache, closeCache } = require('./cache')
const { createRepository, closeRepository } = require('./repositories')
const { requestLogger, notFound, errorHandler } = require('./middleware')
const { createLogger } = require('./logger')

const logger = createLogger('server')
const app = express()

app.disable('x-powered-by')
app.use(
  cors({
    origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
    allowedHeaders: ['Content-Type', 'X-Client-Id', 'Authorization'],
    exposedHeaders: ['X-Request-Id']
  })
)
app.use(express.json({ limit: '64kb' }))
app.use(requestLogger)

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }))
app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

function getLanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

async function bootstrap() {
  await initCache()

  const { repo, mode } = await createRepository()
  app.locals.repo = repo
  app.locals.repoMode = mode

  scheduler.start(repo)

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('服务已启动', {
      url: `http://127.0.0.1:${config.port}`,
      lanIp: getLanIp() || undefined,
      repository: mode,
      logDir: config.logDir
    })
    logger.info('接口自检: GET /api/health')
  })

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`端口 ${config.port} 已被占用`)
    } else {
      logger.error('启动失败', { stack: err.stack })
    }
    process.exit(1)
  })

  let closing = false
  const shutdown = signal => {
    if (closing) return
    closing = true
    logger.info(`收到 ${signal}，正在关闭服务`)

    server.close(async () => {
      await closeCache()
      await closeRepository()
      logger.info('服务已关闭')
      process.exit(0)
    })

    setTimeout(() => process.exit(1), 8000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

bootstrap().catch(err => {
  logger.error('服务启动失败', { stack: err.stack })
  process.exit(1)
})

process.on('uncaughtException', err => {
  logger.error('未捕获异常', { stack: err.stack })
})

process.on('unhandledRejection', reason => {
  logger.error('未处理的 Promise 拒绝', {
    stack: reason && reason.stack ? reason.stack : String(reason)
  })
})
