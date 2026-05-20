// 专属黄历引擎 - 根据八字命盘生成个性化每日黄历
const C = require('./constants.js');

// ── 计算日柱与八字四柱的冲合关系 ──
function calcDayClash(dayBranch, baziPillars) {
  baziPillars = baziPillars || {};
  const result = {
    dayClash: false,
    monthBreak: false,
    yearHarm: false,
    dayHe: false,
    descriptions: []
  };

  // 日支分析
  if (baziPillars.day && baziPillars.day.branch) {
    const baziDayZhi = baziPillars.day.branch;
    // 日冲
    if (C.ZHI_CHONG[dayBranch] === baziDayZhi) {
      result.dayClash = true;
      result.descriptions.push(`今日${dayBranch}火冲${baziDayZhi}水，与您日柱相冲，注意情绪波动`);
    }
    // 日合
    if (C.ZHI_HE[dayBranch] && C.ZHI_HE[dayBranch][0] === baziDayZhi) {
      result.dayHe = true;
      result.descriptions.push(`今日${dayBranch}与日柱${baziDayZhi}相合，人际关系和谐`);
    }
    // 日害
    if (C.ZHI_HAI[dayBranch] === baziDayZhi) {
      result.descriptions.push(`今日${dayBranch}与日柱${baziDayZhi}相害，注意口舌是非`);
    }
  }

  // 月支分析
  if (baziPillars.month && baziPillars.month.branch) {
    const baziMonthZhi = baziPillars.month.branch;
    if (C.ZHI_CHONG[dayBranch] === baziMonthZhi) {
      result.monthBreak = true;
      result.descriptions.push(`今日冲月柱${baziMonthZhi}，工作环境中可能有变动`);
    }
  }

  // 年支分析
  if (baziPillars.year && baziPillars.year.branch) {
    const baziYearZhi = baziPillars.year.branch;
    if (C.ZHI_HAI[dayBranch] === baziYearZhi) {
      result.yearHarm = true;
      result.descriptions.push(`今日与年柱相害，注意家庭关系`);
    }
  }

  return result;
}

// ── 计算当日五行分数 ──
function calcWuxingScore(dayStem, dayBranch, userBazi) {
  const dayWx = C.GAN_WUXING[dayStem];
  const branchWx = C.ZHI_WUXING[dayBranch];
  const dayMasterWx = C.GAN_WUXING[userBazi.dayGan];
  const xiyong = userBazi.xiyong ? userBazi.xiyong.xiyong || [] : [];
  const jishen = userBazi.xiyong ? userBazi.xiyong.jishen || [] : [];

  let score = 50;
  const details = [];

  // 日干五行对日主的影响
  if (dayWx === dayMasterWx) {
    score += 5;
    details.push('今日与您五行相同，日常平稳');
  } else if (C.WUXING_SHENG[dayWx] === dayMasterWx) {
    score += 10;
    details.push('今日五行生您，运势上升');
  } else if (C.WUXING_KE[dayWx] === dayMasterWx) {
    score -= 8;
    details.push('今日五行克您，注意压力');
  } else if (C.WUXING_SHENG[dayMasterWx] === dayWx) {
    score -= 3;
    details.push('今日您生五行，付出较多');
  } else if (C.WUXING_KE[dayMasterWx] === dayWx) {
    score += 3;
    details.push('今日您克五行，可控范围内');
  }

  // 喜用神/忌神
  if (xiyong.includes(dayWx)) {
    score += 12;
    details.push(`今日五行"${dayWx}"为您的喜用神，诸事顺遂`);
  }
  if (jishen.includes(dayWx)) {
    score -= 12;
    details.push(`今日五行"${dayWx}"为您的忌神，宜低调行事`);
  }
  if (xiyong.includes(branchWx)) {
    score += 8;
    details.push(`日支五行"${branchWx}"助您喜神`);
  }
  if (jishen.includes(branchWx)) {
    score -= 8;
    details.push(`日支五行"${branchWx}"助您忌神`);
  }

  score = Math.max(5, Math.min(95, score));

  let level;
  if (score >= 80) level = '大吉';
  else if (score >= 60) level = '吉';
  else if (score >= 40) level = '平';
  else if (score >= 20) level = '凶';
  else level = '大凶';

  return { score: Math.round(score), level, details };
}

