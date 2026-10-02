import { restoreAuth } from './utils/auth';
import { CLOUD_ENV } from './utils/config';

App({
  globalData: {
    user: null as any,
    token: '' as string,
    apiBase: '' as string,
  },

  onLaunch() {
    // 初始化微信云（云托管 callContainer 通道，无需配置服务器域名）
    if (wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true,
      });
    }

    // 恢复登录态（token + 用户信息），后续请求自动携带
    const auth = restoreAuth();
    if (auth) {
      this.globalData.token = auth.token;
      this.globalData.user = auth.user;
    }
  },
});
