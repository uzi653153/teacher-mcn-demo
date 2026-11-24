const { parseList, maskPhone } = require('../formatters')

function mapTeacher(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title || '',
    stage: row.stage || '',
    subject: row.subject || '',
    tags: parseList(row.tags),
    fans: Number(row.fans) || 0,
    avatar: row.avatar || '',
    intro: row.intro || '',
    highlights: parseList(row.highlights),
    courses: parseList(row.courses),
    years: Number(row.years) || 0,
    status: row.status === undefined ? 1 : Number(row.status)
  }
}

function buildFilters({ category, keyword }) {
  const conditions = []
  const params = []

  if (category === '早教') {
    conditions.push('tags LIKE ?')
    params.push('%"早教"%')
  } else if (category === '小初') {
    conditions.push('(tags LIKE ? OR tags LIKE ?)')
    params.push('%"小学"%', '%"初中"%')
  } else if (category === '高中') {
    conditions.push('tags LIKE ?')
    params.push('%"高中"%')
  }

  if (keyword) {
    conditions.push('(name LIKE ? OR title LIKE ? OR tags LIKE ? OR intro LIKE ?)')
    const like = `%${keyword}%`
    params.push(like, like, like, like)
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname || row.username,
    role: row.role,
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at
  }
}

function mapBooking(row, { mask = true } = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    name: row.name,
    phone: mask ? maskPhone(row.phone) : row.phone,
    stage: row.stage,
    remark: row.remark,
    status: row.status,
    createdAt: row.created_at
  }
}

function courseStatus(row) {
  const start = new Date(row.start_at).getTime()
  const end = start + (Number(row.duration_min) || 60) * 60 * 1000
  const now = Date.now()
  if (now < start) return 0
  if (now < end) return 1
  return 2
}

function mapCourse(row) {
  const startAt = new Date(row.start_at)
  const quota = Number(row.quota) || 0
  const enrolled = Number(row.enrolled) || 0

  return {
    id: row.id,
    title: row.title,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    cover: row.cover || '',
    startAt: Number.isNaN(startAt.getTime()) ? '' : startAt.toISOString(),
    durationMin: Number(row.duration_min) || 60,
    platform: row.platform || '视频号',
    quota,
    enrolled,
    remaining: Math.max(0, quota - enrolled),
    intro: row.intro || '',
    status: courseStatus(row),
    enrolledByMe: Boolean(Number(row.is_enrolled)),
    createdAt: row.created_at
  }
}

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    relatedId: row.related_id,
    isRead: Boolean(Number(row.is_read)),
    createdAt: row.created_at
  }
}

