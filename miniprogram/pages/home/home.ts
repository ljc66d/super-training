import { api } from '../../utils/api';
import { syncTabBar, navigateTo } from '../../utils/tabbar';
import { isLoggedIn, requireLogin } from '../../utils/guard';
import { todayStr } from '../../utils/format';

Page({
  data: {
    user: null as any,
    userInitial: 'U',
    today: null as any,
    loading: true,
    loggedIn: false,
    restingHr: '',
    hrSaving: false,
  },

  onShow() {
    syncTabBar(this, '/pages/home/home');
    const app = getApp();
    const user = (app && app.globalData && app.globalData.user) || null;
    const loggedIn = isLoggedIn();
    this.setData({
      user,
      loggedIn,
      userInitial: user && user.nickname ? user.nickname[0].toUpperCase() : 'U',
    });
    if (loggedIn) {
      this.loadToday();
    } else {
      this.setData({ loading: false, today: null });
    }
  },

  onPullDownRefresh() {
    if (!isLoggedIn()) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadToday(() => wx.stopPullDownRefresh());
  },

  loadToday(done?: () => void) {
    api
      .getToday()
      .then((today: any) => {
        const t = today || {};
        const intake = t.intake || {};
        this.setData({
          today: {
            ...t,
            today_tdee: Math.round(t.today_tdee || 0),
            food_calories_intake: Math.round(t.food_calories_intake || 0),
            calorie_balance: Math.round(t.calorie_balance ?? 0),
            target_intake_calories: Math.round(t.target_intake_calories || 0),
            training_calories_burned: Math.round(t.training_calories_burned || 0),
            session_count: t.session_count || 0,
            intake: {
              protein: Math.round(intake.protein || 0),
              carbs: Math.round(intake.carbs || 0),
              fat: Math.round(intake.fat || 0),
            },
          },
        });
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ loading: false });
        done && done();
      });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onAvatarTap() {
    if (this.data.loggedIn) {
      wx.switchTab({ url: '/pages/profile/profile' });
    } else {
      this.goLogin();
    }
  },

  // ---------- 每日静息心率 ----------
  onRestingHrInput(e: any) {
    this.setData({ restingHr: e.detail.value });
  },

  async onSaveRestingHr() {
    const hr = parseFloat(this.data.restingHr);
    if (!hr || hr < 30 || hr > 200) {
      wx.showToast({ title: '请输入 30~200 之间的心率', icon: 'none' });
      return;
    }
    if (this.data.hrSaving) return;
    this.setData({ hrSaving: true });
    try {
      await api.createBodyMetric({ record_date: todayStr(), resting_heart_rate: hr });
      wx.showToast({ title: '静息心率已记录', icon: 'success' });
      this.setData({ restingHr: '' });
    } catch (e: any) {
      wx.showToast({ title: e.message || '记录失败', icon: 'none' });
    } finally {
      this.setData({ hrSaving: false });
    }
  },

  requireAuth(e: any) {
    const feature = e.currentTarget.dataset.feature || '';
    if (!requireLogin(feature)) return;
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    navigateTo(url);
  },

  /** 游客可浏览的功能（动作库） */
  go(e: any) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;
    navigateTo(url);
  },

  goTab(e: any) {
    const { url } = e.currentTarget.dataset;
    wx.switchTab({ url });
  },

  onShareAppMessage() {
    return {
      title: '超会练 · 训练数据管理',
      path: '/pages/home/home',
    };
  },
});
