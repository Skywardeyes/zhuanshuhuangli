// 八字排盘核心算法
const C = require('./constants.js');

// ── 辅助函数 ──

function mod(n, m) { return ((n % m) + m) % m; }

// 查找某天干在数组中的索引
function indexOfGan(gan) { return C.GAN.indexOf(gan); }
function indexOfZhi(zhi) { return C.ZHI.indexOf(zhi); }

// ── 1. 年柱计算 ──
// 以立春为分界线。输入公历年月日，返回年柱干支
function calcYearPillar(year, month, day) {
  // 判断是否在立春之前
  const lichun = getJieqiDate(year, '立春');
  let targetYear = year;
  if (month < lichun.month || (month === lichun.month && day < lichun.day)) {
    targetYear = year - 1;
  }
  // 年干支：以甲子年(1984)为参照
  const baseYear = 1984;
  const idx = mod(targetYear - baseYear, 60);
  return { stem: C.SIXTY_JIAZI[idx][0], branch: C.SIXTY_JIAZI[idx][1] };
}

// ── 2. 月柱计算 ──
// 以节气为分界线。月支按节气确定，月干按年上起月法
function calcMonthPillar(year, month, day, getJieqiFn) {
  const lookupJieqi = getJieqiFn || getJieqiDate;
  // 确定月支(按节气)
  let monthIndex = -1;
  for (let i = 0; i < 12; i++) {
    const jie = lookupJieqi(year, C.MONTH_JIE[i]);
    const nextJie = i < 11 ? lookupJieqi(year, C.MONTH_JIE[i + 1]) : lookupJieqi(year + 1, C.MONTH_JIE[0]);

    const jieDate = jie.month * 100 + jie.day;
    const nextJieDate = nextJie.month * 100 + (nextJie.year > year ? nextJie.day + 1200 : nextJie.day);
    const targetDate = month * 100 + day;

    if (targetDate >= jieDate && targetDate < nextJieDate) {
      monthIndex = i;
      break;
    }
  }
  if (monthIndex === -1) monthIndex = 0; // fallback

  const monthZhi = C.ZHI[monthIndex + 2 > 11 ? monthIndex + 2 - 12 : monthIndex + 2]; // 寅月从index 2开始

  // 年上起月法: 找月干
  const yearPillar = calcYearPillar(year, month, day);
  const yearGan = yearPillar.stem;
  const monthGan = C.YEAR_MONTH_STEM[yearGan][monthIndex];

  return { stem: monthGan, branch: monthZhi };
}

// ── 3. 日柱计算 ──
// 以1900-01-01(甲戌日, 六十甲子index=10)为参照
function calcDayPillar(year, month, day) {
  const refDate = new Date(1900, 0, 1); // 1900-01-01
  const targetDate = new Date(year, month - 1, day);
  let diffDays = Math.round((targetDate - refDate) / (1000 * 60 * 60 * 24));
  const idx = mod(diffDays + 10, 60); // 1900-01-01 甲戌 index=10
  return { stem: C.SIXTY_JIAZI[idx][0], branch: C.SIXTY_JIAZI[idx][1] };
}

// ── 4. 时柱计算 ──
// 根据时辰和日干计算时柱
function calcHourPillar(dayGan, shichenZhi) {
  const zhiIndex = C.ZHI.indexOf(shichenZhi);
  if (zhiIndex === -1) return null;
  const hourGan = C.DAY_HOUR_STEM[dayGan][zhiIndex];
  return { stem: hourGan, branch: shichenZhi };
}

// ── 5. 时辰判断 ──
function getShichenFromTime(hour24, minute) {
  let totalMinutes = hour24 * 60 + (minute || 0);
  // 23:00以后算次日子时
  if (hour24 >= 23 || hour24 < 1) return { zhi: '子', isNightZi: hour24 >= 23 };
  for (let i = 1; i < C.SHICHEN_MAP.length; i++) {
    const sc = C.SHICHEN_MAP[i];
    if (hour24 >= sc.hourStart && hour24 < sc.hourEnd) {
      return { zhi: sc.zhi, isNightZi: false };
    }
  }
  return { zhi: '子', isNightZi: false };
}

// ── 6. 藏干 ──
function getCanggan(branch) {
  return C.CANG_GAN[branch] || [];
}

