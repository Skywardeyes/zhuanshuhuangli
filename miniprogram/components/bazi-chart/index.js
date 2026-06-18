Component({
  properties: {
    pillars: { type: Object, value: {} },
    currentTheme: { type: Object, value: null }
  },

  data: {
    showCanggan: false
  },

  methods: {
    toggleCanggan() {
      this.setData({ showCanggan: !this.data.showCanggan });
    }
  }
});
