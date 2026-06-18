const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const baziCore = require('./bazi-core.js');

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    switch (event.type) {
    case 'calculateBazi': {
      const { year, month, day, hour, minute, gender, name, birthplace, birthProvince, birthCity, birthSolar, birthLunar, birthTime } = event;
      if (!year || !month || !day || !gender) {
        return { success: false, errMsg: '请提供完整的出生信息和性别' };
      }
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return { success: false, errMsg: '日期范围无效' };
      }
      const result = baziCore.fullBaziCalc({ year, month, day, hour: hour || 12, minute: minute || 0, gender });

      const record = {
        _openid: openid,
        name: name || '',
        gender,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
        birthHour: hour || 12,
        birthMinute: minute || 0,
        birthplace: birthplace || '',
        birthProvince: birthProvince || '',
        birthCity: birthCity || '',
        birthSolar: birthSolar || '',
        birthLunar: birthLunar || '',
        birthTime: birthTime || '',
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

    case 'updateBazi': {
      var baziId = event.baziId;
      if (!baziId) return { success: false, errMsg: '请提供八字ID' };
      var { year, month, day, hour, minute, gender, name, birthplace, birthProvince, birthCity, birthSolar, birthLunar, birthTime } = event;
      if (!year || !month || !day || !gender) {
        return { success: false, errMsg: '请提供完整的出生信息和性别' };
      }
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return { success: false, errMsg: '日期范围无效' };
      }
      // 验证所有权
      var existRes = await db.collection('bazi_records').where({ _openid: openid, _id: baziId }).get();
      if (existRes.data.length === 0) return { success: false, errMsg: '八字记录不存在' };

      var result = baziCore.fullBaziCalc({ year: year, month: month, day: day, hour: hour || 12, minute: minute || 0, gender: gender });

      var updateData = {
        name: name || '',
        gender: gender,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
        birthHour: hour || 12,
        birthMinute: minute || 0,
        birthplace: birthplace || '',
        birthProvince: birthProvince || '',
        birthCity: birthCity || '',
        birthSolar: birthSolar || '',
        birthLunar: birthLunar || '',
        birthTime: birthTime || '',
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
        updatedAt: db.serverDate()
      };

      await db.collection('bazi_records').doc(baziId).update({ data: updateData });
      // 删除旧黄历缓存（八字变了，旧数据不再有效）
      await db.collection('user_huangli').where({ _openid: openid, baziId: baziId }).remove();
      return { success: true, bazi: { ...updateData, _id: baziId } };
    }

    case 'getBaziRecord': {
      var query = { _openid: openid };
      if (event.baziId) { query._id = event.baziId; }
      var dbQuery = db.collection('bazi_records').where(query);
      if (!event.baziId) { dbQuery = dbQuery.orderBy('createdAt', 'desc').limit(1); }
      const res = await dbQuery.get();
      if (res.data.length === 0) return { success: false, errMsg: '未找到八字记录' };
      return { success: true, bazi: res.data[0] };
    }

    case 'listBaziRecords': {
      var page = event.page || 1;
      var pageSize = Math.min(event.pageSize || 20, 100);
      var skip = (page - 1) * pageSize;
      var totalRes = await db.collection('bazi_records').where({ _openid: openid }).count();
      var listRes = await db.collection('bazi_records')
        .where({ _openid: openid })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();
      return { success: true, records: listRes.data, total: totalRes.total, page: page, pageSize: pageSize };
    }

    case 'deleteBaziRecord': {
      var baziId = event.baziId;
      if (!baziId) return { success: false, errMsg: '请提供八字ID' };
      var baziRes = await db.collection('bazi_records').where({ _openid: openid, _id: baziId }).get();
      if (baziRes.data.length === 0) return { success: false, errMsg: '八字记录不存在' };
      await db.collection('bazi_records').doc(baziId).remove();
      // Delete all associated huangli data
      await db.collection('user_huangli').where({ _openid: openid, baziId: baziId }).remove();
      var remainingRes = await db.collection('bazi_records').where({ _openid: openid }).count();
      return { success: true, remainingCount: remainingRes.total };
    }

      default:
        return { success: false, errMsg: '未知操作类型' };
    }
  } catch (err) {
    console.error('[baziFunctions][' + (event && event.type) + ']', err);
    return { success: false, errMsg: '服务异常，请稍后重试', errDetail: err.message || String(err) };
  }
};
