const { maskPhone } = require('../formatters')
const { hashPassword } = require('../auth')
const courseSeed = require('../data/courses')

function cloneTeacher(teacher) {
  return {
    ...teacher,
    status: teacher.status === undefined ? 1 : Number(teacher.status),
    tags: [...teacher.tags],
    highlights: [...teacher.highlights],
    courses: [...teacher.courses]
  }
}

function memoryCourseStatus(course) {
  const start = new Date(course.startAt).getTime()
  const end = start + (Number(course.durationMin) || 60) * 60 * 1000
  const now = Date.now()
  if (now < start) return 0
  if (now < end) return 1
  return 2
}

function sortCourses(list) {
  const weight = { 1: 0, 0: 1, 2: 2 }
  return list.sort((a, b) => {
    const diff = (weight[a.status] ?? 3) - (weight[b.status] ?? 3)
    if (diff !== 0) return diff
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    createdAt: user.createdAt
  }
}

function createMemoryRepository(seed) {
  const teachers = seed.map(cloneTeacher)
  const bookings = []
  const favorites = []
  const users = []
  let nextBookingId = 1
  let nextUserId = 1
  let nextTeacherId = Math.max(0, ...teachers.map(item => item.id)) + 1

  const courses = courseSeed.map(item => ({
    id: item.id,
    title: item.title,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    cover: item.cover || '',
    startAt: new Date(Date.now() + item.startOffsetMin * 60 * 1000).toISOString(),
    durationMin: item.durationMin,
    platform: item.platform,
    quota: item.quota,
    enrolled: item.enrolled,
    intro: item.intro,
    createdAt: new Date().toISOString()
  }))
  const enrollments = []
  const notifications = []
  let nextNotificationId = 1

  function addUser({ username, nickname, password, role = 'user', openid = null, unionid = null }) {
    const user = {
      id: nextUserId++,
      username,
      nickname: nickname || username,
      passwordHash: hashPassword(password),
      role,
      openid,
      unionid,
      avatarUrl: '',
      createdAt: new Date().toISOString()
    }
    users.push(user)
    return publicUser(user)
  }

  addUser({ username: 'admin', nickname: '运营管理员', password: 'admin123', role: 'admin' })
  const demoStudent = addUser({ username: 'student', nickname: '演示学员', password: 'student123' })
  for (const teacherId of [1, 9, 12]) {
    favorites.push({
      userId: demoStudent.id,
      teacherId,
      createdAt: new Date().toISOString()
    })
  }

  for (const courseId of [1, 2]) {
    enrollments.push({
      userId: demoStudent.id,
      courseId,
      createdAt: new Date().toISOString()
    })
  }

  for (const item of [
    {
      type: 'system',
      title: '欢迎加入有因有果',
      content: '这里可以收藏名师、预约咨询、报名直播课，祝你找到最合适的老师。',
      relatedId: null,
      isRead: false
    },
    {
      type: 'booking',
      title: '预约已确认',
      content: '你向上交大小明老师发起的预约已由运营老师联系，请留意来电。',
      relatedId: 2,
      isRead: false
    },
    {
      type: 'course',
      title: '直播即将开始',
      content: '《初中作文高分技巧直播》正在直播中，点击课程页即可进入。',
      relatedId: 2,
      isRead: true
    }
  ]) {
    notifications.push({
      id: nextNotificationId++,
      userId: demoStudent.id,
      ...item,
      createdAt: new Date().toISOString()
    })
  }

  function matchCategory(teacher, category) {
    if (category === '全部') return true
    if (category === '小初') {
      return teacher.tags.includes('小学') || teacher.tags.includes('初中')
    }
    return teacher.tags.includes(category)
  }

  function matchKeyword(teacher, keyword) {
    if (!keyword) return true
    const text = [teacher.name, teacher.title, teacher.intro, teacher.tags.join(' ')]
      .join(' ')
      .toLowerCase()
    return text.includes(keyword.toLowerCase())
  }

  function mapCourse(item, userId = null) {
    const quota = Number(item.quota) || 0
    const enrolled = Number(item.enrolled) || 0
    const status = memoryCourseStatus(item)

    return {
      id: item.id,
      title: item.title,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      cover: item.cover || '',
      startAt: item.startAt,
      durationMin: Number(item.durationMin) || 60,
      platform: item.platform,
      quota,
      enrolled,
      remaining: Math.max(0, quota - enrolled),
      intro: item.intro || '',
      status,
      enrolledByMe: userId
        ? enrollments.some(row => row.userId === userId && row.courseId === item.id)
        : false,
      createdAt: item.createdAt
    }
  }

  return {
    mode: 'memory',

    async listTeachers({ category, keyword, page, pageSize }) {
      const active = teachers.filter(teacher => Number(teacher.status) !== 0)
      const filtered = active
        .filter(teacher => matchCategory(teacher, category) && matchKeyword(teacher, keyword))
        .sort((a, b) => b.fans - a.fans || a.id - b.id)

      const summary = active.reduce(
        (acc, teacher) => ({
          teacherCount: acc.teacherCount + 1,
          totalFans: acc.totalFans + teacher.fans
        }),
        { teacherCount: 0, totalFans: 0 }
      )

      return {
        list: filtered.slice((page - 1) * pageSize, page * pageSize).map(cloneTeacher),
        total: filtered.length,
        summary
      }
    },

    async getTeacher(id) {
      const teacher = teachers.find(item => item.id === id && Number(item.status) !== 0)
      return teacher ? cloneTeacher(teacher) : null
    },

    async createBooking(data) {
      const row = {
        id: nextBookingId++,
        clientId: data.clientId,
        userId: data.userId || null,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        name: data.name,
        phone: data.phone,
        stage: data.stage,
        remark: data.remark,
        status: 0,
        createdAt: new Date().toISOString()
      }
      bookings.unshift(row)
      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt
      }
    },

    async listBookings(clientId, userId = null) {
      return bookings
        .filter(item => item.clientId === clientId || (userId && item.userId === userId))
        .slice(0, 50)
        .map(item => ({
          ...item,
          phone: maskPhone(item.phone)
        }))
    },

    async cancelBooking(id, clientId, userId = null) {
      const booking = bookings.find(
        item =>
          item.id === id &&
          (item.clientId === clientId || (userId && item.userId === userId)) &&
          item.status === 0
      )
      if (!booking) return false
      booking.status = 2
      return true
    },

    async listAllBookings(status) {
      return bookings
        .filter(item => status === null || status === undefined || item.status === status)
        .slice(0, 200)
        .map(item => ({ ...item }))
    },

    async getBookingById(id) {
      const booking = bookings.find(item => item.id === id)
      return booking ? { ...booking } : null
    },

    async updateBookingStatus(id, toStatus) {
      const booking = bookings.find(item => item.id === id && item.status === 0)
      if (!booking) return false
      booking.status = toStatus
      return true
    },

    async createUser({ username, nickname, passwordHash, role = 'user' }) {
      const user = {
        id: nextUserId++,
        username,
        nickname: nickname || username,
        passwordHash,
        role,
        createdAt: new Date().toISOString()
      }
      users.push(user)
      return publicUser(user)
    },

    async findUserByUsername(username) {
      const user = users.find(item => item.username === username)
      return user ? { ...publicUser(user), passwordHash: user.passwordHash } : null
    },

    async findUserById(id) {
      const user = users.find(item => item.id === id)
      return user ? publicUser(user) : null
    },

    async findUserByOpenid(openid) {
      const user = users.find(item => item.openid === openid)
      return user ? { ...publicUser(user), openid: user.openid } : null
    },

    async createWxUser({ username, nickname, passwordHash, openid, unionid = null, avatarUrl = '' }) {
      const user = {
        id: nextUserId++,
        username,
        nickname: nickname || username,
        passwordHash,
        role: 'user',
        openid,
        unionid,
        avatarUrl,
        createdAt: new Date().toISOString()
      }
      users.push(user)
      return publicUser(user)
    },

    async listFavoriteTeachers(userId) {
      return favorites
        .filter(item => item.userId === userId)
        .map(item => {
          const teacher = teachers.find(t => t.id === item.teacherId)
          return teacher ? { ...cloneTeacher(teacher), favoritedAt: item.createdAt } : null
        })
        .filter(Boolean)
    },

    async listFavoriteIds(userId) {
      return favorites.filter(item => item.userId === userId).map(item => item.teacherId)
    },

    async addFavorite(userId, teacherId) {
      const exists = favorites.some(
        item => item.userId === userId && item.teacherId === teacherId
      )
      if (!exists) {
        favorites.push({ userId, teacherId, createdAt: new Date().toISOString() })
      }
      return true
    },

    async removeFavorite(userId, teacherId) {
      const index = favorites.findIndex(
        item => item.userId === userId && item.teacherId === teacherId
      )
      if (index < 0) return false
      favorites.splice(index, 1)
      return true
    },

    async listCourses({ userId = null } = {}) {
      return sortCourses(courses.map(item => mapCourse(item, userId)))
    },

    async getCourse(id, userId = null) {
      const course = courses.find(item => item.id === id)
      return course ? mapCourse(course, userId) : null
    },

    async enrollCourse(userId, courseId) {
      const course = courses.find(item => item.id === courseId)
      if (!course) return { ok: false, reason: 'not_found' }
      if (memoryCourseStatus(course) === 2) return { ok: false, reason: 'ended' }

      const exists = enrollments.some(
        item => item.userId === userId && item.courseId === courseId
      )
      if (exists) return { ok: true, already: true }
      if (course.enrolled >= course.quota) return { ok: false, reason: 'full' }

      enrollments.push({ userId, courseId, createdAt: new Date().toISOString() })
      course.enrolled += 1
      return { ok: true, already: false }
    },

    async cancelCourseEnrollment(userId, courseId) {
      const index = enrollments.findIndex(
        item => item.userId === userId && item.courseId === courseId
      )
      if (index < 0) return false

      enrollments.splice(index, 1)
      const course = courses.find(item => item.id === courseId)
      if (course) course.enrolled = Math.max(0, course.enrolled - 1)
      return true
    },

    async listMyCourses(userId) {
      const mine = courses.filter(item =>
        enrollments.some(row => row.userId === userId && row.courseId === item.id)
      )
      return sortCourses(mine.map(item => mapCourse(item, userId)))
    },

    async createNotification({ userId, type = 'system', title, content, relatedId = null }) {
      if (!userId) return null
      const row = {
        id: nextNotificationId++,
        userId,
        type,
        title,
        content: content || '',
        relatedId,
        isRead: false,
        createdAt: new Date().toISOString()
      }
      notifications.unshift(row)
      return { id: row.id }
    },

    async listNotifications(userId, { page = 1, pageSize = 20 } = {}) {
      const mine = notifications.filter(item => item.userId === userId)
      return {
        list: mine
          .slice((page - 1) * pageSize, page * pageSize)
          .map(item => ({ ...item })),
        total: mine.length
      }
    },

    async countUnreadNotifications(userId) {
      return notifications.filter(item => item.userId === userId && !item.isRead).length
    },

    async markNotificationRead(userId, id) {
      const item = notifications.find(row => row.id === id && row.userId === userId)
      if (!item) return false
      item.isRead = true
      return true
    },

    async markAllNotificationsRead(userId) {
      let count = 0
      for (const item of notifications) {
        if (item.userId === userId && !item.isRead) {
          item.isRead = true
          count += 1
        }
      }
      return count
    },

    async cleanupReadNotifications(days = 30) {
      const expireAt = Date.now() - days * 24 * 3600 * 1000
      let removed = 0
      for (let i = notifications.length - 1; i >= 0; i -= 1) {
        const item = notifications[i]
        if (item.isRead && new Date(item.createdAt).getTime() < expireAt) {
          notifications.splice(i, 1)
          removed += 1
        }
      }
      return removed
    },

    async getAdminStats() {
      const pad = value => String(value).padStart(2, '0')
      const dayKey = date =>
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      const todayKey = dayKey(new Date())

      const trend = []
      const trendMap = new Map()
      for (const item of bookings) {
        const key = dayKey(new Date(item.createdAt))
        trendMap.set(key, (trendMap.get(key) || 0) + 1)
      }
      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const key = dayKey(date)
        trend.push({ date: key, count: trendMap.get(key) || 0 })
      }

      const activeTeachers = teachers.filter(item => Number(item.status) !== 0)
      return {
        bookings: {
          total: bookings.length,
          pending: bookings.filter(item => item.status === 0).length,
          today: bookings.filter(item => dayKey(new Date(item.createdAt)) === todayKey).length
        },
        users: users.length,
        favorites: favorites.length,
        teachers: { total: teachers.length, active: activeTeachers.length },
        topTeachers: [...activeTeachers]
          .sort((a, b) => b.fans - a.fans)
          .slice(0, 5)
          .map(item => ({
            id: item.id,
            name: item.name,
            subject: item.subject,
            stage: item.stage,
            fans: item.fans
          })),
        trend
      }
    },

    async listAllTeachers() {
      return [...teachers]
        .sort((a, b) => Number(b.status) - Number(a.status) || b.fans - a.fans)
        .map(cloneTeacher)
    },

    async getTeacherAdmin(id) {
      const teacher = teachers.find(item => item.id === id)
      return teacher ? cloneTeacher(teacher) : null
    },

    async createTeacher(data) {
      const teacher = {
        id: nextTeacherId++,
        name: data.name,
        title: data.title || '',
        stage: data.stage || '其他',
        subject: data.subject || '',
        tags: data.tags || [],
        fans: data.fans || 0,
        avatar: data.avatar || '',
        intro: data.intro || '',
        highlights: data.highlights || [],
        courses: data.courses || [],
        years: data.years || 0,
        status: data.status === undefined ? 1 : data.status
      }
      teachers.push(teacher)
      return cloneTeacher(teacher)
    },

    async updateTeacher(id, data) {
      const teacher = teachers.find(item => item.id === id)
      if (!teacher) return null

      const fields = [
        'name',
        'title',
        'stage',
        'subject',
        'tags',
        'fans',
        'avatar',
        'intro',
        'highlights',
        'courses',
        'years',
        'status'
      ]
      for (const key of fields) {
        if (data[key] !== undefined) teacher[key] = data[key]
      }
      return cloneTeacher(teacher)
    }
  }
}

module.exports = createMemoryRepository
