/**
 * 登录鉴权工具：游客模式 + 功能级登录拦截
 *
 * 审核合规要求：用户进入小程序后可浏览部分功能（首页、动作库），
 * 不强制要求登录；仅在用户使用需要个人数据的功能时才提示登录。
 */
import { storage } from './storage';

export function isLoggedIn(): boolean {
  return !!storage.getToken();
}

/**
 * 功能级登录拦截：已登录放行；游客弹窗提示并跳登录页，返回 false。
 */
export function requireLogin(feature?: string): boolean {
  if (isLoggedIn()) return true;
  const content = feature
    ? `「${feature}」需要登录后使用，是否立即登录？`
    : '该功能需要登录后使用，是否立即登录？';
  wx.showModal({
    title: '请先登录',
    content,
    confirmText: '去登录',
    cancelText: '再看看',
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    },
  });
  return false;
}
