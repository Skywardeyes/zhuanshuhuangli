App({
  onLaunch: function () {
    this.globalData = {
      env: "miniprogram-1-5gxk7pzt9e55b114",
      userInfo: null,
      baziRecord: null,
      todayHuangli: null,
      hasBazi: false
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
    this.checkUserBazi();
  },

  checkUserBazi: function () {
    const cached = wx.getStorageSync('baziRecord');
    if (cached) {
      this.globalData.baziRecord = cached;
      this.globalData.hasBazi = true;
    }
  },

  setBaziRecord: function (record) {
    this.globalData.baziRecord = record;
    this.globalData.hasBazi = true;
    wx.setStorageSync('baziRecord', record);
  },

  clearBaziRecord: function () {
    this.globalData.baziRecord = null;
    this.globalData.hasBazi = false;
    wx.removeStorageSync('baziRecord');
  }
});
