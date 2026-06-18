const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    switch (event.type) {
    case 'getOrCreateUser': {
      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data.length > 0) {
        return { success: true, user: res.data[0], isNew: false };
      }
      const newUser = {
        _openid: openid,
        nickName: '',
        avatarUrl: '',
        gender: '',
        birthSolar: '',
        birthLunar: '',
        birthTime: '',
        birthHourMinute: '',
        birthplace: '',
        birthProvince: '',
        birthCity: '',
        activeBaziId: '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      const addRes = await db.collection('users').add({ data: newUser });
      return { success: true, user: { ...newUser, _id: addRes._id }, isNew: true };
    }

    case 'updateProfile': {
      const { nickName, avatarUrl, gender, birthSolar, birthLunar, birthTime, birthHourMinute, birthplace, birthProvince, birthCity } = event;
      const updateData = {
        nickName: nickName || '',
        avatarUrl: avatarUrl || '',
        gender: gender || '',
        birthSolar: birthSolar || '',
        birthLunar: birthLunar || '',
        birthTime: birthTime || '',
        birthHourMinute: birthHourMinute || '',
        birthplace: birthplace || '',
        birthProvince: birthProvince || '',
        birthCity: birthCity || '',
        updatedAt: db.serverDate()
      };
      await db.collection('users').where({ _openid: openid }).update({ data: updateData });
      return { success: true };
    }

    case 'getUserProfile': {
      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data.length === 0) return { success: false, errMsg: '用户不存在' };
      const user = res.data[0];
      const baziRes = await db.collection('bazi_records').where({ _openid: openid }).orderBy('createdAt', 'desc').limit(20).get();
      return {
        success: true,
        user: user,
        baziRecords: baziRes.data,
        activeBaziId: user.activeBaziId || ''
      };
    }

    case 'setActiveBazi': {
      var baziId = event.baziId || '';
      await db.collection('users').where({ _openid: openid }).update({
        data: { activeBaziId: baziId, updatedAt: db.serverDate() }
      });
      return { success: true };
    }

      default:
        return { success: false, errMsg: '未知操作类型' };
    }
  } catch (err) {
    console.error('[userFunctions][' + (event && event.type) + ']', err);
    return { success: false, errMsg: '服务异常，请稍后重试', errDetail: err.message || String(err) };
  }
};