// ── 个性化宜忌过滤 ──
function filterActivities(baseYi, baseJi, userBazi, dayStem, dayBranch, pillars) {
  const dayWx = C.GAN_WUXING[dayStem];
  const dayMasterWx = C.GAN_WUXING[userBazi.dayGan];
  const personalYi = [...baseYi];
  const personalJi = [...baseJi];

  // 根据五行生克添加个性化宜忌
  if (C.WUXING_SHENG[dayWx] === dayMasterWx) {
    personalYi.push('学习', '创作', '约会', '谈判');
  }
  if (C.WUXING_KE[dayWx] === dayMasterWx) {
    personalJi.push('投资', '冒险', '争执');
    personalYi.push('静养', '反思', '整理');
  }

  // 根据日柱冲合
  const clash = calcDayClash(dayBranch, pillars);
  if (clash.dayClash) {
    personalJi.push('嫁娶', '开业', '签约');
    personalYi.push('静坐', '冥想', '打扫');
  }

  // 去重
  const uniqueYi = [...new Set(personalYi)];
  const uniqueJi = [...new Set(personalJi)];

  // 忌优先：从宜中移除与忌冲突的项
  const jiSet = new Set(uniqueJi);
  const finalYi = uniqueYi.filter(function(item) { return !jiSet.has(item); });

  return { yi: finalYi, ji: uniqueJi };
}

// ── 生成单日个性化黄历 ──
function generateDailyHuangli(dateStr, userBazi, baseHuangli) {
  const base = baseHuangli || {};
  const dayStem = base.dayStem || '甲';
  const dayBranch = base.dayBranch || '子';

  // 组装 pillars 对象（DB 中存储为 yearPillar/monthPillar/dayPillar/hourPillar）
  const pillars = userBazi.pillars || {
    year: userBazi.yearPillar || {},
    month: userBazi.monthPillar || {},
    day: userBazi.dayPillar || {},
    hour: userBazi.hourPillar || {}
  };

  // 五行评分
  const wuxingResult = calcWuxingScore(dayStem, dayBranch, userBazi);

  // 冲合分析
  const clashResult = calcDayClash(dayBranch, pillars);

  // 个性化宜忌
  const baseYi = base.yi || C.BASE_YI.slice(0, 10);
  const baseJi = base.ji || C.BASE_JI.slice(0, 8);
  const activities = filterActivities(baseYi, baseJi, userBazi, dayStem, dayBranch, pillars);

  // 五行运势
  const dayWx = C.GAN_WUXING[dayStem];
  const wuxingFortune = {
    wuxing: dayWx,
    description: generateWuxingFortuneText(dayWx, userBazi, wuxingResult)
  };

  return {
    date: dateStr,
    dayStem,
    dayBranch,
    fortuneScore: wuxingResult.score,
    fortuneLevel: wuxingResult.level,
    yi: activities.yi,
    ji: activities.ji,
    clash: clashResult,
    wuxingFortune,
    chongsha: generateChongshaText(dayBranch, base.clashAnimal),
    luckyDirection: generateLuckyDirection(dayStem),
    taishen: base.taishen || '房床碓外正东'
  };
}

// ── 辅助文本生成 ──
function generateWuxingFortuneText(dayWx, userBazi, wuxingResult) {
  const tips = {
    '木': ['宜早起锻炼', '宜阅读学习', '利于创新规划'],
    '火': ['宜社交活动', '宜展现自我', '注意情绪急躁'],
    '土': ['宜务实工作', '宜储蓄理财', '利于房产事宜'],
    '金': ['宜决策判断', '宜整理归纳', '注意人际摩擦'],
    '水': ['宜静心思考', '宜沟通交流', '利于学术研究']
  };
  const selected = tips[dayWx] || [];
  const score = wuxingResult.score;
  if (score >= 60) return selected[0] || '';
  if (score >= 40) return selected[1] || '';
  return selected[2] || '';
}

function generateChongshaText(dayBranch, clashAnimal) {
  const animal = C.ZHI_ANIMAL[dayBranch] || '';
  const chongZhi = C.ZHI_CHONG[dayBranch] || '';
  const chongAnimal = C.ZHI_ANIMAL[chongZhi] || '';
  if (clashAnimal) return `冲${clashAnimal}(${dayBranch}${chongAnimal})煞${getOppositeDirection(C.ZHI_WUXING[dayBranch])}`;
  return `冲${chongAnimal}(${chongZhi}${animal})煞北`;
}

function generateLuckyDirection(dayStem) {
  const dirs = { '甲': ['东南', '正东'], '乙': ['正东', '东南'], '丙': ['正南', '东南'], '丁': ['正南', '西南'], '戊': ['正中', '西南'], '己': ['正中', '西北'], '庚': ['正西', '西北'], '辛': ['正西', '东北'], '壬': ['正北', '正东'], '癸': ['正北', '东北'] };
  return dirs[dayStem] || ['正南', '正东'];
}

function getOppositeDirection(wx) {
  const m = { '木': '西', '火': '北', '土': '南', '金': '东', '水': '南' };
  return m[wx] || '北';
}

// ── 月黄历批量生成 ──
function generateMonthHuangli(year, month, userBazi, baseHuangliList) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const base = baseHuangliList ? baseHuangliList[d - 1] || {} : {};
    result.push(generateDailyHuangli(dateStr, userBazi, base));
  }
  return result;
}

module.exports = {
  calcDayClash, calcWuxingScore, filterActivities,
  generateDailyHuangli, generateMonthHuangli
};
