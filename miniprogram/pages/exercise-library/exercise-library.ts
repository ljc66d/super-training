import { api } from '../../utils/api';
import { storage } from '../../utils/storage';
import { loadCloudFile, getCachedFile } from '../../utils/url';

Page({
  gifFlushTimer: null as any,

  data: {
    mode: '' as 'browse' | 'picker',
    keyword: '',
    groups: [] as any[],
    activeGroup: '',
    exercises: [] as any[],
    loading: true,
    picked: [] as any[],
  },

  onLoad(options: any) {
    const mode = options.mode === 'picker' ? 'picker' : 'browse';
    this.setData({ mode });
    wx.setNavigationBarTitle({ title: mode === 'picker' ? '选择动作（多选）' : '动作库' });
    this.loadGroups();
    this.loadExercises();
  },

  onUnload() {
    if (this.gifFlushTimer) {
      clearTimeout(this.gifFlushTimer);
      this.gifFlushTimer = null;
    }
  },

  async loadGroups() {
    try {
      const groups = await api.getExerciseGroups();
      this.setData({ groups: groups || [] });
    } catch (e: any) {}
  },

  async loadExercises() {
    const { keyword, activeGroup } = this.data;
    this.setData({ loading: true });
    try {
      const exercises = await api.getExercises(keyword || undefined, undefined, 100, activeGroup || undefined);
      // 去重：公有库+私有库若出现重复 exercise_id，wx:key 冲突会导致点击错位
      const seen = new Set<string>();
      const list = this.markPicked((exercises || []).filter((ex: any) => {
        if (!ex.exercise_id || seen.has(ex.exercise_id)) return false;
        seen.add(ex.exercise_id);
        return true;
      }));
      this.setData({ exercises: list, loading: false });
      this.loadGifThumbs(list);
    } catch (e: any) {
      this.setData({ loading: false });
    }
  },

  async loadGifThumbs(list: any[]) {
    // 缩略图下载合并批量 setData：逐条 setData 会让列表在点击瞬间重渲染，
    // 表现为 tap 丢失（要点两下）或事件派发到相邻 item
    const pending: Record<string, string> = {};
    const flush = () => {
      if (this.gifFlushTimer) {
        clearTimeout(this.gifFlushTimer);
        this.gifFlushTimer = null;
      }
      if (!Object.keys(pending).length) return;
      this.setData(pending);
      Object.keys(pending).forEach((k) => delete pending[k]);
    };
    const schedule = () => {
      if (this.gifFlushTimer) return;
      this.gifFlushTimer = setTimeout(flush, 400);
    };
    for (let i = 0; i < list.length; i++) {
      const ex = list[i];
      if (!ex.gif_url) continue;
      if (getCachedFile(ex.gif_url)) continue;   // markPicked 已同步带上缓存图
      try {
        const localPath = await loadCloudFile(ex.gif_url);
        // 确认列表还在（搜索后可能已刷新）
        if (this.data.exercises[i] && this.data.exercises[i].exercise_id === ex.exercise_id) {
          pending[`exercises[${i}].gif_full`] = localPath;
          schedule();
        }
      } catch (e) { /* 单图失败不影响其余 */ }
    }
    flush();
  },

  markPicked(list: any[]) {
    return list.map((ex: any) => ({
      ...ex,
      gif_full: getCachedFile(ex.gif_url) || '',
      is_picked: this.data.picked.some((p: any) => p.exercise_id === ex.exercise_id),
    }));
  },

  onKeywordInput(e: any) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.loadExercises();
  },

  onSelectGroup(e: any) {
    const { key } = e.currentTarget.dataset;
    const activeGroup = this.data.activeGroup === key ? '' : key;
    this.setData({ activeGroup }, () => this.loadExercises());
  },

  onPickToggle(e: any) {
    const { index } = e.currentTarget.dataset;
    const ex = this.data.exercises[index];
    if (!ex) return;
    if (this.data.mode !== 'picker') {
      storage.set('exercise_detail', ex);
      wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail' });
      return;
    }
    const picked = [...this.data.picked];
    const exist = picked.findIndex((p: any) => p.exercise_id === ex.exercise_id);
    if (exist >= 0) {
      picked.splice(exist, 1);
    } else {
      picked.push({ name: ex.name_zh || ex.name, exercise_id: ex.exercise_id });
    }
    // 只更新当前 item，避免全列表 markPicked 重渲染造成点击卡顿/错位
    this.setData({
      picked,
      [`exercises[${index}].is_picked`]: exist < 0,
    });
  },

  isPicked(id: string) {
    return this.data.picked.some((p: any) => p.exercise_id === id);
  },

  onConfirmPick() {
    if (!this.data.picked.length) {
      wx.showToast({ title: '请先选择动作', icon: 'none' });
      return;
    }
    storage.set('picked_exercises', this.data.picked);
    wx.navigateBack();
  },
});
