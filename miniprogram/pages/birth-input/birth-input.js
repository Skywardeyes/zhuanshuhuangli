const api = require('../../utils/api.js');
const dateUtils = require('../../utils/dateUtils.js');
const app = getApp();

Page({
  data: {
    step: 1,
    totalSteps: 4,
    gender: '',
    calendarType: 'solar',
    birthday: '',
    shichen: '',
    shichenOptions: dateUtils.SHICHEN_OPTIONS,
    birthplace: '',
    birthProvince: '',
    birthCity: '',
    baziName: '',
    submitting: false,
    errorMsg: '',
    editBaziId: '',
    isEditing: false
  },

  onLoad(options) {
    this.syncTheme();
    var editBaziId = options.editBaziId;
    if (!editBaziId) return;

    // 从 app.globalData.baziRecords 中查找待编辑的八字
    var records = app.globalData.baziRecords || [];
    var targetBazi = null;
    for (var i = 0; i < records.length; i++) {
      if (records[i]._id === editBaziId) {
        targetBazi = records[i];
        break;
      }
    }
    if (!targetBazi) return;

    this.setData({ editBaziId: editBaziId, isEditing: true });
    this.prefillForm(targetBazi);
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

  // 预填表单
  prefillForm: function(bazi) {
    var gender = bazi.gender || '';
    var calendarType = 'solar';
    var birthday = '';
    if (bazi.birthSolar) {
      calendarType = 'solar';
      birthday = bazi.birthSolar;
    } else if (bazi.birthLunar) {
      calendarType = 'lunar';
      birthday = bazi.birthLunar;
    } else if (bazi.birthYear) {
      var m = String(bazi.birthMonth).padStart(2, '0');
      var d = String(bazi.birthDay).padStart(2, '0');
      birthday = bazi.birthYear + '-' + m + '-' + d;
    }

    var shichen = bazi.birthTime || '';
    if (!shichen && bazi.birthHour !== undefined) {
      shichen = hourToShichen(bazi.birthHour);
    }

    this.setData({
      gender: gender,
      calendarType: calendarType,
      birthday: birthday,
      shichen: shichen,
      birthplace: bazi.birthplace || '',
      birthProvince: bazi.birthProvince || '',
      birthCity: bazi.birthCity || '',
      baziName: bazi.name || ''
    });
  },

  // Step 1: 选择性别
  selectGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender, errorMsg: '' });
  },

  // Step 2: 切换日历类型
  toggleCalendarType() {
    this.setData({
      calendarType: this.data.calendarType === 'solar' ? 'lunar' : 'solar',
      birthday: ''
    });
  },

  // Step 2: 日期选择
  onDateChange(e) {
    this.setData({ birthday: e.detail.value, errorMsg: '' });
  },

  // Step 3: 时辰选择
  onShichenSelect(e) {
    const idx = e.currentTarget.dataset.index;
    const item = dateUtils.SHICHEN_OPTIONS[idx];
    this.setData({ shichen: item.value, errorMsg: '' });
  },

  // Step 4: 选择地区
  onRegionChange(e) {
    const [province, city] = e.detail.value;
    this.setData({
      birthProvince: province,
      birthCity: city,
      birthplace: province + ' ' + city,
      errorMsg: ''
    });
  },

  // Step 4: 输入名称
  onNameInput(e) {
    this.setData({ baziName: e.detail.value });
  },

  // 跳过时辰
  skipShichen() {
    this.setData({ shichen: '未知' });
    this.nextStep();
  },

  // 编辑模式：取消返回
  goBack() {
    wx.navigateBack();
  },

  // 编辑模式：直接提交
  submitEdit() {
    if (!this.data.gender) { this.setData({ errorMsg: '请选择性别' }); return; }
    if (!this.data.birthday) { this.setData({ errorMsg: '请选择出生日期' }); return; }
    this.submit();
  },

  // 下一步
  nextStep() {
    if (!this.validateStep()) return;
    if (this.data.step < 4) {
      this.setData({ step: this.data.step + 1 });
    } else {
      this.submit();
    }
  },

  prevStep() {
    if (this.data.step > 1) this.setData({ step: this.data.step - 1 });
  },

  validateStep() {
    const { step, gender, birthday, shichen } = this.data;
    if (step === 1 && !gender) { this.setData({ errorMsg: '请选择性别' }); return false; }
    if (step === 2 && !birthday) { this.setData({ errorMsg: '请选择出生日期' }); return false; }
    if (step === 3 && !shichen) { this.setData({ errorMsg: '请选择时辰，不确定可跳过' }); return false; }
    this.setData({ errorMsg: '' });
    return true;
  },

  async submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    const [year, month, day] = this.data.birthday.split('-').map(Number);
    const hourItem = this.data.shichenOptions.find(s => s.value === this.data.shichen);
    const hour = hourItem ? hourItem.hour : 12;

    var baziData = {
      year: year, month: month, day: day, hour: hour, minute: 0,
      gender: this.data.gender,
      name: this.data.baziName,
      birthplace: this.data.birthplace,
      birthProvince: this.data.birthProvince,
      birthCity: this.data.birthCity,
      birthSolar: this.data.calendarType === 'solar' ? this.data.birthday : '',
      birthLunar: this.data.calendarType === 'lunar' ? this.data.birthday : '',
      birthTime: this.data.shichen === '未知' ? '' : this.data.shichen
    };

    try {
      // 同时更新用户信息
      await api.updateProfile({
        gender: this.data.gender,
        birthSolar: baziData.birthSolar,
        birthLunar: baziData.birthLunar,
        birthTime: baziData.birthTime,
        birthplace: this.data.birthplace,
        birthProvince: this.data.birthProvince,
        birthCity: this.data.birthCity
      });

      if (this.data.isEditing) {
        // 编辑模式：更新现有八字
        const result = await api.updateBaziRecord(this.data.editBaziId, baziData);
        if (result.success) {
          // 替换 globalData 中的旧记录
          var records = app.globalData.baziRecords || [];
          for (var i = 0; i < records.length; i++) {
            if (records[i]._id === this.data.editBaziId) {
              records[i] = result.bazi;
              break;
            }
          }
          app.setBaziRecords(records);
          app.setActiveBaziById(this.data.editBaziId);
          // 后台预生成当月黄历
          const now = new Date();
          api.preGenerateHuangli(result.bazi._id, now.getFullYear(), now.getMonth() + 1, 1);
          wx.navigateBack();
        } else {
          this.setData({ errorMsg: result.errMsg || '更新失败', submitting: false });
        }
      } else {
        // 新建模式
        const result = await api.calculateBazi(baziData);
        if (result.success) {
          app.addBaziRecord(result.bazi);
          const now = new Date();
          api.preGenerateHuangli(result.bazi._id, now.getFullYear(), now.getMonth() + 1, 1);
          wx.redirectTo({ url: '/pages/fortune/fortune' });
        } else {
          this.setData({ errorMsg: result.errMsg || '排盘失败', submitting: false });
        }
      }
    } catch (err) {
      this.setData({ errorMsg: '网络异常，请重试', submitting: false });
    }
  }
});

// 出生小时转时辰名称
function hourToShichen(hour) {
  var options = dateUtils.SHICHEN_OPTIONS;
  for (var i = 0; i < options.length; i++) {
    if (options[i].hour === hour) return options[i].value;
  }
  return '';
}
