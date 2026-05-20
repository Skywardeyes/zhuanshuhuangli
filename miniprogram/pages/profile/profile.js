const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    user: null,
    bazi: null,
    loading: true
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const result = await api.getUserProfile();
      if (result.success) {
        this.setData({
          user: result.user,
          bazi: result.baziRecord,
          loading: false
        });
        app.globalData.userInfo = result.user;
        if (result.baziRecord) {
          app.setBaziRecord(result.baziRecord);
        }
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  goToBazi() {
    wx.navigateTo({ url: '/pages/birth-input/birth-input' });
  },

  goToFortune() {
    if (!app.globalData.hasBazi) {
      wx.showToast({ title: '请先完成排盘', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/fortune/fortune' });
  },

  getGenderText(gender) {
    return gender || '未填写';
  },

  getBirthText(user) {
    if (!user) return '未填写';
    if (user.birthSolar) return user.birthSolar;
    if (user.birthLunar) return user.birthLunar + '(农历)';
    return '未填写';
  },

  getShichenText(user) {
    if (!user) return '未填写';
    if (user.birthTime) return user.birthTime + '时';
    return '未知';
  }
});
