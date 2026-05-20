const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const baziCore = require('./bazi-core.js');
const huangliEngine = require('./huangli-engine.js');
const calendarData = require('./calendar-data.js');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (event.type) {
    case 'getTodayHuangli': {
      const now = new Date();
      const year = event.year || now.getFullYear();
      const month = event.month || (now.getMonth() + 1);
      const day = event.day || now.getDate();

      // 获取用户八字
      const baziRes = await db.collection('bazi_records').where({ _openid: openid }).orderBy('createdAt', 'desc').limit(1).get();
      if (baziRes.data.length === 0) {
        return { success: false, errMsg: '请先完成八字排盘' };
      }
      const userBazi = baziRes.data[0];

      // 获取或生成当日黄历
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // 查找缓存
      const cacheRes = await db.collection('user_huangli').where({ _openid: openid, date: dateStr }).limit(1).get();
      if (cacheRes.data.length > 0) {
        return { success: true, huangli: cacheRes.data[0], fromCache: true };
      }

      // 生成基础黄历数据
      const dayGZ = calendarData.getDayGanZhi(year, month, day);
      const lunar = calendarData.solarToLunar(year, month, day);

      const baseHuangli = {
        dayStem: dayGZ.stem,
        dayBranch: dayGZ.branch,
        lunarYear: lunar.year,
        lunarMonth: lunar.month,
        lunarDay: lunar.day,
        lunarMonthName: lunar.monthName,
        lunarDayName: lunar.dayName,
        isLeap: lunar.isLeap,
        jianchu: calendarData.getJianchu(
          baziCore.calcMonthPillar(year, month, day).branch,
          dayGZ.branch
        )
      };

      const personalized = huangliEngine.generateDailyHuangli(dateStr, userBazi, baseHuangli);

      // 存储个性化黄历
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

      const baziRes = await db.collection('bazi_records').where({ _openid: openid }).orderBy('createdAt', 'desc').limit(1).get();
      if (baziRes.data.length === 0) return { success: false, errMsg: '请先完成八字排盘' };
      const userBazi = baziRes.data[0];

      const daysInMonth = new Date(year, month, 0).getDate();
      const results = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // 检查缓存
        const cacheRes = await db.collection('user_huangli').where({ _openid: openid, date: dateStr }).limit(1).get();
        if (cacheRes.data.length > 0) {
          results.push(cacheRes.data[0]);
          continue;
        }

        const dayGZ = calendarData.getDayGanZhi(year, month, d);
        const lunar = calendarData.solarToLunar(year, month, d);
        const monthZhi = baziCore.calcMonthPillar(year, month, d).branch;

        const baseHuangli = {
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

        const personalized = huangliEngine.generateDailyHuangli(dateStr, userBazi, baseHuangli);
        results.push(personalized);
      }

      return { success: true, monthData: results };
    }

    default:
      return { success: false, errMsg: '未知操作类型' };
  }
};
