// 日期工具函数

// 时辰列表
const SHICHEN_OPTIONS = [
  { label: '子时 (23:00-01:00)', value: '子', hour: 23 },
  { label: '丑时 (01:00-03:00)', value: '丑', hour: 1 },
  { label: '寅时 (03:00-05:00)', value: '寅', hour: 3 },
  { label: '卯时 (05:00-07:00)', value: '卯', hour: 5 },
  { label: '辰时 (07:00-09:00)', value: '辰', hour: 7 },
  { label: '巳时 (09:00-11:00)', value: '巳', hour: 9 },
  { label: '午时 (11:00-13:00)', value: '午', hour: 11 },
  { label: '未时 (13:00-15:00)', value: '未', hour: 13 },
  { label: '申时 (15:00-17:00)', value: '申', hour: 15 },
  { label: '酉时 (17:00-19:00)', value: '酉', hour: 17 },
  { label: '戌时 (19:00-21:00)', value: '戌', hour: 19 },
  { label: '亥时 (21:00-23:00)', value: '亥', hour: 21 }
];

// 根据小时获取时辰
function getShichenByHour(hour) {
  if (hour >= 23 || hour < 1) return SHICHEN_OPTIONS[0];
  for (let i = 1; i < SHICHEN_OPTIONS.length; i++) {
    if (hour >= SHICHEN_OPTIONS[i].hour && hour < SHICHEN_OPTIONS[i].hour + 2) {
      return SHICHEN_OPTIONS[i];
    }
  }
  return SHICHEN_OPTIONS[0];
}

// 格式化日期
function formatDate(year, month, day) {
  return `${year}年${month}月${day}日`;
}

// 获取当前年月日对象
function getToday() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

// 获取当月天数
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 获取当月第一天是周几 (0=周日)
function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

module.exports = {
  SHICHEN_OPTIONS,
  getShichenByHour,
  formatDate,
  getToday,
  getDaysInMonth,
  getFirstDayOfWeek
};
