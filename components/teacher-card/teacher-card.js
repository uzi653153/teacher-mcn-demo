Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    teacher: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('select', { id: this.data.teacher.id })
    }
  }
})
