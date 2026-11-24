const mysql = require('mysql2/promise')
const config = require('./config')

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 0
})

async function ping() {
  try {
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    return true
  } catch (err) {
    return false
  }
}

async function hasRequiredTables() {
  try {
    const tables = [
      'teachers',
      'bookings',
      'users',
      'favorites',
      'courses',
      'course_enrollments',
      'notifications'
    ]
    for (const table of tables) {
      const [rows] = await pool.query('SHOW TABLES LIKE ?', [table])
      if (!rows.length) return false
    }
    return true
  } catch (err) {
    return false
  }
}

module.exports = {
  pool,
  ping,
  hasRequiredTables
}
