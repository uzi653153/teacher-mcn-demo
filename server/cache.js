const Redis = require('ioredis')
const config = require('./config')
const { createLogger } = require('./logger')

const logger = createLogger('cache')

const memory = new Map()
const memoryZsets = new Map()
let client = null
let redisReady = false
let initSettled = false

function degrade(reason) {
  if (!redisReady) return
  redisReady = false
  logger.warn('Redis 不可用，降级为进程内缓存', { reason })
}

async function initCache() {
  if (!config.redisUrl) {
    logger.info('未配置 REDIS_URL，使用进程内缓存')
    return
  }

  // ioredis 兼容 Redis 2.6+，可在老版本 Windows Redis 上正常工作
  client = new Redis(config.redisUrl, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // 断线后有限次指数退避重连（约 1 分钟），随后放弃并保持内存降级
    retryStrategy(times) {
      if (times > 30) return null
      return Math.min(times * 200, 3000)
    }
  })

  client.on('error', err => degrade(err.message))
  client.on('close', () => degrade('连接已关闭'))
  // 重连成功后自动切回 Redis
  client.on('ready', () => {
    if (!initSettled || redisReady) return
    redisReady = true
    logger.info('Redis 已重新连接，恢复使用 Redis 缓存')
  })

  try {
    await client.connect()
    const pong = await client.ping()
    redisReady = pong === 'PONG'
    if (redisReady) {
      logger.info('Redis 已连接', { url: config.redisUrl })
    } else {
      degrade('PING 未返回 PONG')
    }
  } catch (err) {
    degrade(err.message)
  } finally {
    initSettled = true
  }
}

async function get(key) {
  if (redisReady) {
    try {
      const value = await client.get(key)
      if (value !== null && value !== undefined) return JSON.parse(value)
      return null
    } catch (err) {
      degrade(err.message)
    }
  }

  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expireAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value
}

async function set(key, value, ttlSeconds = config.cacheTtl) {
  if (redisReady) {
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      return
    } catch (err) {
      degrade(err.message)
    }
  }

  memory.set(key, {
    value,
    expireAt: Date.now() + ttlSeconds * 1000
  })
}

async function wrap(key, ttlSeconds, loader) {
  const cached = await get(key)
  if (cached !== null) return cached
  const value = await loader()
  if (value !== null && value !== undefined) {
    await set(key, value, ttlSeconds)
  }
  return value
}

function readMemoryZset(key, now = Date.now()) {
  const entry = memoryZsets.get(key)
  if (!entry) return null
  if (entry.expireAt <= now) {
    memoryZsets.delete(key)
    return null
  }
  return entry
}

// 有序集合自增，用于搜索热搜榜（Redis 不可用时自动降级）
async function zincrby(key, member, increment = 1, ttlSeconds = 7 * 24 * 3600) {
  if (redisReady) {
    try {
      await client.zincrby(key, increment, member)
      await client.expire(key, ttlSeconds)
      return
    } catch (err) {
      degrade(err.message)
    }
  }

  const now = Date.now()
  const entry = readMemoryZset(key, now) || { map: new Map(), expireAt: now + ttlSeconds * 1000 }
  entry.map.set(member, (entry.map.get(member) || 0) + increment)
  entry.expireAt = now + ttlSeconds * 1000
  memoryZsets.set(key, entry)
}

// 按分数倒序取前 N 名，返回 [{ member, score }]
async function zrevrange(key, count = 8) {
  if (redisReady) {
    try {
      const rows = await client.zrevrange(key, 0, count - 1, 'WITHSCORES')
      const list = []
      for (let i = 0; i < rows.length; i += 2) {
        list.push({ member: rows[i], score: Number(rows[i + 1]) || 0 })
      }
      return list
    } catch (err) {
      degrade(err.message)
    }
  }

  const entry = readMemoryZset(key)
  if (!entry) return []

  return [...entry.map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([member, score]) => ({ member, score }))
}

function stats() {
  return {
    mode: redisReady ? 'redis' : 'memory',
    keys: redisReady ? null : memory.size,
    zsets: redisReady ? null : memoryZsets.size
  }
}

async function closeCache() {
  initSettled = false
  if (client) {
    const current = client
    client = null
    try {
      current.disconnect()
    } catch (err) {}
  }
}

module.exports = {
  initCache,
  get,
  set,
  wrap,
  zincrby,
  zrevrange,
  stats,
  closeCache
}
