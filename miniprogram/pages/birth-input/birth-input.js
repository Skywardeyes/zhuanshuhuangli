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
    submitting: false,
    errorMsg: ''
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

  // 跳过时辰
  skipShichen() {
    this.setData({ shichen: '未知' });
    this.nextStep();
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

    try {
      await api.updateProfile({
        gender: this.data.gender,
        birthSolar: this.data.calendarType === 'solar' ? this.data.birthday : '',
        birthLunar: this.data.calendarType === 'lunar' ? this.data.birthday : '',
        birthTime: this.data.shichen === '未知' ? '' : this.data.shichen,
        birthplace: this.data.birthplace,
        birthProvince: this.data.birthProvince,
        birthCity: this.data.birthCity
      });

      const result = await api.calculateBazi({ year, month, day, hour, minute: 0, gender: this.data.gender });
      if (result.success) {
        app.setBaziRecord(result.bazi);
        wx.redirectTo({ url: '/pages/fortune/fortune' });
      } else {
        this.setData({ errorMsg: result.errMsg || '排盘失败', submitting: false });
      }
    } catch (err) {
      this.setData({ errorMsg: '网络异常，请重试', submitting: false });
    }
  }
});
