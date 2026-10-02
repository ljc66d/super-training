import { api } from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import { storage } from '../../utils/storage';

Page({
  data: {
    sessions: [] as any[],
    loading: true,
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const sessions = await api.getSessions();
      const list = (sessions || []).map((s: any) => {
        const detail = s.detail_json || {};
        const exercises = detail.exercises || [];
        const volume = detail.volume_kg || 0;
        return {
          ...s,
          time_text: formatDateTime(s.start_time),
          duration_text: s.duration ? `${s.duration}min` : '—',
          exercises_text: exercises.map((e: any) => e.exercise_name).join('、'),
          volume_text: volume ? `${Math.round(volume)}kg` : '',
          calories_text: s.calories_burned ? `${Math.round(s.calories_burned)}kcal` : '',
        };
      });
      this.setData({ sessions: list });
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  onOpenDetail(e: any) {
    const { id } = e.currentTarget.dataset;
    const session = this.data.sessions.find((s: any) => s.session_id === id);
    if (session) {
      storage.set('session_detail', session);
      wx.navigateTo({ url: '/pages/training-detail/training-detail' });
    }
  },
});
