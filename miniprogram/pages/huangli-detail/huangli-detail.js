const api = require('../../utils/api.js');
const app = getApp();

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
    this.syncTheme();
    if (year) this.setData({
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day)
    });
    this.loadDetail();
  },

  syncTheme() {
    var theme = app.globalData.currentTheme;
    this.setData({ currentTheme: theme });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme.navBg,
      animation: { duration: 300, timingFunc: 'easeIn' }
    });
  },

  async loadDetail() {
    const { year, month, day } = this.data;
    const baziId = app.globalData.currentBaziId;
    try {
      const result = await api.getTodayHuangli(year, month, day, baziId);
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
