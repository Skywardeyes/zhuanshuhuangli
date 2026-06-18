const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    user: null,
    bazi: null,
    baziList: [],
    activeBaziId: '',
    nickName: '',
    avatarUrl: '',
    loading: true,
    showDateModal: false,
    genTargetBaziId: '',
    genStartDate: '',
    genEndDate: ''
  },

  onLoad() {
    this.syncTheme();
    this.loadProfile();
  },

  onShow() {
    this.syncTheme();
    this.loadProfile();
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

  async loadProfile() {
    try {
      const result = await api.getUserProfile();
      if (result.success) {
        var baziRecords = result.baziRecords || [];
        // Preserve generating state from current list across reloads
        var currentList = this.data.baziList;
        for (var i = 0; i < baziRecords.length; i++) {
          for (var j = 0; j < currentList.length; j++) {
            if (currentList[j]._id === baziRecords[i]._id && currentList[j]._generating) {
              baziRecords[i]._generating = true;
              baziRecords[i]._genPercentage = currentList[j]._genPercentage;
              baziRecords[i]._genCompleted = currentList[j]._genCompleted;
              baziRecords[i]._genTotal = currentList[j]._genTotal;
              break;
            }
          }
        }
        this.setData({
          user: result.user,
          baziList: baziRecords,
          activeBaziId: result.activeBaziId || (baziRecords.length > 0 ? baziRecords[0]._id : ''),
          nickName: result.user.nickName || '',
          avatarUrl: result.user.avatarUrl || '',
          loading: false
        });
        app.globalData.userInfo = result.user;
        if (baziRecords.length > 0) {
          app.setBaziRecords(baziRecords);
        }
        // 从 globalData 同步当前八字（setBaziRecords 已保留本地切换状态）
        this.setData({
          bazi: app.globalData.currentBazi,
          activeBaziId: app.globalData.currentBaziId
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  // 选择头像
  onChooseAvatar: function (e) {
    var avatarUrl = e.detail.avatarUrl;
    if (!avatarUrl) return;
    var self = this;

    wx.showLoading({ title: '上传中...' });
    var cloudPath = 'avatars/' + app.globalData.currentBaziId + '_' + Date.now() + '.png';
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: avatarUrl,
      success: function (uploadRes) {
        var fileID = uploadRes.fileID;
        self.setData({ avatarUrl: fileID });
        api.updateProfile({ avatarUrl: fileID });
        app.globalData.userInfo.avatarUrl = fileID;
        wx.hideLoading();
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  // 输入昵称
  onNicknameInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  // 昵称失焦时保存
  onNicknameBlur: function (e) {
    var nickName = e.detail.value;
    if (nickName) {
      api.updateProfile({ nickName: nickName });
      app.globalData.userInfo.nickName = nickName;
    }
  },

  switchBazi: function (e) {
    var baziId = e.currentTarget.dataset.id;
    app.setActiveBaziById(baziId);
    api.setActiveBazi(baziId);
    this.setData({
      activeBaziId: baziId,
      bazi: app.globalData.currentBazi,
      currentTheme: app.globalData.currentTheme
    });
    wx.showToast({ title: '已切换', icon: 'success', duration: 1000 });
  },

  deleteBazi: function (e) {
    var baziId = e.currentTarget.dataset.id;
    var baziName = e.currentTarget.dataset.name || '该八字';
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '删除「' + baziName + '」及其所有黄历数据？此操作不可恢复。',
      success: function (res) {
        if (res.confirm) {
          api.deleteBaziRecord(baziId).then(function (result) {
            if (result.success) {
              app.removeBaziFromList(baziId);
              if (result.remainingCount === 0) {
                self.setData({ bazi: null, baziList: [], activeBaziId: '' });
                wx.showToast({ title: '已删除，无剩余八字', icon: 'none' });
              } else {
                self.setData({
                  baziList: app.globalData.baziRecords,
                  activeBaziId: app.globalData.currentBaziId,
                  bazi: app.globalData.currentBazi
                });
                wx.showToast({ title: '已删除', icon: 'success' });
              }
            }
          }).catch(function () {});
        }
      }
    });
  },

  editBazi: function (e) {
    var baziId = e.currentTarget.dataset.id;
    if (!baziId) return;
    wx.navigateTo({ url: '/pages/birth-input/birth-input?editBaziId=' + baziId });
  },

  // 打开日期范围选择弹窗
  onGenDateTap: function (e) {
    var baziId = e.currentTarget.dataset.id;
    if (!baziId) return;
    var now = new Date();
    var year = now.getFullYear();
    this.setData({
      showDateModal: true,
      genTargetBaziId: baziId,
      genStartDate: year + '-01-01',
      genEndDate: year + '-12-31'
    });
  },

  closeDateModal: function () {
    this.setData({ showDateModal: false });
  },

  onStartDateChange: function (e) {
    this.setData({ genStartDate: e.detail.value });
  },

  onEndDateChange: function (e) {
    this.setData({ genEndDate: e.detail.value });
  },

  confirmPreGenerate: function () {
    var baziId = this.data.genTargetBaziId;
    var startDate = this.data.genStartDate;
    var endDate = this.data.genEndDate;

    if (!baziId || !startDate || !endDate) return;
    if (startDate > endDate) {
      wx.showToast({ title: '起始日期不能晚于截止日期', icon: 'none' });
      return;
    }

    this.setData({ showDateModal: false });

    var startParts = startDate.split('-');
    var endParts = endDate.split('-');
    var startYear = parseInt(startParts[0]);
    var startMonth = parseInt(startParts[1]);
    var endYear = parseInt(endParts[0]);
    var endMonth = parseInt(endParts[1]);

    var totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

    // 更新列表项进度信息
    var baziList = this.data.baziList;
    for (var i = 0; i < baziList.length; i++) {
      if (baziList[i]._id === baziId) {
        baziList[i]._generating = true;
        baziList[i]._genPercentage = 0;
        baziList[i]._genCompleted = 0;
        baziList[i]._genTotal = totalMonths;
        break;
      }
    }
    this.setData({ baziList: baziList });

    this.generateMonthInRange(baziId, startYear, startMonth, endYear, endMonth, totalMonths, 0);
  },

  // 逐月递归生成
  generateMonthInRange: function (baziId, year, month, endYear, endMonth, totalMonths, completedSoFar) {
    var self = this;

    if (year > endYear || (year === endYear && month > endMonth)) {
      // 全部完成
      var baziList = self.data.baziList;
      for (var i = 0; i < baziList.length; i++) {
        if (baziList[i]._id === baziId) {
          baziList[i]._generating = false;
          break;
        }
      }
      self.setData({ baziList: baziList });
      wx.showToast({ title: '预生成完成', icon: 'success' });
      return;
    }

    api.preGenerateHuangli(baziId, year, month, 1).then(function () {
      self.advanceGenProgress(baziId, year, month, endYear, endMonth, totalMonths, completedSoFar);
    }).catch(function () {
      self.advanceGenProgress(baziId, year, month, endYear, endMonth, totalMonths, completedSoFar);
    });
  },

  // 更新进度并推进到下一个月
  advanceGenProgress: function (baziId, year, month, endYear, endMonth, totalMonths, completedSoFar) {
    var completed = completedSoFar + 1;
    var percentage = Math.round(completed / totalMonths * 100);

    var baziList = this.data.baziList;
    for (var i = 0; i < baziList.length; i++) {
      if (baziList[i]._id === baziId) {
        baziList[i]._genPercentage = percentage;
        baziList[i]._genCompleted = completed;
        break;
      }
    }
    this.setData({ baziList: baziList });

    // 下一个月
    var nextMonth = month + 1;
    var nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    this.generateMonthInRange(baziId, nextYear, nextMonth, endYear, endMonth, totalMonths, completed);
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
