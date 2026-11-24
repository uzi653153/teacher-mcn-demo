const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })

const config = {
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  cacheTtl: Number(process.env.CACHE_TTL || 60),
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'yinyouguo-demo-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || path.join(__dirname, 'logs'),
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 7),
  wx: {
    appId: process.env.WX_APPID || '',
    appSecret: process.env.WX_APPSECRET || '',
    mock: process.env.WX_MOCK === '1'
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'teacher_mcn',
    connectionLimit: Number(process.env.DB_POOL || 10),
    charset: 'utf8mb4'
  }
}

module.exports = config