// ── 7. 四柱排出 ──
function calcFourPillars(year, month, day, hour24, minute) {
  const yearPillar = calcYearPillar(year, month, day);
  const monthPillar = calcMonthPillar(year, month, day);

  // 处理夜子时：日柱用次日
  let dayPillar, hourPillar;
  const shichen = getShichenFromTime(hour24, minute);

  if (shichen.isNightZi) {
    // 夜子时(23:00后): 日柱用次日
    const nextDate = new Date(year, month - 1, day + 1);
    dayPillar = calcDayPillar(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
  } else {
    dayPillar = calcDayPillar(year, month, day);
  }

  hourPillar = calcHourPillar(dayPillar.stem, shichen.zhi);

  return {
    year: { stem: yearPillar.stem, branch: yearPillar.branch, canggan: getCanggan(yearPillar.branch), shishen: C.getShishen(dayPillar.stem, yearPillar.stem) },
    month: { stem: monthPillar.stem, branch: monthPillar.branch, canggan: getCanggan(monthPillar.branch), shishen: C.getShishen(dayPillar.stem, monthPillar.stem) },
    day: { stem: dayPillar.stem, branch: dayPillar.branch, canggan: getCanggan(dayPillar.branch), shishen: '—' },
    hour: { stem: hourPillar ? hourPillar.stem : null, branch: hourPillar ? hourPillar.branch : null, canggan: hourPillar ? getCanggan(hourPillar.branch) : [], shishen: hourPillar ? C.getShishen(dayPillar.stem, hourPillar.stem) : null }
  };
}

// ── 8. 大运排列 ──
function calcDayun(yearGan, gender, monthPillar, birthYear, birthMonth, birthDay) {
  const yangGan = C.YANG_GAN.includes(yearGan);
  // 阳男阴女顺排，阴男阳女排逆
  const forward = (yangGan && gender === '男') || (!yangGan && gender === '女');

  // 计算起运年龄
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
  let targetJieqiDate;

  if (forward) {
    // 顺数到下一个节
    targetJieqiDate = findNextJie(birthYear, birthMonth, birthDay);
  } else {
    // 逆数到上一个节
    targetJieqiDate = findPrevJie(birthYear, birthMonth, birthDay);
  }

  let diffDays = Math.abs(Math.round((targetJieqiDate - birthDate) / (1000 * 60 * 60 * 24)));
  let qiyunAge = Math.round(diffDays / 3);
  if (qiyunAge === 0) qiyunAge = 1;

  // 排列大运
  const monthGanIdx = C.GAN.indexOf(monthPillar.stem);
  const monthZhiIdx = C.ZHI.indexOf(monthPillar.branch);
  const dayunList = [];

  for (let i = 0; i < 8; i++) {
    const step = i + 1;
    let ganIdx, zhiIdx;
    if (forward) {
      ganIdx = mod(monthGanIdx + step, 10);
      zhiIdx = mod(monthZhiIdx + step, 12);
    } else {
      ganIdx = mod(monthGanIdx - step, 10);
      zhiIdx = mod(monthZhiIdx - step, 12);
    }
    const ageStart = qiyunAge + (step - 1) * 10;
    const ageEnd = ageStart + 9;
    dayunList.push({
      order: step,
      ageStart,
      ageEnd,
      stem: C.GAN[ganIdx],
      branch: C.ZHI[zhiIdx]
    });
  }

  return {
    direction: forward ? '顺排' : '逆排',
    qiyunAge,
    dayunList
  };
}

// ── 9. 神煞计算 ──
function calcShensha(yearBranch, monthBranch, dayBranch, dayStem) {
  const tianyi = C.TIANYI_GUIREN[dayStem] || [];
  const wenchang = C.WENCHANG_GUIREN[dayStem] || '';
  const yima = C.YIMA_MAP[yearBranch] || '';
  const taohua = C.TAOHUA_MAP[yearBranch] || '';
  const huagai = C.HUAGAI_MAP[yearBranch] || '';

  const result = {};
  if (tianyi.length > 0) result.tianyi = tianyi;
  if (wenchang) result.wenchang = wenchang;
  if (yima) result.yima = yima;
  if (taohua) result.taohua = taohua;
  if (huagai) result.huagai = huagai;

  return result;
}

// ── 10. 日主强弱分析 ──
function analyzeStrength(dayGan, monthZhi, pillars) {
  const dayWx = C.GAN_WUXING[dayGan];
  let score = 0;

  // 得令: 月支五行与日干相同或生日干
  const monthWx = C.ZHI_WUXING[monthZhi];
  if (monthWx === dayWx) score += 40;
  else if (C.WUXING_SHENG[monthWx] === dayWx) score += 30;

  // 得地: 其他地支中有根
  ['year', 'month', 'day', 'hour'].forEach(col => {
    if (col === 'month' || !pillars[col] || !pillars[col].branch) return;
    const wx = C.ZHI_WUXING[pillars[col].branch];
    if (wx === dayWx) score += 15;
    else if (C.WUXING_SHENG[wx] === dayWx) score += 10;

    // 藏干中也有根
    const cg = getCanggan(pillars[col].branch);
    cg.forEach(c => {
      if (C.GAN_WUXING[c.gan] === dayWx) score += c.weight / 10;
      if (C.GAN_WUXING[c.gan] === C.WUXING_SHENG[dayWx] && c.level === '本气') score += c.weight / 20;
    });
  });

  // 得势: 天干比劫印星
  ['year', 'month', 'hour'].forEach(col => {
    if (!pillars[col] || !pillars[col].stem) return;
    const wx = C.GAN_WUXING[pillars[col].stem];
    if (wx === dayWx) score += 12;
    else if (C.WUXING_SHENG[wx] === dayWx) score += 8;
  });

  if (score >= 50) return { strength: '身旺', score };
  if (score >= 35) return { strength: '中和偏旺', score };
  if (score >= 20) return { strength: '中和偏弱', score };
  return { strength: '身弱', score };
}

// ── 11. 五行统计 ──
function countWuxing(pillars) {
  const count = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  ['year', 'month', 'day', 'hour'].forEach(col => {
    if (!pillars[col]) return;
    if (pillars[col].stem) count[C.GAN_WUXING[pillars[col].stem]] = (count[C.GAN_WUXING[pillars[col].stem]] || 0) + 1;
    if (pillars[col].branch) count[C.ZHI_WUXING[pillars[col].branch]] = (count[C.ZHI_WUXING[pillars[col].branch]] || 0) + 1.5;
  });
  return count;
}

// ── 12. 喜用神判定 ──
function determineXiyong(dayGan, monthZhi, pillars, strength) {
  const dayWx = C.GAN_WUXING[dayGan];
  const monthWx = C.ZHI_WUXING[monthZhi];
  const wuxingCount = countWuxing(pillars);
  const season = getSeason(monthZhi);

  const xiyong = new Set();
  const jishen = new Set();

  // 根据力量强弱确定扶抑
  if (strength.strength.includes('身弱')) {
    // 扶: 生我和同我
    const shengWo = Object.keys(C.WUXING_SHENG).filter(k => C.WUXING_SHENG[k] === dayWx);
    shengWo.forEach(w => xiyong.add(w));
    xiyong.add(dayWx);
    // 忌: 克我和我克
    const keWo = Object.keys(C.WUXING_KE).filter(k => C.WUXING_KE[k] === dayWx);
    keWo.forEach(w => jishen.add(w));
    const woKe = C.WUXING_KE[dayWx];
    if (woKe) jishen.add(woKe);
  } else {
    // 抑: 克我和泄我
    const keWo = Object.keys(C.WUXING_KE).filter(k => C.WUXING_KE[k] === dayWx);
    keWo.forEach(w => xiyong.add(w));
    const woSheng = C.WUXING_SHENG[dayWx];
    if (woSheng) xiyong.add(woSheng);
    // 忌: 生我和同我
    Object.keys(C.WUXING_SHENG).filter(k => C.WUXING_SHENG[k] === dayWx).forEach(w => jishen.add(w));
    jishen.add(dayWx);
  }

  // 调候修正 (穷通宝典)
  const seasonWx = { '春': '木', '夏': '火', '秋': '金', '冬': '水' }[season];
  if (season === '夏') {
    xiyong.add('水'); jishen.delete('水');
  } else if (season === '冬') {
    xiyong.add('火'); jishen.delete('火');
  }

  return {
    xiyong: [...xiyong],
    jishen: [...jishen]
  };
}

// ── 13. 格局判定 (子平真诠) ──
function determinePattern(pillars, monthZhi) {
  const monthCanggan = getCanggan(monthZhi);
  const dayStem = pillars.day.stem;

  // 看月支藏干的本气透出
  const mainQi = monthCanggan.length > 0 ? monthCanggan[0].gan : null;
  if (!mainQi) return '建禄格';

  // 检查是否透出天干
  const touChu = ['year', 'month', 'hour'].some(col => pillars[col] && pillars[col].stem === mainQi);
  const shishen = C.getShishen(dayStem, mainQi);

  const patternMap = {
    '正官': '正官格', '七杀': '七杀格', '偏官': '七杀格',
    '正财': '正财格', '偏财': '偏财格',
    '正印': '正印格', '偏印': '偏印格',
    '食神': '食神格', '伤官': '伤官格',
    '比肩': '建禄格', '劫财': '羊刃格'
  };

  return patternMap[shishen] || shishen + '格';
}

// ── 辅助: 节气日期查找 ──
function getJieqiDate(year, jieName) {
  // 使用近似日期表，月度误差一般在+/-2天内
  const jq = C.JIEQI_BASE.find(j => j.name === jieName);
  if (!jq) return { year, month: 1, day: 1 };
  // 简化的节气计算 (使用近似公式，精确度对于排盘足够)
  // 实际项目中可用天文算法精确计算
  let adjustDay = jq.day;
  // 根据年份微调 (简单补偿)
  const yearOffset = (year - 2025) * 0.2422;
  adjustDay += Math.floor(yearOffset * 0.01);
  // 闰年修正
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    adjustDay += (jq.month > 2 ? 0.003 : -0.003);
  }
  return {
    year: year,
    month: jq.month,
    day: Math.round(adjustDay)
  };
}

