const request = require('../../utils/request')
const { decorateTeacher } = require('../../utils/format')

Page({
  data: {
    list: [],
    rows: [],
    loading: true,
    error: ''
  },

  onLoad(query) {
    this.ids = String(query.ids || '')
      .split(',')
      .map(item => Number.parseInt(item, 10))
      .filter(id => Number.isInteger(id) && id > 0)
      .slice(0, 3)

    if (this.ids.length < 2) {
      this.setData({ loading: false, error: '请选择 2-3 位名师进行对比' })
      return
    }

    this.fetchCompare()
  },

  fetchCompare() {
    this.setData({ loading: true, error: '' })

    request
      .get('/api/teachers/compare', { ids: this.ids.join(',') })
      .then(data => {
        const list = (data.list || []).map(decorateTeacher)

        const rows = [
          { label: '学段', values: list.map(item => item.stage) },
          { label: '学科', values: list.map(item => item.subject) },
          { label: '教龄', values: list.map(item => `${item.years} 年`) },
          { label: '全网粉丝', values: list.map(item => item.fansText) },
          { label: '标签', values: list.map(item => item.tags.join(' · ')) },
          { label: '教学亮点', values: list.map(item => item.highlights.join('；')) },
          { label: '代表课程', values: list.map(item => item.courses.join('、')) }
        ]

        this.setData({ list, rows, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false, error: err.message || '对比数据加载失败' })
      })
  },

  onDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  onRetry() {
    wx.navigateBack()
  }
})
