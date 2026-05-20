// 本地缓存工具

const CACHE_PREFIX = 'hl_';
const DEFAULT_EXPIRE = 24 * 60 * 60 * 1000; // 24小时

function set(key, value, expireMs = DEFAULT_EXPIRE) {
  const data = {
    value,
    expireAt: Date.now() + expireMs
  };
  try {
    wx.setStorageSync(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Cache set failed:', e);
  }
}

function get(key) {
  try {
    const raw = wx.getStorageSync(CACHE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expireAt) {
      wx.removeStorageSync(CACHE_PREFIX + key);
      return null;
    }
    return data.value;
  } catch (e) {
    return null;
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(CACHE_PREFIX + key);
  } catch (e) { /* ignore */ }
}

function clear() {
  try {
    const info = wx.getStorageInfoSync();
    info.keys.forEach(k => {
      if (k.startsWith(CACHE_PREFIX)) wx.removeStorageSync(k);
    });
  } catch (e) { /* ignore */ }
}

// 缓存今天的黄历
function cacheTodayHuangli(data) {
  const today = formatDate(new Date());
  set('today_huangli_' + today, data, 3600000); // 1小时过期
}

function getCachedTodayHuangli() {
  const today = formatDate(new Date());
  return get('today_huangli_' + today);
}

// 缓存月黄历
function cacheMonthHuangli(year, month, data) {
  set(`month_huangli_${year}_${month}`, data, 12 * 3600000); // 12小时
}

function getCachedMonthHuangli(year, month) {
  return get(`month_huangli_${year}_${month}`);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { set, get, remove, clear, cacheTodayHuangli, getCachedTodayHuangli, cacheMonthHuangli, getCachedMonthHuangli, formatDate };
