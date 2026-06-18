const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const baziCore = require('./bazi-core.js');
const huangliEngine = require('./huangli-engine.js');
const calendarData = require('./calendar-data.js');

// Helper: load BaZi by id or fallback to latest
async function loadBazi(openid, baziId) {
  var query = { _openid: openid };
  if (baziId) { query._id = baziId; }
  var dbQuery = db.collection('bazi_records').where(query);
  if (!baziId) { dbQuery = dbQuery.orderBy('createdAt', 'desc').limit(1); }
  const res = await dbQuery.get();
  if (res.data.length === 0) return null;
  return res.data[0];
}

// Helper: build base huangli data for a single day
function buildBaseHuangli(year, month, day, getJieqiFn) {
  const dayGZ = calendarData.getDayGanZhi(year, month, day);
  const lunar = calendarData.solarToLunar(year, month, day);
  const monthZhi = baziCore.calcMonthPillar(year, month, day, getJieqiFn).branch;
  return {
    dayStem: dayGZ.stem,
    dayBranch: dayGZ.branch,
    lunarYear: lunar.year,
    lunarMonth: lunar.month,
    lunarDay: lunar.day,
    lunarMonthName: lunar.monthName,
    lunarDayName: lunar.dayName,
    isLeap: lunar.isLeap,
    jianchu: calendarData.getJianchu(monthZhi, dayGZ.branch)
  };
}

// ── DeepSeek API ──

function callDeepSeek(apiKey, messages) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    });

    var req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var result = JSON.parse(body);
          if (result.choices && result.choices[0] && result.choices[0].message) {
            resolve(result.choices[0].message.content);
          } else if (result.error) {
            reject(new Error(result.error.message || 'API error'));
          } else {
            reject(new Error('Unexpected response: ' + body.substring(0, 200)));
          }
        } catch(e) {
          reject(new Error('Parse error: ' + body.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('DeepSeek timeout')); });
    req.write(data);
    req.end();
  });
}

function callDeepSeekWithRetry(apiKey, messages, maxRetries) {
  var retries = maxRetries || 2;
  var delay = 2000;

  return callDeepSeek(apiKey, messages).catch(function(err) {
    if (retries <= 0) throw err;
    console.log('[DeepSeek] retrying, attempts left:', retries, err.message);
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        callDeepSeekWithRetry(apiKey, messages, retries - 1).then(resolve).catch(reject);
      }, delay);
      delay = delay * 2;
    });
  });
}

// ── Prompt Builders ──

function buildSystemPrompt() {
  return '你是一位精通中国传统命理学的专家，擅长基于八字命盘进行每日运势分析。' +
    '你深入研习《穷通宝典》《三命通会》《滴天髓》《渊海子平》《子平真诠》等经典典籍。\n\n' +
    '你的分析维度：\n' +
    '1. 以日主为核心，分析当日干支与日主的五行生克关系（比劫、食伤、财、官杀、印）\n' +
    '2. 结合月令旺衰，判断日主在当月的得令情况\n' +
    '3. 参考喜用神和忌神，分析当日干支对命主运势的助益或制约\n' +
    '4. 结合建除十二神（建除满平定执破危成收开闭）判断当日宜忌基调\n' +
    '5. 留意干支冲合刑害关系，评估人际、健康、事业等维度\n' +
    '6. 宜忌推导需具体实用，涵盖婚丧嫁娶、开业动土、祭祀签约、出行会友、求医疗病、理财交易等\n\n' +
    '请严格按照JSON格式返回分析结果，不要添加任何解释文字。';
}

