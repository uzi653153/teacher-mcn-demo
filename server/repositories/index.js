const { pool, ping, hasRequiredTables } = require('../db')
const createMysqlRepository = require('./mysql')
const createMemoryRepository = require('./memory')
const seed = require('../data/teachers')
const { createLogger } = require('../logger')

const logger = createLogger('db')

async function createRepository() {
  const dbConnected = await ping()

  if (!dbConnected) {
    logger.warn('MySQL 未连接，已切换为内存演示模式（数据不会持久化）')
    return {
      repo: createMemoryRepository(seed),
      mode: 'memory'
    }
  }

  const ready = await hasRequiredTables()
  if (!ready) {
    logger.warn('MySQL 已连接，但数据表不存在，请先执行 npm run init-db')
    logger.warn('当前使用内存演示模式')
    return {
      repo: createMemoryRepository(seed),
      mode: 'memory'
    }
  }

  logger.info('MySQL 已连接', { mode: 'mysql' })

  return {
    repo: createMysqlRepository(pool),
    mode: 'mysql'
  }
}

async function closeRepository() {
  await pool.end()
}

module.exports = {
  createRepository,
  closeRepository
}
