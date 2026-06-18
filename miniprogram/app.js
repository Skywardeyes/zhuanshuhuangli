var themeUtils = require('./utils/theme.js');

App({
  onLaunch: function () {
    this.globalData = {
      env: "miniprogram-1-5gxk7pzt9e55b114",
      userInfo: null,
      baziRecords: [],
      currentBaziId: '',
      currentBazi: null,
      currentTheme: themeUtils.DEFAULT_THEME,
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
    this.loadLocalState();
  },

  // 从本地存储恢复状态
  loadLocalState: function () {
    var cached = wx.getStorageSync('baziRecords');
    if (cached && cached.length > 0) {
      this.globalData.baziRecords = cached;
      var activeId = wx.getStorageSync('currentBaziId');
      if (activeId) {
        this.setActiveBaziById(activeId);
      } else {
        this.setActiveBaziById(cached[0]._id);
      }
    }
  },

  // 批量设置八字列表
  setBaziRecords: function (records) {
    this.globalData.baziRecords = records;
    wx.setStorageSync('baziRecords', records);
    if (records.length > 0) {
      this.globalData.hasBazi = true;
      // 确保当前激活的八字仍在列表中
      var found = false;
      for (var i = 0; i < records.length; i++) {
        if (records[i]._id === this.globalData.currentBaziId) { found = true; break; }
      }
      if (!found || !this.globalData.currentBaziId) {
        this.setActiveBaziById(records[0]._id);
      }
    } else {
      this.clearAllBazi();
    }
  },

  // 切换当前八字
  setActiveBaziById: function (baziId) {
    this.globalData.currentBaziId = baziId;
    wx.setStorageSync('currentBaziId', baziId);
    var records = this.globalData.baziRecords;
    for (var i = 0; i < records.length; i++) {
      if (records[i]._id === baziId) {
        this.globalData.currentBazi = records[i];
        this.globalData.hasBazi = true;
        // 根据日主天干同步主题色
        this.globalData.currentTheme = themeUtils.getTheme(records[i].dayMaster);
        this.applyGlobalTheme();
        return;
      }
    }
    this.globalData.currentBazi = null;
    this.globalData.currentTheme = themeUtils.DEFAULT_THEME;
    this.applyGlobalTheme();
  },

  // 应用全局主题（导航栏、tabBar）
  applyGlobalTheme: function () {
    var theme = this.globalData.currentTheme;
    try {
      wx.setTabBarStyle({
        color: theme.subText,
        selectedColor: theme.primary,
        backgroundColor: theme.tabBarBg,
        borderStyle: theme.tabBarBorder === '#CFD8DC' || theme.tabBarBorder === '#BBDEFB' ? 'white' : 'black'
      });
    } catch (e) {
      // tabBar 可能尚未初始化，忽略
    }
  },

  // 新增八字（加入列表头部并自动激活）
  addBaziRecord: function (record) {
    var records = this.globalData.baziRecords || [];
    records.unshift(record);
    this.setBaziRecords(records);
    this.setActiveBaziById(record._id);
  },

  // 从列表中移除八字
  removeBaziFromList: function (baziId) {
    var records = this.globalData.baziRecords || [];
    var newRecords = [];
    for (var i = 0; i < records.length; i++) {
      if (records[i]._id !== baziId) { newRecords.push(records[i]); }
    }
    this.setBaziRecords(newRecords);
  },

  // 清空所有状态
  clearAllBazi: function () {
    this.globalData.baziRecords = [];
    this.globalData.currentBaziId = '';
    this.globalData.currentBazi = null;
    this.globalData.currentTheme = themeUtils.DEFAULT_THEME;
    this.globalData.hasBazi = false;
    this.applyGlobalTheme();
    wx.removeStorageSync('baziRecords');
    wx.removeStorageSync('currentBaziId');
  }
});
