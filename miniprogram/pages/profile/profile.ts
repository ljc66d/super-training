import { api } from '../../utils/api';
import { updateUser, logout } from '../../utils/auth';
import { storage } from '../../utils/storage';
import { syncTabBar } from '../../utils/tabbar';
import { isLoggedIn } from '../../utils/guard';
import { normalizeUser, uploadToCloud } from '../../utils/url';

const GOALS = [
  { key: 'muscle_gain', label: '增肌' },
  { key: 'fat_loss', label: '减脂' },
  { key: 'strength', label: '力量提升' },
  { key: 'endurance', label: '耐力提升' },
  { key: 'maintain', label: '保持健康' },
];

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: '目标：增肌',
  fat_loss: '目标：减脂',
  strength: '目标：力量提升',
  endurance: '目标：耐力提升',
  maintain: '目标：保持健康',
};

Page({
  data: {
    needLogin: false,
    user: null as any,
    avatarFailed: false,
    energy: null as any,
    editing: false,
    form: {
      nickname: '',
      gender: '',
      height_cm: '',
      weight_kg: '',
      birthday: '',
      goal: '',
    } as any,
    goals: GOALS,
    menus: [] as any[],
  },

  onShow() {
    syncTabBar(this, '/pages/profile/profile');
    if (!isLoggedIn()) {
      this.setData({ needLogin: true, user: null, energy: null });
      return;
    }
    this.setData({ needLogin: false });
    const app = getApp<any>();
    let user = (app.globalData && app.globalData.user) || null;
    if (user) {
      user = normalizeUser({ ...user, goal_label: GOAL_LABELS[user.goal] || '' });
    }
    this.setData({
      user,
      avatarFailed: false,
      userInitial: user && user.nickname ? user.nickname[0].toUpperCase() : 'U',
    });
    this.buildMenus(user);
    this.loadEnergy();
    // 刷新最新用户信息（含 uid 短 ID）
    api.getMe().then((me: any) => {
      if (!me) return;
      const u = normalizeUser({ ...me, goal_label: GOAL_LABELS[me.goal] || '' });
      this.setData({
        user: u,
        avatarFailed: false,
        userInitial: u.nickname ? u.nickname[0].toUpperCase() : 'U',
      });
      updateUser(me);
      this.buildMenus(me);
    }).catch(() => {});
  },

  buildMenus(user: any) {
    const isCoach = !!(user && user.is_coach);
    this.setData({
      menus: [
        { icon: '', label: '完善画像', url: '' },
        { icon: '', label: '身体数据', url: '/pages/body-metrics/body-metrics' },
        { icon: '', label: '训练记录', url: '/pages/session-list/session-list' },
        { icon: '', label: '我的运动', url: '/pages/my-custom-sports/my-custom-sports' },
        { icon: '', label: '饮食日历', url: '/pages/diet-calendar/diet-calendar' },
        { icon: '', label: '训练计划', url: '/pages/plan/plan' },
        { icon: '', label: '动作库', url: '/pages/exercise-library/exercise-library' },
        { icon: '', label: '动作纠错', url: '/pages/form-check/form-check' },
        { icon: '', label: '成就徽章', url: '/pages/achievement/achievement' },
        { icon: '', label: isCoach ? '教练工作台' : '成为教练', url: '/pages/coach/coach' },
        { icon: '', label: '设置', url: '/pages/webview/webview' },
      ],
    });
  },

  async loadEnergy() {
    try {
      const energy = await api.getEnergyNeeds();
      const e = energy || {};
      this.setData({
        energy: {
          ...e,
          bmr_text: e.bmr ? Math.round(e.bmr) : '—',
          tdee_text: e.tdee ? Math.round(e.tdee) : '—',
          target_text: e.target_calories ? Math.round(e.target_calories) : '—',
        },
      });
    } catch (e: any) {}
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onMenuTap(e: any) {
    const { url, label } = e.currentTarget.dataset;
    if (label === '完善画像') {
      this.openEdit();
      return;
    }
    if (label === '设置') {
      this.onSettings();
      return;
    }
    if (url) wx.navigateTo({ url });
  },

  // ---------- 头像 ----------
  /** 头像加载失败（文件不存在/域名未配置）时，回退到首字母占位 */
  onAvatarError() {
    this.setData({ avatarFailed: true });
  },

  /** 头像直传云存储拿 fileID 再写回后端（云托管容器无状态，头像不能落本地磁盘） */
  async onChangeAvatar() {
    const picked: any = await new Promise((resolve) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: () => resolve(null),
      });
    });
    const file = picked && picked.tempFiles && picked.tempFiles[0];
    if (!file || !file.tempFilePath) return;

    const u = this.data.user || {};
    const ext = (String(file.tempFilePath).split('.').pop() || 'jpg').toLowerCase();
    const cloudPath = `avatars/${u.user_id || u.uid || 'me'}_${Date.now()}.${ext}`;

    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const fileID = await uploadToCloud(file.tempFilePath, cloudPath);
      const updated = await api.updateMe({ avatar_url: fileID });
      const next = normalizeUser({
        ...updated,
        goal_label: GOAL_LABELS[updated.goal] || '',
      });
      updateUser(updated);
      this.setData({
        user: next,
        avatarFailed: false,
        userInitial: next.nickname ? next.nickname[0].toUpperCase() : 'U',
      });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (e: any) {
      wx.hideLoading();
      wx.showToast({ title: e?.message || '上传失败，请重试', icon: 'none' });
    }
  },

  // ---------- 画像编辑 ----------
  onCopyId() {
    const u = this.data.user || {};
    const uid = u.uid || u.user_id;
    if (!uid) return;
    wx.setClipboardData({
      data: uid,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  openEdit() {
    const u = this.data.user || {};
    this.setData({
      editing: true,
      form: {
        nickname: u.nickname || '',
        gender: u.gender || '',
        height_cm: u.height_cm || '',
        weight_kg: u.weight_kg || '',
        birthday: u.birthday || '',
        goal: u.goal || '',
      },
    });
  },

  onCloseEdit() {
    this.setData({ editing: false });
  },

  /** 阻止 modal 内点击冒泡到 mask，避免一碰弹窗就关闭 */
  noop() {},

  onFormInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onSelectGender(e: any) {
    const { value } = e.currentTarget.dataset;
    this.setData({ 'form.gender': value });
  },

  onBirthdayChange(e: any) {
    this.setData({ 'form.birthday': e.detail.value });
  },

  onSelectGoal(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ 'form.goal': key });
  },

  async onSaveProfile() {
    const { form } = this.data;
    const payload: any = {};

    if (form.nickname) payload.nickname = String(form.nickname).trim();
    if (form.gender) payload.gender = form.gender;

    // 数字字段严格校验：非法输入直接提示，避免后端 422 导致"保存无反应"
    if (form.height_cm) {
      const h = parseFloat(form.height_cm);
      if (isNaN(h) || h < 100 || h > 250) {
        wx.showToast({ title: '身高需为 100-250 的数值', icon: 'none' });
        return;
      }
      payload.height_cm = h;
    }
    if (form.weight_kg) {
      const w = parseFloat(form.weight_kg);
      if (isNaN(w) || w < 20 || w > 300) {
        wx.showToast({ title: '体重需为 20-300 的数值', icon: 'none' });
        return;
      }
      payload.weight_kg = w;
    }
    if (form.birthday && /^\d{4}-\d{2}-\d{2}$/.test(form.birthday)) {
      payload.birthday = form.birthday;
    }
    if (form.goal) payload.goal = form.goal;

    if (Object.keys(payload).length === 0) {
      wx.showToast({ title: '没有可保存的修改', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const user = await api.updateMe(payload);
      updateUser(user);
      const updated = normalizeUser({ ...user, goal_label: GOAL_LABELS[user.goal] || '' });
      this.setData({ user: updated, avatarFailed: false, userInitial: updated.nickname ? updated.nickname[0].toUpperCase() : 'U', editing: false });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.buildMenus(updated);
      this.loadEnergy();
    } catch (e: any) {
      wx.hideLoading();
      // request 层已弹错误 toast；这里补充引导
      wx.showToast({ title: '保存失败，请检查输入', icon: 'none' });
    }
  },

  // ---------- 设置 ----------
  onSettings() {
    wx.showActionSheet({
      itemList: ['清除本地缓存', '退出登录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.clearStorage();
          wx.showToast({ title: '已清除', icon: 'success' });
          const app = getApp<any>();
          if (app) app.globalData.user = null;
          this.setData({ user: null, energy: null });
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '退出登录',
            content: '确定要退出当前账号吗？',
            success: (r) => {
              if (r.confirm) logout();
            },
          });
        }
      },
    });
  },

  onShareAppMessage() {
    return { title: '超会练 · 我的', path: '/pages/profile/profile' };
  },
});