function findNextJie(year, month, day) {
  const birthDate = new Date(year, month - 1, day);
  // 检查本年剩余节
  for (const jieName of C.JIE_LIST) {
    const jq = getJieqiDate(year, jieName);
    const jqDate = new Date(jq.year, jq.month - 1, jq.day);
    if (jqDate > birthDate) return jqDate;
  }
  // 来年立春
  const jq = getJieqiDate(year + 1, '立春');
  return new Date(jq.year, jq.month - 1, jq.day);
}

function findPrevJie(year, month, day) {
  const birthDate = new Date(year, month - 1, day);
  // 逆序查找
  const reversedJie = [...C.JIE_LIST].reverse();
  // 检查本年
  for (const jieName of reversedJie) {
    const jq = getJieqiDate(year, jieName);
    const jqDate = new Date(jq.year, jq.month - 1, jq.day);
    if (jqDate < birthDate) return jqDate;
  }
  // 去年小寒
  const jq = getJieqiDate(year - 1, '小寒');
  return new Date(jq.year, jq.month - 1, jq.day);
}

function getSeason(monthZhi) {
  const seasons = { '寅': '春', '卯': '春', '辰': '春', '巳': '夏', '午': '夏', '未': '夏', '申': '秋', '酉': '秋', '戌': '秋', '亥': '冬', '子': '冬', '丑': '冬' };
  return seasons[monthZhi] || '春';
}

