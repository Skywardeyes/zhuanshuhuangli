Component({
  properties: {
    pillars: {
      type: Object,
      value: {}
    }
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
