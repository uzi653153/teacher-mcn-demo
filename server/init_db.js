const mysql = require('mysql2/promise')
const config = require('./config')
const teachers = require('./data/teachers')
const courses = require('./data/courses')
const { hashPassword } = require('./auth')

const SEED_USERS = [
  {
    id: 1,
    username: 'admin',
    nickname: '运营管理员',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    username: 'student',
    nickname: '演示学员',
    password: 'student123',
    role: 'user'
  }
]

const SEED_FAVORITES = [
  { userId: 2, teacherId: 1 },
  { userId: 2, teacherId: 9 },
  { userId: 2, teacherId: 12 }
]

const SEED_ENROLLMENTS = [
  { userId: 2, courseId: 1 },
  { userId: 2, courseId: 2 }
]

const SEED_NOTIFICATIONS = [
  {
    userId: 2,
    type: 'system',
    title: '欢迎加入有因有果',
    content: '这里可以收藏名师、预约咨询、报名直播课，祝你找到最合适的老师。',
    relatedId: null,
    isRead: 0
  },
  {
    userId: 2,
    type: 'booking',
    title: '预约已确认',
    content: '你向上交大小明老师发起的预约已由运营老师联系，请留意来电。',
    relatedId: 2,
    isRead: 0
  },
  {
    userId: 2,
    type: 'course',
    title: '直播即将开始',
    content: '《初中作文高分技巧直播》正在直播中，点击课程页即可进入。',
    relatedId: 2,
    isRead: 1
  }
]

const SEED_BOOKINGS = [
  {
    clientId: 'demo_client_001',
    teacherId: 1,
    teacherName: '汤圆老师',
    name: '李同学',
    phone: '13800000001',
    stage: '小学',
    remark: '想咨询小学阅读理解课程安排',
    status: 0
  },
  {
    clientId: 'demo_client_001',
    teacherId: 12,
    teacherName: '上交大小明老师',
    name: '李同学',
    phone: '13800000001',
    stage: '高中',
    remark: '高三数学冲刺，希望安排试听',
    status: 1
  }
]

