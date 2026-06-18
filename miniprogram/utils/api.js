// 云函数调用封装

// 判断是否为可重试错误（超时、网络、冷启动）
function isRetriableError(err) {
  var msg = (err.errMsg || err.message || '').toLowerCase();
  return msg.indexOf('timeout') !== -1 || msg.indexOf('time out') !== -1 ||
         msg.indexOf('network') !== -1 ||
         msg.indexOf('functions execute fail') !== -1;
}

// 错误码映射
function parseError(err) {
  var msg = (err.errMsg || err.message || '').toLowerCase();
  console.error('[API Error]', JSON.stringify(err), 'msg:', msg);

  if (msg.indexOf('function not found') !== -1 || msg.indexOf('functionname') !== -1) {
    return '云函数未部署\n请在微信开发者工具中\n右键 cloudfunctions 目录下的云函数\n选择「上传并部署」';
  }
  if (msg.indexOf('collection not found') !== -1 || msg.indexOf('collection does not exist') !== -1) {
    return '数据库集合不存在\n请在云开发控制台中\n创建 users、bazi_records、user_huangli 三个集合';
  }
  if (msg.indexOf('environment not found') !== -1 || msg.indexOf('env') !== -1) {
    return '云开发环境未找到\n请在 app.js 中配置正确的 env 环境ID\n并在开发者工具中开通云开发';
  }
  if (msg.indexOf('permission denied') !== -1 || msg.indexOf('auth') !== -1) {
    return '权限不足\n请检查数据库集合权限设置\n改为「仅创建者可读写」';
  }
  if (msg.indexOf('timeout') !== -1 || msg.indexOf('time out') !== -1) {
    return '请求超时\n请检查网络连接\n或重试';
  }
  if (msg.indexOf('network') !== -1 || msg.indexOf('fail') !== -1) {
    return '网络连接失败\n请检查网络状态\n云函数可能未部署或冷启动中';
  }
  return '请求失败: ' + (err.errMsg || err.message || '未知错误');
}

var MAX_RETRIES = 2;
var RETRY_DELAY = 1000; // ms

function callFunction(name, data, options) {
  options = options || {};
  var showLoading = options.showLoading !== false;
  var loadingTitle = options.loadingTitle || '';
  if (showLoading) {
    wx.showLoading({ title: loadingTitle || '加载中...', mask: true });
  }
  console.log('[API] Calling', name, data);

  function attempt(remainingRetries) {
    return wx.cloud.callFunction({ name: name, data: data })
      .then(function(res) {
        if (showLoading) wx.hideLoading();
        console.log('[API]', name, 'success');
        return res.result;
      })
      .catch(function(err) {
        if (remainingRetries > 0 && isRetriableError(err)) {
          console.log('[API]', name, 'retrying, attempts left:', remainingRetries);
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve(attempt(remainingRetries - 1));
            }, RETRY_DELAY * (MAX_RETRIES - remainingRetries + 1));
          });
        }
        if (showLoading) wx.hideLoading();
        var errMsg = parseError(err);
        wx.showModal({
          title: '请求异常',
          content: errMsg,
          showCancel: false
        });
        throw err;
      });
  }

  return attempt(MAX_RETRIES);
}

function getUserProfile() {
  return callFunction('userFunctions', { type: 'getUserProfile' }, { showLoading: false });
}

function getOrCreateUser() {
  return callFunction('userFunctions', { type: 'getOrCreateUser' }, { showLoading: false });
}

function updateProfile(data) {
  data.type = 'updateProfile';
  return callFunction('userFunctions', data, { loadingTitle: '保存中...' });
}

function calculateBazi(data) {
  data.type = 'calculateBazi';
  return callFunction('baziFunctions', data, { loadingTitle: '排盘计算中...' });
}

function getBaziRecord() {
  return callFunction('baziFunctions', { type: 'getBaziRecord' }, { showLoading: false });
}

function getTodayHuangli(year, month, day, baziId) {
  var data = { type: 'getTodayHuangli', year: year, month: month, day: day };
  if (baziId) data.baziId = baziId;
  return callFunction('huangliFunctions', data, { showLoading: false });
}

function getMonthHuangli(year, month, baziId) {
  var data = { type: 'getMonthHuangli', year: year, month: month };
  if (baziId) data.baziId = baziId;
  return callFunction('huangliFunctions', data, { loadingTitle: '加载黄历...' });
}

function listBaziRecords(page, pageSize) {
  return callFunction('baziFunctions', {
    type: 'listBaziRecords',
    page: page || 1,
    pageSize: pageSize || 20
  }, { showLoading: false });
}

function deleteBaziRecord(baziId) {
  return callFunction('baziFunctions', {
    type: 'deleteBaziRecord',
    baziId: baziId
  }, { loadingTitle: '删除中...' });
}

function setActiveBazi(baziId) {
  return callFunction('userFunctions', {
    type: 'setActiveBazi',
    baziId: baziId || ''
  }, { showLoading: false });
}

function updateBaziRecord(baziId, data) {
  data.type = 'updateBazi';
  data.baziId = baziId;
  return callFunction('baziFunctions', data, { loadingTitle: '更新排盘...' });
}

function preGenerateHuangli(baziId, year, month, numMonths) {
  return callFunction('huangliFunctions', {
    type: 'preGenerateHuangli',
    baziId: baziId,
    year: year,
    month: month,
    numMonths: numMonths || 1
  }, { showLoading: false });
}

module.exports = {
  callFunction: callFunction,
  getUserProfile: getUserProfile,
  getOrCreateUser: getOrCreateUser,
  updateProfile: updateProfile,
  calculateBazi: calculateBazi,
  getBaziRecord: getBaziRecord,
  getTodayHuangli: getTodayHuangli,
  getMonthHuangli: getMonthHuangli,
  listBaziRecords: listBaziRecords,
  deleteBaziRecord: deleteBaziRecord,
  setActiveBazi: setActiveBazi,
  preGenerateHuangli: preGenerateHuangli,
  updateBaziRecord: updateBaziRecord
};
