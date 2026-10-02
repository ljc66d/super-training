/**
 * 登录态管理：微信一键登录（wx.login → /auth/wx-login）+ token 持久化
 * 对齐 RN 端 AuthContext 的行为：恢复登录态 / 登出 / 更新用户。
 */
import { api } from './api';
import { storage } from './storage';
import { normalizeUser } from './url';

export interface AuthState {
  token: string;
  user: any;
}

export function restoreAuth(): AuthState | null {
  const token = storage.getToken();
  const user = storage.getUser();
  if (!token) return null;
  // 本地缓存里可能存着旧的相对路径头像，恢复时一并转成绝对地址
  return { token, user: normalizeUser(user) };
}

/** 保存登录态到全局 + 本地 */
export function saveAuth(token: string, user: any) {
  const normalized = normalizeUser(user);
  storage.setToken(token);
  storage.setUser(normalized);
  const app = getApp<any>();
  if (app) {
    app.globalData.token = token;
    app.globalData.user = normalized;
  }
}

/** 更新当前用户（画像编辑后调用） */
export function updateUser(user: any) {
  const normalized = normalizeUser(user);
  storage.setUser(normalized);
  const app = getApp<any>();
  if (app) app.globalData.user = normalized;
}

export function logout() {
  storage.clearAuth();
  const app = getApp<any>();
  if (app) {
    app.globalData.token = '';
    app.globalData.user = null;
  }
  wx.reLaunch({ url: '/pages/login/login' });
}

/**
 * 微信一键登录：wx.login 拿 code，后端换 openid 建号并发 JWT。
 * 后端未配置 WX_APPID/WX_SECRET 时会返回 503，由调用方降级提示（可转账号密码登录）。
 */
export async function wxLogin(nickname?: string): Promise<AuthState> {
  const loginRes: any = await new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) resolve(res);
        else reject(new Error('wx.login 未返回 code'));
      },
      fail: () => reject(new Error('微信登录失败')),
    });
  });

  const data = await api.wxLogin(loginRes.code, nickname);
  const token = data.token;
  const user = data.user;
  saveAuth(token, user);
  return { token, user };
}
