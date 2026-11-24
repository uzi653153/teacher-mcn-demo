const config = require('./config')

const AVATAR_COLORS = [
  '#2B4ACB',
  '#7A5AF8',
  '#0BA5EC',
  '#12B76A',
  '#F79009',
  '#EE46BC',
  '#0E9384',
  '#E31B54'
]

function formatFans(value) {
  const num = Number(value) || 0
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return String(num)
}

function formatDate(input) {
  if (!input) return ''
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function decorateTeacher(teacher = {}) {
  const name = teacher.name || ''
  const id = Number(teacher.id) || 0

  return {
    ...teacher,
    tags: teacher.tags || [],
    highlights: teacher.highlights || [],
    courses: teacher.courses || [],
    fansText: formatFans(teacher.fans),
    initial: name.slice(0, 1),
    avatarColor: AVATAR_COLORS[id % AVATAR_COLORS.length]
  }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function assetUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return config.baseUrl + (url.charAt(0) === '/' ? url : `/${url}`)
}

const COURSE_STATUS = {
  0: { text: '预告', className: 'course-status--upcoming' },
  1: { text: '直播中', className: 'course-status--live' },
  2: { text: '已结束', className: 'course-status--ended' }
}

function formatCourseTime(input) {
  if (!input) return ''
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const startOfDay = value =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000)
  const hm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

  if (diffDays === 0) return `今天 ${hm}`
  if (diffDays === 1) return `明天 ${hm}`
  if (diffDays === -1) return `昨天 ${hm}`
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${hm}`
}

function decorateCourse(course = {}) {
  const status = COURSE_STATUS[course.status] || COURSE_STATUS[0]
  const quota = Number(course.quota) || 0
  const enrolled = Number(course.enrolled) || 0
  const progress = quota ? Math.min(100, Math.round((enrolled / quota) * 100)) : 0
  const remaining = Math.max(0, quota - enrolled)
  const enrolledByMe = Boolean(course.enrolledByMe)
  const canEnroll = !enrolledByMe && course.status !== 2 && remaining > 0

  let actionText = '立即报名'
  if (enrolledByMe) actionText = '已报名'
  else if (course.status === 2) actionText = '已结束'
  else if (remaining <= 0) actionText = '名额已满'

  return {
    ...course,
    statusText: status.text,
    statusClass: status.className,
    timeText: formatCourseTime(course.startAt),
    coverUrl: assetUrl(course.cover),
    titleInitial: String(course.title || '').slice(0, 1),
    teacherInitial: String(course.teacherName || '').slice(0, 1),
    progress,
    quotaText: `${enrolled}/${quota}`,
    remaining,
    enrolledByMe,
    canEnroll,
    actionText
  }
}

module.exports = {
  formatFans,
  formatDate,
  formatCourseTime,
  assetUrl,
  decorateTeacher,
  decorateCourse,
  COURSE_STATUS
}
