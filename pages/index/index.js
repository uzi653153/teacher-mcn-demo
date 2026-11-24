const request = require('../../utils/request')
const config = require('../../utils/config')
const { decorateTeacher, decorateCourse, formatFans } = require('../../utils/format')

const CATEGORIES = ['全部', '早教', '小初', '高中']

Page({
  data: {
    categories: CATEGORIES,
    activeIndex: 0,
    keyword: '',
    teachers: [],
    page: 1,
    pageSize: config.pageSize,
    total: 0,
    hasMore: false,
    summary: { teacherCount: 0, totalFans: 0 },
    summaryFansText: '0',
    loading: false,
    loadingMore: false,
    error: '',
    hotKeywords: [],
    historyKeywords: [],
    liveCourse: null
  },

  onLoad() {
    this.reqSeq = 0
    this.searchTimer = null
    this.fetchList({ reset: true })
    this.loadSearchMeta()
    this.fetchLiveCourse()
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  onPullDownRefresh() {
    this.fetchList({ reset: true, fromPullDown: true })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return
    this.fetchList({ reset: false })
  },

  fetchList({ reset = false, fromPullDown = false } = {}) {
    const seq = ++this.reqSeq
    const page = reset ? 1 : this.data.page + 1

    const params = {
      category: CATEGORIES[this.data.activeIndex],
      page,
      pageSize: this.data.pageSize
    }
    if (this.data.keyword) params.keyword = this.data.keyword

    this.setData(reset ? { loading: true, error: '' } : { loadingMore: true })

    request
      .get('/api/teachers', params)
      .then(data => {
        if (fromPullDown) wx.stopPullDownRefresh()
        if (seq !== this.reqSeq) return
        const summary = data.summary || { teacherCount: 0, totalFans: 0 }
        const list = (data.list || []).map(decorateTeacher)

        this.setData({
          teachers: reset ? list : this.data.teachers.concat(list),
          page,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore,
          summary,
          summaryFansText: formatFans(summary.totalFans),
          loading: false,
          loadingMore: false,
          error: ''
        })
      })
      .catch(err => {
        if (fromPullDown) wx.stopPullDownRefresh()
        if (seq !== this.reqSeq) return
        this.setData({
          loading: false,
          loadingMore: false,
          error: err.message || '加载失败'
        })
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.fetchList({ reset: true })
    }, 350)
  },

  onSearchConfirm() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.recordSearch(this.data.keyword)
    this.fetchList({ reset: true })
  },

  loadSearchMeta() {
    const history = wx.getStorageSync('search_history') || []
    this.setData({ historyKeywords: history.slice(0, 6) })

    request
      .get('/api/search/hot')
      .then(data => {
        this.setData({ hotKeywords: data.list || [] })
      })
      .catch(() => {})
  },

  fetchLiveCourse() {
    request
      .get('/api/courses')
      .then(data => {
        const list = data.list || []
        const target = list.find(item => item.status === 1) || list.find(item => item.status === 0)
        this.setData({ liveCourse: target ? decorateCourse(target) : null })
      })
      .catch(() => {})
  },

  recordSearch(keyword) {
    const value = String(keyword || '').trim()
    if (!value) return

    request.post('/api/search/record', { keyword: value }).catch(() => {})

    const history = [
      value,
      ...(wx.getStorageSync('search_history') || []).filter(item => item !== value)
    ].slice(0, 6)
    wx.setStorageSync('search_history', history)
    this.setData({ historyKeywords: history })
  },

  onHotTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    if (!keyword) return

    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.setData({ keyword })
    this.recordSearch(keyword)
    this.fetchList({ reset: true })
  },

  onLiveCourse() {
    if (!this.data.liveCourse) return
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${this.data.liveCourse.id}` })
  },

  onAllCourses() {
    wx.navigateTo({ url: '/pages/courses/courses' })
  },

  onClearKeyword() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.setData({ keyword: '' })
    this.fetchList({ reset: true })
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.activeIndex) return
    this.setData({ activeIndex: index })
    this.fetchList({ reset: true })
  },

  onTeacherSelect(e) {
    const id = e.detail.id
    if (!id) return
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onRetry() {
    this.fetchList({ reset: true })
  },

  onExploreAll() {
    this.setData({ keyword: '', activeIndex: 0 })
    this.fetchList({ reset: true })
  },

  onShareAppMessage() {
    return {
      title: '有因有果 · 名师推荐',
      path: '/pages/index/index'
    }
  }
})
