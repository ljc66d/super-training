/**
 * 本地存储封装（对齐 RN 端 utils/storage.ts 的键名习惯）
 * 小程序存储上限 10MB，图片类数据不要入缓存。
 */

const KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
};

export const storage = {
  getToken(): string {
    return wx.getStorageSync(KEYS.TOKEN) || '';
  },
  setToken(token: string | null) {
    if (token) {
      wx.setStorageSync(KEYS.TOKEN, token);
    } else {
      wx.removeStorageSync(KEYS.TOKEN);
    }
  },
  getUser(): any {
    return wx.getStorageSync(KEYS.USER) || null;
  },
  setUser(user: any | null) {
    if (user) {
      wx.setStorageSync(KEYS.USER, user);
    } else {
      wx.removeStorageSync(KEYS.USER);
    }
  },
  clearAuth() {
    wx.removeStorageSync(KEYS.TOKEN);
    wx.removeStorageSync(KEYS.USER);
  },
  get(key: string, fallback: any = null) {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined ? fallback : v;
  },
  set(key: string, value: any) {
    wx.setStorageSync(key, value);
  },
  remove(key: string) {
    wx.removeStorageSync(key);
  },
};