function buildUserPrompt(userBazi, dateStr, baseHuangli) {
  var yp = userBazi.yearPillar || {};
  var mp = userBazi.monthPillar || {};
  var dp = userBazi.dayPillar || {};
  var hp = userBazi.hourPillar || {};

  var xiyongArr = (userBazi.xiyong && userBazi.xiyong.xiyong) ? userBazi.xiyong.xiyong : [];
  var jishenArr = (userBazi.xiyong && userBazi.xiyong.jishen) ? userBazi.xiyong.jishen : [];

  var currentDayun = getCurrentDayun(userBazi.dayun, userBazi.birthYear);

  var parts = [];

  // BaZi
  parts.push('【命主八字】');
  parts.push('年柱：' + (yp.stem||'?') + (yp.branch||'?') + '（十神：' + (yp.shishen||'') + '，藏干：' + (yp.canggan||[]).join('、') + '）');
  parts.push('月柱：' + (mp.stem||'?') + (mp.branch||'?') + '（十神：' + (mp.shishen||'') + '，藏干：' + (mp.canggan||[]).join('、') + '）');
  parts.push('日柱：' + (dp.stem||'?') + (dp.branch||'?') + '（十神：' + (dp.shishen||'') + '，藏干：' + (dp.canggan||[]).join('、') + '）');
  parts.push('时柱：' + (hp.stem||'?') + (hp.branch||'?') + '（十神：' + (hp.shishen||'') + '，藏干：' + (hp.canggan||[]).join('、') + '）');
  parts.push('日主：' + (userBazi.dayMaster || '?'));
  parts.push('命局强弱：' + (userBazi.strength ? userBazi.strength.strength : '?'));
  parts.push('格局：' + (userBazi.pattern || '?'));
  parts.push('喜用神：' + (xiyongArr.length > 0 ? xiyongArr.join('、') : '无'));
  parts.push('忌神：' + (jishenArr.length > 0 ? jishenArr.join('、') : '无'));

  // Dayun
  parts.push('');
  parts.push('【大运】');
  if (userBazi.dayun) {
    parts.push('大运方向：' + (userBazi.dayun.direction || '?'));
    parts.push('起运年龄：' + (userBazi.dayun.qiyunAge || 0) + '岁');
    parts.push('当前大运干支：' + (currentDayun.stem||'?') + (currentDayun.branch||'?'));
  } else {
    parts.push('无大运信息');
  }

  // Day info
  parts.push('');
  parts.push('【当日信息】');
  parts.push('公历日期：' + dateStr);
  parts.push('农历日期：' + (baseHuangli.lunarMonthName || '') + (baseHuangli.lunarDayName || ''));
  var yearGZ = calendarData.getYearGanZhi ? calendarData.getYearGanZhi(parseInt(dateStr.split('-')[0])) : { stem: '?', branch: '?' };
  parts.push('当日年柱：' + (yearGZ.stem||'?') + (yearGZ.branch||'?'));
  var monthGZ = baziCore.calcMonthPillar ? baziCore.calcMonthPillar(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]), parseInt(dateStr.split('-')[2]), null) : { stem: '?', branch: '?' };
  parts.push('当月月柱：' + (monthGZ.stem||'?') + (monthGZ.branch||'?'));
  parts.push('当日日柱：' + (baseHuangli.dayStem||'?') + (baseHuangli.dayBranch||'?'));
  parts.push('建除：' + (baseHuangli.jianchu || '?'));

  parts.push('');
  parts.push('请严格返回如下JSON格式（不要包含任何其他文字）：');
  parts.push('{"fortuneScore":85,"fortuneLevel":"吉","yi":["出行","会友","签约"],"ji":["动土","嫁娶"],"notes":"日主得令，五行流通..."}');
  parts.push('');
  parts.push('要求：fortuneScore为0~100整数，fortuneLevel为大吉/吉/平/凶/大凶之一，yi和ji各3~6项，notes为50~150字的当日运势综合分析。');

  return parts.join('\n');
}

// ── Response Parser ──

function parseDeepSeekResponse(content, fallbackHuangli) {
  try {
    var cleaned = content.trim();
    // Strip markdown code fences if present
    if (cleaned.indexOf('```') === 0) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }
    var parsed = JSON.parse(cleaned);

    var score = parseInt(parsed.fortuneScore);
    if (isNaN(score) || score < 0 || score > 100) {
      score = fallbackHuangli ? fallbackHuangli.fortuneScore : 50;
    }

    var validLevels = { '大吉': true, '吉': true, '平': true, '凶': true, '大凶': true };
    var level = validLevels[parsed.fortuneLevel] ? parsed.fortuneLevel :
      (fallbackHuangli ? fallbackHuangli.fortuneLevel : '平');

    var yi = Array.isArray(parsed.yi) ? parsed.yi :
      (fallbackHuangli ? (fallbackHuangli.yi || []) : []);
    var ji = Array.isArray(parsed.ji) ? parsed.ji :
      (fallbackHuangli ? (fallbackHuangli.ji || []) : []);
    var notes = typeof parsed.notes === 'string' ? parsed.notes : '';

    // Cross-list dedup: items in ji removed from yi
    var jiSet = {};
    ji.forEach(function(item) { jiSet[item] = true; });
    yi = yi.filter(function(item) { return !jiSet[item]; });

    return {
      fortuneScore: score,
      fortuneLevel: level,
      yi: yi,
      ji: ji,
      notes: notes
    };
  } catch(e) {
    console.log('[DeepSeek] parse error, using fallback:', e.message);
    if (fallbackHuangli) {
      return {
        fortuneScore: fallbackHuangli.fortuneScore,
        fortuneLevel: fallbackHuangli.fortuneLevel,
        yi: fallbackHuangli.yi || [],
        ji: fallbackHuangli.ji || [],
        notes: ''
      };
    }
    return { fortuneScore: 50, fortuneLevel: '平', yi: [], ji: [], notes: '' };
  }
}

