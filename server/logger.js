const fs = require('fs')
const path = require('path')
const config = require('./config')

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const minLevel = LEVELS[config.logLevel] || LEVELS.info
const logDir = config.logDir

fs.mkdirSync(logDir, { recursive: true })

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function cleanup() {
  const expireAt = Date.now() - config.logRetentionDays * 24 * 60 * 60 * 1000

  try {
    for (const name of fs.readdirSync(logDir)) {
      if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue

      const file = path.join(logDir, name)
      if (fs.statSync(file).mtimeMs < expireAt) {
        fs.unlinkSync(file)
      }
    }
  } catch (err) {
    console.error('[logger] 清理过期日志失败:', err.message)
  }
}

cleanup()

function write(level, moduleName, message, meta = {}) {
  if (LEVELS[level] < minLevel) return

  const now = new Date()
  const entry = {
    time: now.toISOString(),
    level,
    module: moduleName,
    message,
    ...meta
  }

  try {
    fs.appendFileSync(path.join(logDir, `app-${dayKey(now)}.log`), JSON.stringify(entry) + '\n')
  } catch (err) {
    console.error('[logger] 写入日志失败:', err.message)
  }

  const suffix = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  const line = `${formatTime(now)} ${level.toUpperCase()} [${moduleName}] ${message}${suffix}`

  if (level === 'error') {
    console.error(line)
    if (meta.stack) console.error(meta.stack)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

function createLogger(moduleName) {
  return {
    debug: (message, meta) => write('debug', moduleName, message, meta),
    info: (message, meta) => write('info', moduleName, message, meta),
    warn: (message, meta) => write('warn', moduleName, message, meta),
    error: (message, meta) => write('error', moduleName, message, meta)
  }
}

module.exports = { createLogger }
