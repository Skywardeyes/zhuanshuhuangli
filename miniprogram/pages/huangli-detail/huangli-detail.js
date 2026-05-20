const api = require('../../utils/api.js');

Page({
  data: {
    year: 2026,
    month: 5,
    day: 20,
    huangli: null,
    loading: true
  },

  onLoad(options) {
    const { year, month, day } = options;
    if (year) this.setData({
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day)
    });
    this.loadDetail();
  },

  async loadDetail() {
    const { year, month, day } = this.data;
    try {
      const result = await api.getTodayHuangli(year, month, day);
      if (result.success) {
        this.setData({ huangli: result.huangli, loading: false });
      } else {
        wx.showToast({ title: result.errMsg || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  }
});
