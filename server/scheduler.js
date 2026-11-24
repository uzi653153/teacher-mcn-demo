const cron = require('node-cron')
const { createLogger } = require('./logger')

const logger = createLogger('scheduler')

// 每天 03:00 清理 30 天前的已读通知，避免表无限增长
function start(repo) {
  const task = cron.schedule('0 3 * * *', async () => {
    try {
      const removed = await repo.cleanupReadNotifications(30)
      logger.info('清理历史通知完成', { removed })
    } catch (err) {
      logger.error('清理历史通知失败', { message: err.message })
    }
  })

  logger.info('定时任务已启动', { jobs: ['每天 03:00 清理 30 天前已读通知'] })
  return task
}

module.exports = { start }