// ── Dayun Helper ──

function getCurrentDayun(dayun, birthYear) {
  if (!dayun || !dayun.dayunList || !dayun.dayunList.length) {
    return { stem: '?', branch: '?' };
  }
  var now = new Date();
  var age = now.getFullYear() - birthYear;
  for (var i = 0; i < dayun.dayunList.length; i++) {
    if (age >= dayun.dayunList[i].ageStart && age <= dayun.dayunList[i].ageEnd) {
      return { stem: dayun.dayunList[i].stem, branch: dayun.dayunList[i].branch };
    }
  }
  // Fallback: return last dayun if age exceeds all ranges
  var last = dayun.dayunList[dayun.dayunList.length - 1];
  return { stem: last.stem, branch: last.branch };
}

// ── Main ──

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    switch (event.type) {
      case 'getTodayHuangli': {
        const now = new Date();
        const year = event.year || now.getFullYear();
        const month = event.month || (now.getMonth() + 1);
        const day = event.day || now.getDate();

        const userBazi = await loadBazi(openid, event.baziId);
        if (!userBazi) {
          return { success: false, errMsg: '请先完成八字排盘' };
        }

        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // 查找缓存（按 baziId 隔离）
        const cacheRes = await db.collection('user_huangli').where({
          _openid: openid,
          date: dateStr,
          baziId: userBazi._id
        }).limit(1).get();
        if (cacheRes.data.length > 0) {
          return { success: true, huangli: cacheRes.data[0], fromCache: true };
        }

        const baseHuangli = buildBaseHuangli(year, month, day);
        const personalized = huangliEngine.generateDailyHuangli(dateStr, userBazi, baseHuangli);

        const huangliRecord = {
          _openid: openid,
          date: dateStr,
          ...personalized,
          baziId: userBazi._id,
          createdAt: db.serverDate()
        };

        await db.collection('user_huangli').add({ data: huangliRecord });
        return { success: true, huangli: huangliRecord, fromCache: false };
      }

      case 'getMonthHuangli': {
        const { year, month } = event;
        if (!year || !month) return { success: false, errMsg: '请提供年份和月份' };

        const userBazi = await loadBazi(openid, event.baziId);
        if (!userBazi) return { success: false, errMsg: '请先完成八字排盘' };

        const daysInMonth = new Date(year, month, 0).getDate();
        const dateStrs = [];
        for (let d = 1; d <= daysInMonth; d++) {
          dateStrs.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }

        // 批量查询缓存（按 baziId 隔离）
        const _ = db.command;
        const cacheRes = await db.collection('user_huangli').where({
          _openid: openid,
          date: _.in(dateStrs),
          baziId: userBazi._id
        }).limit(daysInMonth).get();
        const cacheMap = {};
        cacheRes.data.forEach(function(item) { cacheMap[item.date] = item; });

        // 预计算全年节气
        const jieqiCache = {};
        function getJieqiCached(y, jieName) {
          var key = y + '-' + jieName;
          if (!jieqiCache[key]) {
            jieqiCache[key] = baziCore.getJieqiDate(y, jieName);
          }
          return jieqiCache[key];
        }

        const results = [];
        const newRecords = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = dateStrs[d - 1];

          if (cacheMap[dateStr]) {
            results.push(cacheMap[dateStr]);
            continue;
          }

          const baseHuangli = buildBaseHuangli(year, month, d, getJieqiCached);
          const personalized = huangliEngine.generateDailyHuangli(dateStr, userBazi, baseHuangli);
          results.push(personalized);
          newRecords.push({
            _openid: openid,
            date: dateStr,
            ...personalized,
            baziId: userBazi._id,
            createdAt: db.serverDate()
          });
        }

        if (newRecords.length > 0) {
          await Promise.all(newRecords.map(function(rec) {
            return db.collection('user_huangli').add({ data: rec });
          }));
        }

        return { success: true, monthData: results };
      }

      case 'preGenerateHuangli': {
        const { baziId, year, month, numMonths } = event;
        if (!baziId || !year || !month) {
          return { success: false, errMsg: '请提供 baziId, year, month' };
        }

        const userBazi = await loadBazi(openid, baziId);
        if (!userBazi) return { success: false, errMsg: '八字记录不存在' };

        // Read API key from environment
        const apiKey = process.env.DEEPSEEK_API_KEY || '';
        const useAI = apiKey.length > 0;

        var totalGenerated = 0;
        var monthsToGenerate = numMonths || 1;
        const _ = db.command;

        for (var m = 0; m < monthsToGenerate; m++) {
          var targetYear = year;
          var targetMonth = month + m;
          while (targetMonth > 12) { targetYear++; targetMonth -= 12; }

          var daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
          var dateStrs = [];
          for (var d = 1; d <= daysInMonth; d++) {
            dateStrs.push(targetYear + '-' + String(targetMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
          }

          // Check existing cache
          var cacheRes = await db.collection('user_huangli').where({
            _openid: openid,
            baziId: baziId,
            date: _.in(dateStrs)
          }).limit(daysInMonth).get();
          var cachedDates = {};
          cacheRes.data.forEach(function(item) { cachedDates[item.date] = true; });

          // Collect uncached days
          var uncachedDays = [];
          for (var d = 1; d <= daysInMonth; d++) {
            if (!cachedDates[dateStrs[d - 1]]) {
              uncachedDays.push(d);
            }
          }

          if (uncachedDays.length === 0) continue;

          var jieqiCache = {};
          function getJieqiCached(y, jieName) {
            var key = y + '-' + jieName;
            if (!jieqiCache[key]) { jieqiCache[key] = baziCore.getJieqiDate(y, jieName); }
            return jieqiCache[key];
          }

          var newRecords = [];
          var BATCH_SIZE = 5;
          var BATCH_DELAY = 600; // ms

          for (var i = 0; i < uncachedDays.length; i += BATCH_SIZE) {
            var batch = uncachedDays.slice(i, i + BATCH_SIZE);

            var batchPromises = batch.map(function(d) {
              var dateStr = dateStrs[d - 1];
              var baseHuangli = buildBaseHuangli(targetYear, targetMonth, d, getJieqiCached);

              // Always generate local fallback once (used for structural fields + DeepSeek fallback)
              var fallback = huangliEngine.generateDailyHuangli(dateStr, userBazi, baseHuangli);

              if (!useAI) {
                return Promise.resolve({
                  date: dateStr,
                  baseHuangli: baseHuangli,
                  fallback: fallback,
                  result: {
                    fortuneScore: fallback.fortuneScore,
                    fortuneLevel: fallback.fortuneLevel,
                    yi: fallback.yi,
                    ji: fallback.ji,
                    notes: ''
                  }
                });
              }

              var messages = [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: buildUserPrompt(userBazi, dateStr, baseHuangli) }
              ];

              return callDeepSeekWithRetry(apiKey, messages, 2).then(function(content) {
                var aiResult = parseDeepSeekResponse(content, fallback);
                return { date: dateStr, baseHuangli: baseHuangli, fallback: fallback, result: aiResult };
              }).catch(function(err) {
                console.log('[DeepSeek] fallback for ' + dateStr + ':', err.message);
                return {
                  date: dateStr, baseHuangli: baseHuangli, fallback: fallback,
                  result: {
                    fortuneScore: fallback.fortuneScore,
                    fortuneLevel: fallback.fortuneLevel,
                    yi: fallback.yi || [],
                    ji: fallback.ji || [],
                    notes: ''
                  }
                };
              });
            });

            var batchResults = await Promise.all(batchPromises);

            for (var j = 0; j < batchResults.length; j++) {
              var item = batchResults[j];
              var rec = {
                _openid: openid,
                date: item.date,
                baziId: baziId,
                dayStem: item.baseHuangli.dayStem,
                dayBranch: item.baseHuangli.dayBranch,
                fortuneScore: item.result.fortuneScore,
                fortuneLevel: item.result.fortuneLevel,
                yi: item.result.yi,
                ji: item.result.ji,
                notes: item.result.notes || '',
                clash: item.fallback.clash,
                wuxingFortune: item.fallback.wuxingFortune,
                chongsha: item.fallback.chongsha,
                luckyDirection: item.fallback.luckyDirection,
                taishen: item.fallback.taishen,
                jianchu: item.baseHuangli.jianchu,
                lunarMonthName: item.baseHuangli.lunarMonthName,
                lunarDayName: item.baseHuangli.lunarDayName,
                createdAt: db.serverDate()
              };

              newRecords.push(rec);
              totalGenerated++;
            }

            // Batch delay to respect rate limits
            if (i + BATCH_SIZE < uncachedDays.length) {
              await new Promise(function(resolve) {
                setTimeout(resolve, BATCH_DELAY);
              });
            }
          }

          // Batch write all new records
          if (newRecords.length > 0) {
            await Promise.all(newRecords.map(function(rec) {
              return db.collection('user_huangli').add({ data: rec });
            }));
          }
        }

        return { success: true, totalGenerated: totalGenerated, aiEnabled: useAI };
      }

      default:
        return { success: false, errMsg: '未知操作类型' };
    }
  } catch (err) {
    console.error('[huangliFunctions][' + (event && event.type) + ']', err);
    return { success: false, errMsg: '服务异常，请稍后重试', errDetail: err.message || String(err) };
  }
};
