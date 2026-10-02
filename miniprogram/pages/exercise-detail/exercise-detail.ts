import { storage } from '../../utils/storage';
import { loadCloudFile } from '../../utils/url';

Page({
  data: {
    ex: null as any,
    gifUrl: '',
    instructions: [] as string[],
    gifLoading: true,
  },

  async onLoad() {
    const ex = storage.get('exercise_detail', null);
    if (!ex) {
      wx.showToast({ title: '数据不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const instructions = (ex.instructions_zh || '')
      .split(/\n+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    this.setData({ ex, instructions });

    if (ex.gif_url) {
      try {
        const localPath = await loadCloudFile(ex.gif_url);
        this.setData({ gifUrl: localPath, gifLoading: false });
      } catch (e) {
        this.setData({ gifLoading: false });
      }
    } else {
      this.setData({ gifLoading: false });
    }
  },

  /** 单动作快捷加入训练：训练页已在页面栈里就直接返回，否则切到训练 tab */
  onAddToTraining() {
    const { ex } = this.data;
    if (!ex) return;
    const picked = [{ name: ex.name_zh || ex.name, exercise_id: ex.exercise_id }];
    const training = getCurrentPages().find((p: any) => p.route === 'pages/training/training');
    if (training) {
      storage.set('picked_exercises', picked);
      wx.navigateBack();
    } else {
      storage.set('picked_exercises', picked);
      wx.switchTab({ url: '/pages/training/training' });
    }
  },
});
