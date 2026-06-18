const api = require('../../utils/api.js');
const cache = require('../../utils/cache.js');
const app = getApp();

Page({
  data: {
    hasBazi: false,
    todayHuangli: null,
    loading: true,
    userName: '',
    envReady: true,
    envMsg: '',
    envId: '',
    showDebug: false
  },

  onLoad() {
    this.setData({ envId: app.globalData.env || '(未设置)' });
    this.syncTheme();
    this.checkState();
    this.checkEnv();
  },

  onShow() {
    this.syncTheme();
    this.checkState();
    if (app.globalData.hasBazi) {
      this.loadToday();
    }
  },

  syncTheme() {
    var theme = app.globalData.currentTheme;
    this.setData({ currentTheme: theme });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme.navBg,
      animation: { duration: 300, timingFunc: 'easeIn' }
    });
    wx.setBackgroundColor({
      backgroundColor: theme.bg,
      backgroundColorTop: theme.navBg,
      backgroundColorBottom: theme.bg
    });
  },

  // 检测云环境
  async checkEnv() {
    const env = app.globalData.env;
    if (!env) {
      this.setData({ envReady: false, envMsg: '请在 app.js 中配置 env 环境ID' });
      return;
    }
    try {
      const res = await api.getOrCreateUser();
      if (res && res.success) {
        this.setData({ envReady: true, envMsg: '云环境连接正常 ✓' });
      } else {
        this.setData({ envReady: false, envMsg: '返回异常: ' + JSON.stringify(res) });
      }
    } catch (err) {
      this.setData({ envReady: false, envMsg: '连接失败，请检查云函数是否已部署' });
    }
  },

  checkState() {
    this.setData({
      hasBazi: app.globalData.hasBazi,
      userName: (app.globalData.userInfo && app.globalData.userInfo.nickName) || ''
    });
  },

  async loadToday() {
    const baziId = app.globalData.currentBaziId;

    const cached = cache.getCachedTodayHuangli(baziId);
    if (cached) {
      this.setData({ todayHuangli: cached, loading: false });
    }

    try {
      const result = await api.getTodayHuangli(null, null, null, baziId);
      if (result.success) {
        this.setData({ todayHuangli: result.huangli, loading: false });
        cache.cacheTodayHuangli(result.huangli, baziId);
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: result.errMsg || '加载失败', icon: 'none' });
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  toggleDebug() {
    this.setData({ showDebug: !this.data.showDebug });
    if (!this.data.showDebug) this.checkEnv();
  },

  goToBazi() {
    wx.navigateTo({ url: '/pages/birth-input/birth-input' });
  },

  goToFortune() {
    wx.navigateTo({ url: '/pages/fortune/fortune' });
  },

  goToHuangli() {
    wx.switchTab({ url: '/pages/huangli/huangli' });
  }
});
