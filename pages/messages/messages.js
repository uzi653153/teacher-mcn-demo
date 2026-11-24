const request = require('../../utils/request')
const { formatDate } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

const TYPE_MAP = {
  booking: { text: '预约', className: 'type--booking' },
  course: { text: '课程', className: 'type--course' },
  system: { text: '系统', className: 'type--system' }
}

function decorate(item) {
  const type = TYPE_MAP[item.type] || TYPE_MAP.system
  return {
    ...item,
    typeText: type.text,
    typeClass: type.className,
    timeText: formatDate(item.createdAt)
  }
}

Page({
  data: {
    list: [],
    loading: true,
    loadingMore: false,
    error: '',
    unread: 0,
    page: 1,
    hasMore: false
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.fetchList({ reset: true })
  },

  onPullDownRefresh() {
    this.fetchList({ reset: true, fromPullDown: true })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.fetchList({ page: this.data.page + 1 })
  },

  fetchList({ reset = false, page = 1, fromPullDown = false } = {}) {
    if (reset) {
      this.setData({ loading: true, error: '' })
    } else {
      this.setData({ loadingMore: true })
    }

    request
      .get('/api/notifications', { page, pageSize: 20 })
      .then(data => {
        const incoming = (data.list || []).map(decorate)
        const list = reset ? incoming : this.data.list.concat(incoming)

        this.setData({
          list,
          unread: data.unread || 0,
          page: data.pagination ? data.pagination.page : page,
          hasMore: Boolean(data.pagination && data.pagination.hasMore),
          loading: false,
          loadingMore: false
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(err => {
        this.setData({
          loading: false,
          loadingMore: false,
          error: reset ? err.message || '消息加载失败' : this.data.error
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  onRead(e) {
    const id = Number(e.currentTarget.dataset.id)
    const index = this.data.list.findIndex(item => item.id === id)
    if (index < 0 || this.data.list[index].isRead) return

    request
      .patch(`/api/notifications/${id}/read`)
      .then(() => {
        this.setData({
          [`list[${index}].isRead`]: true,
          unread: Math.max(0, this.data.unread - 1)
        })
      })
      .catch(() => {})
  },

  onReadAll() {
    if (!this.data.unread) return

    request
      .patch('/api/notifications/read-all')
      .then(data => {
        const list = this.data.list.map(item => ({ ...item, isRead: true }))
        this.setData({ list, unread: 0 })
        wx.showToast({ title: '已全部标记已读', icon: 'none' })
      })
      .catch(err => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' })
      })
  },

  onTapItem(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.list.find(row => row.id === id)
    if (!item) return

    if (!item.isRead) {
      this.onRead(e)
    }

    if (item.type === 'course' && item.relatedId) {
      wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${item.relatedId}` })
      return
    }

    if (item.type === 'booking') {
      wx.switchTab({ url: '/pages/my/my' })
    }
  },

  onRetry() {
    this.fetchList({ reset: true })
  }
})