// ── 完整排盘 ──
function fullBaziCalc(params) {
  const { year, month, day, hour, minute, gender } = params;

  const pillars = calcFourPillars(year, month, day, hour || 12, minute || 0);
  const dayGan = pillars.day.stem;
  const monthZhi = pillars.month.branch;

  const strength = analyzeStrength(dayGan, monthZhi, pillars);
  const wuxingCount = countWuxing(pillars);
  const xiyong = determineXiyong(dayGan, monthZhi, pillars, strength);
  const pattern = determinePattern(pillars, monthZhi);
  const yearGan = pillars.year.stem;
  const dayun = calcDayun(yearGan, gender, pillars.month, year, month, day);
  const shensha = calcShensha(pillars.year.branch, pillars.month.branch, pillars.day.branch, dayGan);

  return {
    pillars,
    dayGan,
    strength,
    wuxingCount,
    xiyong,
    pattern,
    dayun,
    shensha,
    gender,
    birthInfo: { year, month, day, hour, minute }
  };
}

module.exports = {
  mod, indexOfGan, indexOfZhi,
  calcYearPillar, calcMonthPillar, calcDayPillar, calcHourPillar,
  getShichenFromTime, getCanggan, calcFourPillars,
  calcDayun, calcShensha,
  analyzeStrength, countWuxing, determineXiyong, determinePattern,
  getJieqiDate, findNextJie, findPrevJie,
  fullBaziCalc
};
