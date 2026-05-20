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
    this.loadData();
  },

  onShow() {
    if (!app.globalData.hasBazi) {
      this.setData({ noBazi: true, loading: false });
    }
  },

  async loadData() {
    const { year, month } = this.data;

    // 检查缓存
    const cached = cache.getCachedMonthHuangli(year, month);
    if (cached) {
      this.setData({ monthData: cached, loading: false });
    }

    try {
      const result = await api.getMonthHuangli(year, month);
      if (result.success) {
        this.setData({ monthData: result.monthData, loading: false });
        cache.cacheMonthHuangli(year, month, result.monthData);
      }
    } catch (err) {
      this.setData({ loading: false });
    }

    // 加载今日黄历
    this.loadTodayHuangli();
  },

  async loadTodayHuangli() {
    const { year, month, today } = this.data;
    try {
      const result = await api.getTodayHuangli(year, month, today.day);
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