async function main() {
  const { database, ...connConfig } = config.db
  const conn = await mysql.createConnection(connConfig)

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    await conn.query(`USE \`${database}\``)

    console.log('[init] 清空并重建数据表...')
    await conn.query('DROP TABLE IF EXISTS notifications')
    await conn.query('DROP TABLE IF EXISTS course_enrollments')
    await conn.query('DROP TABLE IF EXISTS courses')
    await conn.query('DROP TABLE IF EXISTS favorites')
    await conn.query('DROP TABLE IF EXISTS bookings')
    await conn.query('DROP TABLE IF EXISTS teachers')
    await conn.query('DROP TABLE IF EXISTS users')

    await conn.query(`
      CREATE TABLE users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(32) NOT NULL,
        nickname VARCHAR(32) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('user','admin') NOT NULL DEFAULT 'user',
        openid VARCHAR(64) NULL,
        unionid VARCHAR(64) NULL,
        avatar_url VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_username (username),
        UNIQUE KEY uk_openid (openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE teachers (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(64) NOT NULL,
        title VARCHAR(128) NOT NULL DEFAULT '',
        stage VARCHAR(16) NOT NULL DEFAULT '',
        subject VARCHAR(32) NOT NULL DEFAULT '',
        tags TEXT NOT NULL,
        fans BIGINT UNSIGNED NOT NULL DEFAULT 0,
        avatar VARCHAR(255) NOT NULL DEFAULT '',
        intro VARCHAR(500) NOT NULL DEFAULT '',
        highlights TEXT NOT NULL,
        courses TEXT NOT NULL,
        years TINYINT UNSIGNED NOT NULL DEFAULT 0,
        status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1上架 0下架',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_name (name),
        KEY idx_fans (fans),
        KEY idx_stage (stage),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE favorites (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        teacher_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_teacher (user_id, teacher_id),
        KEY idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE bookings (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        client_id VARCHAR(64) NOT NULL,
        user_id INT UNSIGNED NULL,
        teacher_id INT UNSIGNED NOT NULL,
        teacher_name VARCHAR(64) NOT NULL,
        name VARCHAR(32) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        stage VARCHAR(16) NOT NULL DEFAULT '其他',
        remark VARCHAR(255) NOT NULL DEFAULT '',
        status TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0待联系 1已联系 2已取消',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_client (client_id),
        KEY idx_teacher (teacher_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE courses (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(120) NOT NULL,
        teacher_id INT UNSIGNED NOT NULL,
        teacher_name VARCHAR(64) NOT NULL,
        cover VARCHAR(255) NOT NULL DEFAULT '',
        start_at DATETIME NOT NULL,
        duration_min SMALLINT UNSIGNED NOT NULL DEFAULT 60,
        platform VARCHAR(32) NOT NULL DEFAULT '视频号',
        quota INT UNSIGNED NOT NULL DEFAULT 100,
        enrolled INT UNSIGNED NOT NULL DEFAULT 0,
        intro VARCHAR(500) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_start (start_at),
        KEY idx_teacher (teacher_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE course_enrollments (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        course_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_course (user_id, course_id),
        KEY idx_course (course_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await conn.query(`
      CREATE TABLE notifications (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        type VARCHAR(24) NOT NULL DEFAULT 'system',
        title VARCHAR(120) NOT NULL,
        content VARCHAR(500) NOT NULL DEFAULT '',
        related_id INT UNSIGNED NULL,
        is_read TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_read (user_id, is_read),
        KEY idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const teacherValues = teachers.map(item => [
      item.id,
      item.name,
      item.title,
      item.stage,
      item.subject,
      JSON.stringify(item.tags),
      item.fans,
      item.avatar || '',
      item.intro,
      JSON.stringify(item.highlights),
      JSON.stringify(item.courses),
      item.years
    ])

    await conn.query(
      `INSERT INTO teachers
        (id, name, title, stage, subject, tags, fans, avatar, intro, highlights, courses, years)
       VALUES ?`,
      [teacherValues]
    )

    const userValues = SEED_USERS.map(item => [
      item.id,
      item.username,
      item.nickname,
      hashPassword(item.password),
      item.role
    ])

    await conn.query(
      'INSERT INTO users (id, username, nickname, password_hash, role) VALUES ?',
      [userValues]
    )

    const favoriteValues = SEED_FAVORITES.map(item => [item.userId, item.teacherId])
    await conn.query(
      'INSERT INTO favorites (user_id, teacher_id) VALUES ?',
      [favoriteValues]
    )

    const bookingValues = SEED_BOOKINGS.map(item => [
      item.clientId,
      item.teacherId,
      item.teacherName,
      item.name,
      item.phone,
      item.stage,
      item.remark,
      item.status
    ])

    await conn.query(
      `INSERT INTO bookings
        (client_id, teacher_id, teacher_name, name, phone, stage, remark, status)
       VALUES ?`,
      [bookingValues]
    )

    const now = Date.now()
    const courseValues = courses.map(item => [
      item.id,
      item.title,
      item.teacherId,
      item.teacherName,
      item.cover || '',
      new Date(now + item.startOffsetMin * 60 * 1000),
      item.durationMin,
      item.platform,
      item.quota,
      item.enrolled,
      item.intro
    ])

    await conn.query(
      `INSERT INTO courses
        (id, title, teacher_id, teacher_name, cover, start_at, duration_min, platform, quota, enrolled, intro)
       VALUES ?`,
      [courseValues]
    )

    await conn.query('INSERT INTO course_enrollments (user_id, course_id) VALUES ?', [
      SEED_ENROLLMENTS.map(item => [item.userId, item.courseId])
    ])

    await conn.query(
      `INSERT INTO notifications (user_id, type, title, content, related_id, is_read)
       VALUES ?`,
      [
        SEED_NOTIFICATIONS.map(item => [
          item.userId,
          item.type,
          item.title,
          item.content,
          item.relatedId,
          item.isRead
        ])
      ]
    )

    console.log(`[init] 完成: ${config.db.host}:${config.db.port}/${database}`)
    console.log(`[init] 名师 ${teachers.length} 条，演示预约 ${SEED_BOOKINGS.length} 条`)
    console.log(`[init] 用户 ${SEED_USERS.length} 个，演示收藏 ${SEED_FAVORITES.length} 条`)
    console.log(
      `[init] 直播课 ${courses.length} 场，报名 ${SEED_ENROLLMENTS.length} 条，通知 ${SEED_NOTIFICATIONS.length} 条`
    )
    console.log('[init] 管理员: admin / admin123，演示用户: student / student123')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('[init] 初始化失败:', err.message)
  process.exit(1)
})
