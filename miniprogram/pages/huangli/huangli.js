const api = require('../../utils/api.js');
const cache = require('../../utils/cache.js');
const app = getApp();

Page({
  data: {
    year: 2026,
    month: 5,
    today: { year: 2026, month: 5, day: 20 },
    monthData: [],
    todayHuangli: null,
    loading: true,
    noBazi: false
  },

  onLoad() {
    const now = new Date();
    const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    this.setData({ year: today.year, month: today.month, today });
    this.syncTheme();
    this.loadData();
  },

  onShow() {
    this.syncTheme();
    if (!app.globalData.hasBazi) {
      this.setData({ noBazi: true, loading: false });
      return;
    }
    this.setData({ noBazi: false });
    // 检测八字是否已切换，切换则重新加载
    var currentId = app.globalData.currentBaziId;
    if (this._lastBaziId && this._lastBaziId !== currentId) {
      this.setData({ loading: true, monthData: [], todayHuangli: null });
      this.loadData();
    }
    this._lastBaziId = currentId;
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

  onBaziChange(e) {
    this.syncTheme();
    this._lastBaziId = app.globalData.currentBaziId;
    this.setData({ loading: true, monthData: [], todayHuangli: null });
    this.loadData();
  },

  async loadData() {
    const { year, month } = this.data;
    const baziId = app.globalData.currentBaziId;

    // 检查缓存
    const cached = cache.getCachedMonthHuangli(year, month, baziId);
    if (cached) {
      this.setData({ monthData: cached, loading: false });
    }

    try {
      const result = await api.getMonthHuangli(year, month, baziId);
      if (result.success) {
        this.setData({ monthData: result.monthData, loading: false });
        cache.cacheMonthHuangli(year, month, result.monthData, baziId);
      }
    } catch (err) {
      this.setData({ loading: false });
    }

    this.loadTodayHuangli();
  },

  async loadTodayHuangli() {
    const { year, month, today } = this.data;
    const baziId = app.globalData.currentBaziId;
    try {
      const result = await api.getTodayHuangli(year, month, today.day, baziId);
      if (result.success) {
        this.setData({ todayHuangli: result.huangli });
      }
    } catch (err) { /* ignore */ }
  },

  goToBazi() {
    wx.navigateTo({ url: '/pages/birth-input/birth-input' });
  },

  onDayTap(e) {
    const { year, month, day } = e.detail;
    wx.navigateTo({ url: `/pages/huangli-detail/huangli-detail?year=${year}&month=${month}&day=${day}` });
  },

  prevMonth() {
    let { year, month } = this.data;
    if (month === 1) { year--; month = 12; }
    else { month--; }
    this.setData({ year, month, loading: true, monthData: [] });
    this.loadData();
  },

  nextMonth() {
    let { year, month } = this.data;
    if (month === 12) { year++; month = 1; }
    else { month++; }
    this.setData({ year, month, loading: true, monthData: [] });
    this.loadData();
  }
});
