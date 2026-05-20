// 农历日历数据 - 用于农历转换和节气精确定位
// 数据范围: 1900-2100

// 农历数据编码: 每个年份一个16位数字
// 前12位(或13位)表示每月大小(1=大月30天, 0=小月29天)
// 后4位表示闰月月份(0=无闰月)
// 第17位表示闰月大小(如果有闰月)
const LUNAR_INFO = [
  // 1900-1909
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  // 1910-1919
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  // 1920-1929
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  // 1930-1939
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  // 1940-1949
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  // 1950-1959
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  // 1960-1969
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  // 1970-1979
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  // 1980-1989
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  // 1990-1999
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  // 2000-2009
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  // 2010-2019
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  // 2020-2029
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  // 2030-2039
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  // 2040-2049
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  // 2050-2059
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0,
  // 2060-2069
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  // 2070-2079
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  // 2080-2089
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  // 2090-2100
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252, 0x0d520
];

// 公历转农历 (简化版)
function solarToLunar(year, month, day) {
  // 使用1900-01-31为农历庚子年正月初一作为起点
  const baseDate = new Date(1900, 0, 31);
  const targetDate = new Date(year, month - 1, day);
  let offset = Math.round((targetDate - baseDate) / (1000 * 60 * 60 * 24));

  let lunarYear, lunarMonth, lunarDay;
  let leap = false;

  for (lunarYear = 1900; lunarYear < 2100 && offset > 0; lunarYear++) {
    const daysInYear = lunarYearDays(lunarYear);
    if (offset < daysInYear) break;
    offset -= daysInYear;
  }

  const leapMonth = leapMonthOfYear(lunarYear);
  let isLeap = false;

  for (lunarMonth = 1; lunarMonth <= 12 && offset > 0; lunarMonth++) {
    if (leapMonth > 0 && lunarMonth === leapMonth + 1 && !isLeap) {
      lunarMonth--;
      isLeap = true;
      const leapDays = leapMonthDays(lunarYear);
      if (offset < leapDays) break;
      offset -= leapDays;
      isLeap = false;
    }
    const monthDays = monthDaysOfYear(lunarYear, lunarMonth);
    if (offset < monthDays) break;
    offset -= monthDays;
  }

  lunarDay = offset + 1;
  leap = isLeap;

  const monthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const dayNames = [
    '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ];

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: leap,
    monthName: (leap ? '闰' : '') + monthNames[lunarMonth],
    dayName: dayNames[lunarDay]
  };
}

// 农历转公历 (简化版)
function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap) {
  const baseDate = new Date(1900, 0, 31);
  let offset = 0;

  for (let y = 1900; y < lunarYear; y++) {
    offset += lunarYearDays(y);
  }

  const leapMonth = leapMonthOfYear(lunarYear);
  for (let m = 1; m < lunarMonth; m++) {
    offset += monthDaysOfYear(lunarYear, m);
  }

  if (isLeap && leapMonth === lunarMonth) {
    offset += monthDaysOfYear(lunarYear, lunarMonth);
  }

  offset += lunarDay - 1;

  const result = new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
  return {
    year: result.getFullYear(),
    month: result.getMonth() + 1,
    day: result.getDate()
  };
}

// 农历年总天数
function lunarYearDays(y) {
  let sum = 348; // 12 * 29
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  }
  return sum + leapMonthDays(y);
}

// 农历月天数
function monthDaysOfYear(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

// 闰月月份
function leapMonthOfYear(y) {
  return LUNAR_INFO[y - 1900] & 0xf;
}

// 闰月天数
function leapMonthDays(y) {
  if (leapMonthOfYear(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

// 日干支计算 (同bazi-core中的calcDayPillar)
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIXTY_JIAZI = [];
for (let i = 0; i < 60; i++) {
  SIXTY_JIAZI.push(GAN[i % 10] + ZHI[i % 12]);
}

function getDayGanZhi(year, month, day) {
  const refDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  let diffDays = Math.round((targetDate - refDate) / (1000 * 60 * 60 * 24));
  const idx = ((diffDays % 60) + 60 + 10) % 60;
  return {
    stem: GAN[idx % 10],
    branch: ZHI[idx % 12],
    full: SIXTY_JIAZI[idx]
  };
}

// 建除十二神 (简化算法：基于月支和日支)
const JIAN_CHU = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];

function getJianchu(monthZhi, dayZhi) {
  const monthIdx = ZHI.indexOf(monthZhi);
  const dayIdx = ZHI.indexOf(dayZhi);
  const diff = (dayIdx - monthIdx + 12) % 12;
  return JIAN_CHU[diff];
}

module.exports = {
  solarToLunar, lunarToSolar,
  lunarYearDays, monthDaysOfYear, leapMonthOfYear, leapMonthDays,
  getDayGanZhi, getJianchu,
  LUNAR_INFO
};
