const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const baziCore = require('./bazi-core.js');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (event.type) {
    case 'calculateBazi': {
      const { year, month, day, hour, minute, gender } = event;
      if (!year || !month || !day || !gender) {
        return { success: false, errMsg: '请提供完整的出生信息和性别' };
      }
      const result = baziCore.fullBaziCalc({ year, month, day, hour: hour || 12, minute: minute || 0, gender });

      const record = {
        _openid: openid,
        gender,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
        birthHour: hour || 12,
        birthMinute: minute || 0,
        yearPillar: { stem: result.pillars.year.stem, branch: result.pillars.year.branch, shishen: result.pillars.year.shishen, canggan: result.pillars.year.canggan },
        monthPillar: { stem: result.pillars.month.stem, branch: result.pillars.month.branch, shishen: result.pillars.month.shishen, canggan: result.pillars.month.canggan },
        dayPillar: { stem: result.pillars.day.stem, branch: result.pillars.day.branch, shishen: result.pillars.day.shishen, canggan: result.pillars.day.canggan },
        hourPillar: result.pillars.hour.stem ? { stem: result.pillars.hour.stem, branch: result.pillars.hour.branch, shishen: result.pillars.hour.shishen, canggan: result.pillars.hour.canggan } : null,
        dayMaster: result.dayGan,
        strength: result.strength,
        wuxingCount: result.wuxingCount,
        xiyong: result.xiyong,
        pattern: result.pattern,
        dayun: result.dayun,
        shensha: result.shensha,
        createdAt: db.serverDate()
      };

      const addRes = await db.collection('bazi_records').add({ data: record });
      return { success: true, bazi: { ...record, _id: addRes._id } };
    }

    case 'getBaziRecord': {
      const res = await db.collection('bazi_records').where({ _openid: openid }).orderBy('createdAt', 'desc').limit(1).get();
      if (res.data.length === 0) return { success: false, errMsg: '未找到八字记录' };
      return { success: true, bazi: res.data[0] };
    }

    default:
      return { success: false, errMsg: '未知操作类型' };
  }
};
