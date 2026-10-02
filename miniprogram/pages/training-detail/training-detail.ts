import { storage } from '../../utils/storage';
import { formatDateTime } from '../../utils/format';

Page({
  data: {
    session: null as any,
    exercises: [] as any[],
    totalSets: 0,
    totalVolume: 0,
  },

  onLoad() {
    const session = storage.get('session_detail', null);
    if (!session) {
      wx.showToast({ title: '数据不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const detail = session.detail_json || {};
    const exercises = detail.exercises || [];
    const totalSets = exercises.reduce((s: number, e: any) => s + (e.sets || 1), 0);
    const totalVolume = exercises.reduce(
      (s: number, e: any) => s + (e.weight_kg || 0) * (e.reps || 0) * (e.sets || 1),
      0
    );
    this.setData({
      session: {
        ...session,
        time_text: formatDateTime(session.start_time),
        calories_text: session.calories_burned ? Math.round(session.calories_burned) : 0,
      },
      exercises,
      totalSets,
      totalVolume: Math.round(totalVolume),
    });
  },

  onShareAppMessage() {
    const s: any = this.data.session || {};
    return {
      title: `我在超会练完成了「${s.sport_name || '训练'}」`,
      path: '/pages/home/home',
    };
  },
});