function sortCourses(list) {
  const weight = { 1: 0, 0: 1, 2: 2 }
  return list.sort((a, b) => {
    const diff = (weight[a.status] ?? 3) - (weight[b.status] ?? 3)
    if (diff !== 0) return diff
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function createMysqlRepository(pool) {
  return {
    mode: 'mysql',

    async listTeachers({ category, keyword, page, pageSize }) {
      const { where, params } = buildFilters({ category, keyword })
      const scopedWhere = where ? `${where} AND status = 1` : 'WHERE status = 1'
      const offset = (page - 1) * pageSize

      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM teachers ${scopedWhere}`,
        params
      )
      const [rows] = await pool.query(
        `SELECT * FROM teachers ${scopedWhere} ORDER BY fans DESC, id ASC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      )
      const [[summary]] = await pool.query(
        'SELECT COUNT(*) AS teacherCount, COALESCE(SUM(fans), 0) AS totalFans FROM teachers WHERE status = 1'
      )

      return {
        list: rows.map(mapTeacher),
        total: Number(countRow.total) || 0,
        summary: {
          teacherCount: Number(summary.teacherCount) || 0,
          totalFans: Number(summary.totalFans) || 0
        }
      }
    },

    async getTeacher(id) {
      const [rows] = await pool.query(
        'SELECT * FROM teachers WHERE id = ? AND status = 1 LIMIT 1',
        [id]
      )
      return rows.length ? mapTeacher(rows[0]) : null
    },

    async createBooking(data) {
      const [result] = await pool.query('INSERT INTO bookings SET ?', [
        {
          client_id: data.clientId,
          user_id: data.userId || null,
          teacher_id: data.teacherId,
          teacher_name: data.teacherName,
          name: data.name,
          phone: data.phone,
          stage: data.stage,
          remark: data.remark,
          status: 0
        }
      ])

      return {
        id: result.insertId,
        status: 0,
        createdAt: new Date().toISOString()
      }
    },

    async listBookings(clientId, userId = null) {
      const [rows] = userId
        ? await pool.query(
            'SELECT * FROM bookings WHERE client_id = ? OR user_id = ? ORDER BY id DESC LIMIT 50',
            [clientId, userId]
          )
        : await pool.query(
            'SELECT * FROM bookings WHERE client_id = ? ORDER BY id DESC LIMIT 50',
            [clientId]
          )

      return rows.map(row => mapBooking(row))
    },

    async cancelBooking(id, clientId, userId = null) {
      const [result] = userId
        ? await pool.query(
            'UPDATE bookings SET status = 2 WHERE id = ? AND (client_id = ? OR user_id = ?) AND status = 0',
            [id, clientId, userId]
          )
        : await pool.query(
            'UPDATE bookings SET status = 2 WHERE id = ? AND client_id = ? AND status = 0',
            [id, clientId]
          )
      return result.affectedRows > 0
    },

    async listAllBookings(status) {
      const [rows] =
        status === null || status === undefined
          ? await pool.query('SELECT * FROM bookings ORDER BY id DESC LIMIT 200')
          : await pool.query('SELECT * FROM bookings WHERE status = ? ORDER BY id DESC LIMIT 200', [
              status
            ])

      return rows.map(row => mapBooking(row, { mask: false }))
    },

    async getBookingById(id) {
      const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id])
      return rows.length ? mapBooking(rows[0], { mask: false }) : null
    },

    async updateBookingStatus(id, toStatus) {
      const [result] = await pool.query(
        'UPDATE bookings SET status = ? WHERE id = ? AND status = 0',
        [toStatus, id]
      )
      return result.affectedRows > 0
    },

    async createUser({ username, nickname, passwordHash, role = 'user' }) {
      const [result] = await pool.query('INSERT INTO users SET ?', [
        {
          username,
          nickname,
          password_hash: passwordHash,
          role
        }
      ])

      return {
        id: result.insertId,
        username,
        nickname: nickname || username,
        role
      }
    },

    async findUserByUsername(username) {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username])
      if (!rows.length) return null
      return { ...mapUser(rows[0]), passwordHash: rows[0].password_hash }
    },

    async findUserById(id) {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
      return rows.length ? mapUser(rows[0]) : null
    },

    async findUserByOpenid(openid) {
      const [rows] = await pool.query('SELECT * FROM users WHERE openid = ? LIMIT 1', [openid])
      if (!rows.length) return null
      return { ...mapUser(rows[0]), openid: rows[0].openid }
    },

    async createWxUser({ username, nickname, passwordHash, openid, unionid = null, avatarUrl = '' }) {
      const [result] = await pool.query('INSERT INTO users SET ?', [
        {
          username,
          nickname: nickname || username,
          password_hash: passwordHash,
          role: 'user',
          openid,
          unionid,
          avatar_url: avatarUrl
        }
      ])

      return {
        id: result.insertId,
        username,
        nickname: nickname || username,
        role: 'user',
        avatarUrl,
        openid,
        createdAt: new Date().toISOString()
      }
    },

    async listFavoriteTeachers(userId) {
      const [rows] = await pool.query(
        `SELECT t.*, f.created_at AS favorited_at
         FROM favorites f
         INNER JOIN teachers t ON t.id = f.teacher_id
         WHERE f.user_id = ?
         ORDER BY f.id DESC`,
        [userId]
      )

      return rows.map(row => ({ ...mapTeacher(row), favoritedAt: row.favorited_at }))
    },

    async listFavoriteIds(userId) {
      const [rows] = await pool.query(
        'SELECT teacher_id FROM favorites WHERE user_id = ? ORDER BY id DESC',
        [userId]
      )
      return rows.map(row => row.teacher_id)
    },

    async addFavorite(userId, teacherId) {
      await pool.query('INSERT IGNORE INTO favorites (user_id, teacher_id) VALUES (?, ?)', [
        userId,
        teacherId
      ])
      return true
    },

    async removeFavorite(userId, teacherId) {
      const [result] = await pool.query(
        'DELETE FROM favorites WHERE user_id = ? AND teacher_id = ?',
        [userId, teacherId]
      )
      return result.affectedRows > 0
    },

    async listCourses({ userId = null } = {}) {
      const [rows] = await pool.query(
        `SELECT c.*, (e.id IS NOT NULL) AS is_enrolled
         FROM courses c
         LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id <=> ?
         ORDER BY c.start_at ASC`,
        [userId]
      )
      return sortCourses(rows.map(mapCourse))
    },

    async getCourse(id, userId = null) {
      const [rows] = await pool.query(
        `SELECT c.*, (e.id IS NOT NULL) AS is_enrolled
         FROM courses c
         LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id <=> ?
         WHERE c.id = ?
         LIMIT 1`,
        [userId, id]
      )
      return rows.length ? mapCourse(rows[0]) : null
    },

    // 事务 + 行锁防止超卖
    async enrollCourse(userId, courseId) {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()

        const [[course]] = await conn.query(
          'SELECT id, quota, enrolled, start_at, duration_min FROM courses WHERE id = ? FOR UPDATE',
          [courseId]
        )

        if (!course) {
          await conn.rollback()
          return { ok: false, reason: 'not_found' }
        }

        const end =
          new Date(course.start_at).getTime() + (Number(course.duration_min) || 60) * 60000

        if (Date.now() >= end) {
          await conn.rollback()
          return { ok: false, reason: 'ended' }
        }

        const [existing] = await conn.query(
          'SELECT id FROM course_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
          [userId, courseId]
        )

        if (existing.length) {
          await conn.commit()
          return { ok: true, already: true }
        }

        if (Number(course.enrolled) >= Number(course.quota)) {
          await conn.rollback()
          return { ok: false, reason: 'full' }
        }

        await conn.query('INSERT INTO course_enrollments (user_id, course_id) VALUES (?, ?)', [
          userId,
          courseId
        ])
        await conn.query(
          'UPDATE courses SET enrolled = enrolled + 1 WHERE id = ? AND enrolled < quota',
          [courseId]
        )
        await conn.commit()
        return { ok: true, already: false }
      } catch (err) {
        try {
          await conn.rollback()
        } catch (e) {}
        throw err
      } finally {
        conn.release()
      }
    },

    async cancelCourseEnrollment(userId, courseId) {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const [result] = await conn.query(
          'DELETE FROM course_enrollments WHERE user_id = ? AND course_id = ?',
          [userId, courseId]
        )

        if (result.affectedRows > 0) {
          await conn.query(
            'UPDATE courses SET enrolled = GREATEST(enrolled - 1, 0) WHERE id = ?',
            [courseId]
          )
        }

        await conn.commit()
        return result.affectedRows > 0
      } catch (err) {
        try {
          await conn.rollback()
        } catch (e) {}
        throw err
      } finally {
        conn.release()
      }
    },

    async listMyCourses(userId) {
      const [rows] = await pool.query(
        `SELECT c.*, 1 AS is_enrolled
         FROM course_enrollments e
         INNER JOIN courses c ON c.id = e.course_id
         WHERE e.user_id = ?
         ORDER BY c.start_at ASC`,
        [userId]
      )
      return sortCourses(rows.map(mapCourse))
    },

    async createNotification({ userId, type = 'system', title, content, relatedId = null }) {
      if (!userId) return null
      const [result] = await pool.query('INSERT INTO notifications SET ?', [
        {
          user_id: userId,
          type,
          title,
          content: content || '',
          related_id: relatedId
        }
      ])
      return { id: result.insertId }
    },

    async listNotifications(userId, { page = 1, pageSize = 20 } = {}) {
      const offset = (page - 1) * pageSize
      const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
        [userId]
      )
      const [rows] = await pool.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
        [userId, pageSize, offset]
      )

      return {
        list: rows.map(mapNotification),
        total: Number(countRow.total) || 0
      }
    },

    async countUnreadNotifications(userId) {
      const [[row]] = await pool.query(
        'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      )
      return Number(row.total) || 0
    },

    async markNotificationRead(userId, id) {
      const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId]
      )
      return result.affectedRows > 0
    },

    async markAllNotificationsRead(userId) {
      const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
      )
      return result.affectedRows
    },

    async cleanupReadNotifications(days = 30) {
      const safeDays = Math.max(1, Math.min(365, Number.parseInt(days, 10) || 30))
      const [result] = await pool.query(
        `DELETE FROM notifications WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)`
      )
      return result.affectedRows
    },

    async getAdminStats() {
      const [[bookingRow]] = await pool.query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 0), 0) AS pending,
                COALESCE(SUM(DATE(created_at) = CURDATE()), 0) AS today
         FROM bookings`
      )
      const [[userRow]] = await pool.query('SELECT COUNT(*) AS total FROM users')
      const [[favoriteRow]] = await pool.query('SELECT COUNT(*) AS total FROM favorites')
      const [[teacherRow]] = await pool.query(
        'SELECT COUNT(*) AS total, COALESCE(SUM(status = 1), 0) AS active FROM teachers'
      )
      const [topTeachers] = await pool.query(
        'SELECT id, name, subject, stage, fans FROM teachers WHERE status = 1 ORDER BY fans DESC LIMIT 5'
      )
      const [trendRows] = await pool.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
         FROM bookings
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY day`
      )

      const trendMap = new Map(trendRows.map(row => [row.day, Number(row.count) || 0]))
      const trend = []
      const today = new Date()

      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
        const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        trend.push({ date: key, count: trendMap.get(key) || 0 })
      }

      return {
        bookings: {
          total: Number(bookingRow.total) || 0,
          pending: Number(bookingRow.pending) || 0,
          today: Number(bookingRow.today) || 0
        },
        users: Number(userRow.total) || 0,
        favorites: Number(favoriteRow.total) || 0,
        teachers: {
          total: Number(teacherRow.total) || 0,
          active: Number(teacherRow.active) || 0
        },
        topTeachers: topTeachers.map(row => ({
          id: row.id,
          name: row.name,
          subject: row.subject,
          stage: row.stage,
          fans: Number(row.fans) || 0
        })),
        trend
      }
    },

    async listAllTeachers() {
      const [rows] = await pool.query(
        'SELECT * FROM teachers ORDER BY status DESC, fans DESC, id ASC'
      )
      return rows.map(mapTeacher)
    },

    async getTeacherAdmin(id) {
      const [rows] = await pool.query('SELECT * FROM teachers WHERE id = ? LIMIT 1', [id])
      return rows.length ? mapTeacher(rows[0]) : null
    },

    async createTeacher(data) {
      const [result] = await pool.query('INSERT INTO teachers SET ?', [
        {
          name: data.name,
          title: data.title || '',
          stage: data.stage || '其他',
          subject: data.subject || '',
          tags: JSON.stringify(data.tags || []),
          fans: data.fans || 0,
          avatar: data.avatar || '',
          intro: data.intro || '',
          highlights: JSON.stringify(data.highlights || []),
          courses: JSON.stringify(data.courses || []),
          years: data.years || 0,
          status: data.status === undefined ? 1 : data.status
        }
      ])

      return this.getTeacherAdmin(result.insertId)
    },

    async updateTeacher(id, data) {
      const columns = {
        name: 'name',
        title: 'title',
        stage: 'stage',
        subject: 'subject',
        fans: 'fans',
        avatar: 'avatar',
        intro: 'intro',
        years: 'years',
        status: 'status'
      }
      const row = {}

      for (const [key, column] of Object.entries(columns)) {
        if (data[key] !== undefined) row[column] = data[key]
      }
      if (data.tags !== undefined) row.tags = JSON.stringify(data.tags)
      if (data.highlights !== undefined) row.highlights = JSON.stringify(data.highlights)
      if (data.courses !== undefined) row.courses = JSON.stringify(data.courses)

      if (!Object.keys(row).length) return null

      await pool.query('UPDATE teachers SET ? WHERE id = ?', [row, id])
      return this.getTeacherAdmin(id)
    }
  }
}

module.exports = createMysqlRepository
