const app = getApp();

Page({
  data: {
    bazi: null,
    pillars: null,
    currentAge: 0,
    analysisText: '',
    xiyongText: '',
    jishenText: '',
    loading: true
  },

  onLoad() {
    this.syncTheme();
    this.renderBazi();
  },

  onShow() {
    this.syncTheme();
    const bazi = app.globalData.currentBazi;
    if (bazi && this.data.bazi && this.data.bazi._id !== bazi._id) {
      this.renderBazi();
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
  },

  renderBazi() {
    const bazi = app.globalData.currentBazi;
    if (!bazi) {
      wx.showToast({ title: '请先完成排盘', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1500);
      return;
    }

    const birthYear = bazi.birthYear;
    const now = new Date();
    const age = now.getFullYear() - birthYear;

    // 组装 pillars 传给 bazi-chart
    const pillars = {
      year: bazi.yearPillar,
      month: bazi.monthPillar,
      day: bazi.dayPillar,
      hour: bazi.hourPillar || { stem: null, branch: null, shishen: null, canggan: [] }
    };

    // 预处理文本
    const xiyongArr = bazi.xiyong && bazi.xiyong.xiyong ? bazi.xiyong.xiyong : [];
    const jishenArr = bazi.xiyong && bazi.xiyong.jishen ? bazi.xiyong.jishen : [];
    const xiyongText = xiyongArr.length > 0 ? '喜用神为' + xiyongArr.join('、') + '，忌' + jishenArr.join('、') : '';

    let analysisText = '日主' + bazi.dayMaster + '，生于' + bazi.birthMonth + '月，' + (bazi.strength ? bazi.strength.strength : '') + '。';
    if (xiyongText) analysisText += xiyongText + '。';
    if (bazi.dayun) analysisText += bazi.dayun.direction + '，' + bazi.dayun.qiyunAge + '岁起运。';
    if (bazi.pattern) analysisText += '月令' + bazi.pattern + '，宜看格局成败高低。';

    this.setData({
      bazi: bazi,
      pillars: pillars,
      currentAge: age,
      xiyongText: xiyongText,
      analysisText: analysisText,
      loading: false
    });
  },

  goToHuangli() {
    wx.switchTab({ url: '/pages/huangli/huangli' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
