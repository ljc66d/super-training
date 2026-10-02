import { storage } from '../../utils/storage';
import { API_BASE_URL } from '../../utils/config';

Page({
  data: {
    apiBase: API_BASE_URL,
    storageSize: '',
  },

  onLoad() {
    try {
      const info = wx.getStorageInfoSync();
      this.setData({ storageSize: `${(info.currentSize / 1024).toFixed(1)} KB / ${(info.limitSize / 1024).toFixed(0)} MB` });
    } catch (e: any) {}
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除本地缓存（不影响账号数据，需重新登录）',
      success: (res) => {
        if (!res.confirm) return;
        wx.clearStorage();
        wx.showToast({ title: '已清除', icon: 'success' });
        this.setData({ storageSize: '0 KB' });
        setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 800);
      },
    });
  },

  onCopyApi() {
    wx.setClipboardData({
      data: API_BASE_URL,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onViewLogs() {
    wx.showToast({ title: '日志已输出到控制台', icon: 'none' });
    const app = getApp<any>();
    console.log('[App globalData]', app && app.globalData);
    console.log('[Storage]', storage.getToken() ? '已登录' : '未登录');
  },
});
