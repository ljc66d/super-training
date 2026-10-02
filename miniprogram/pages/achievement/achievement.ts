import { api } from '../../utils/api';

const BADGE_STYLE: Record<string, string> = {
  bronze: '#B0753C',
  silver: '#A8AFB8',
  gold: '#E0B24D',
  platinum: '#C9D2DC',
};

const BADGE_ICON: Record<string, string> = {
  bronze: '铜',
  silver: '银',
  gold: '金',
  platinum: '铂',
};

Page({
  data: {
    loading: true,
    level: 1,
    totalBadges: 0,
    unlockedCount: 0,
    badgeCounts: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    achievements: [] as any[],
    refreshing: false,
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data: any = await api.getAchievements();
      this.setData({
        level: data.level || 1,
        totalBadges: data.total_badges || 0,
        unlockedCount: data.unlocked_count || 0,
        badgeCounts: data.badge_counts || {},
        achievements: (data.achievements || []).map((a: any) => ({
          ...a,
          color: BADGE_STYLE[a.badge_type] || '#7D8CA3',
          icon: BADGE_ICON[a.badge_type] || '',
        })),
      });
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async onRefresh() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    wx.showLoading({ title: '刷新中...' });
    try {
      await api.refreshAchievements();
      wx.hideLoading();
      wx.showToast({ title: '已刷新', icon: 'success' });
      this.load();
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ refreshing: false });
    }
  },
});
