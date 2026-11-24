const request = require('../../utils/request')
const { isAdmin, clearAuth } = require('../../utils/auth')
const { formatDate } = require('../../utils/format')

const STATUS_MAP = {
  0: { text: '待联系', className: 'status--pending' },
  1: { text: '已联系', className: 'status--done' },
  2: { text: '已取消', className: 'status--cancel' }
}

Page({
  data: {
    tabs: [
      { value: 'all', label: '全部' },
      { value: '0', label: '待联系' },
      { value: '1', label: '已联系' },
      { value: '2', label: '已取消' }
    ],
    filter: 'all',
    list: [],
    loading: true,
    error: '',
    actingId: 0
  },

  onShow() {
    if (!isAdmin()) {
      this.setData({ loading: false, error: '当前账号没有管理员权限' })
      return
    }
    this.fetchList()
  },

  fetchList() {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/admin/bookings', { status: this.data.filter })
      .then(data => {
        const list = (data.list || []).map(item => {
          const status = STATUS_MAP[item.status] || STATUS_MAP[0]

          return {
            ...item,
            initial: (item.teacherName || '').slice(0, 1),
            timeText: formatDate(item.createdAt),
            statusText: status.text,
            statusClass: status.className,
            canAct: item.status === 0
          }
        })

        this.setData({ list, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '预约列表加载失败' })
      })
  },

  onFilter(e) {
    const filter = e.currentTarget.dataset.value
    if (filter === this.data.filter) return
    this.setData({ filter })
    this.fetchList()
  },

  onContact(e) {
    this.changeStatus(e.currentTarget.dataset.id, 1, '确认已联系该学员？')
  },

  onCancel(e) {
    this.changeStatus(e.currentTarget.dataset.id, 2, '确认取消这条预约？')
  },

  changeStatus(id, status, content) {
    if (this.data.actingId) return
    const that = this

    wx.showModal({
      title: '预约状态',
      content,
      success(res) {
        if (!res.confirm) return

        that.setData({ actingId: id })

        request
          .patch(`/api/admin/bookings/${id}/status`, { status })
          .then(() => {
            that.setData({ actingId: 0 })
            wx.showToast({ title: status === 1 ? '已标记已联系' : '已取消', icon: 'success' })
            that.fetchList()
          })
          .catch(err => {
            that.setData({ actingId: 0 })
            wx.showToast({ title: err.message || '操作失败', icon: 'none' })
          })
      }
    })
  },

  onRetry() {
    this.fetchList()
  },

  onReset() {
    this.setData({ filter: 'all' })
    this.fetchList()
  },

  onLogout() {
    const that = this

    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能管理预约',
      success(res) {
        if (!res.confirm) return

        clearAuth()
        getApp().globalData.user = null
        that.setData({ list: [], error: '', loading: false })
        wx.switchTab({ url: '/pages/my/my' })
      }
    })
  }
})
