import { api } from '../../utils/api';

const GOALS = [
  { key: 'muscle_gain', label: '增肌' },
  { key: 'fat_loss', label: '减脂' },
  { key: 'strength', label: '力量' },
  { key: 'endurance', label: '耐力' },
  { key: 'maintain', label: '保持' },
];

const LEVELS = [
  { key: 'beginner', label: '新手' },
  { key: 'intermediate', label: '进阶' },
  { key: 'advanced', label: '高阶' },
];

const GOAL_LABEL: Record<string, string> = {
  muscle_gain: '增肌', fat_loss: '减脂', strength: '力量',
  endurance: '耐力', maintain: '保持健康',
};

Page({
  data: {
    tab: 'official' as 'official' | 'specialty' | 'mine' | 'ai',
    tabs: [
      { key: 'official', label: '官方计划' },
      { key: 'specialty', label: '专项备赛' },
      { key: 'mine', label: '我的计划' },
      { key: 'ai', label: '生成' },
    ],
    loading: false,
    official: [] as any[],
    specialty: [] as any[],
    mine: [] as any[],
    goals: GOALS,
    levels: LEVELS,
    aiGoal: 'muscle_gain',
    aiLevel: 'beginner',
    aiDays: 3,
    aiGenerating: false,
  },

  onShow() {
    this.loadTab(this.data.tab);
  },

  onSelectTab(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ tab: key });
    this.loadTab(key);
  },

  async loadTab(tab: string) {
    this.setData({ loading: true });
    try {
      if (tab === 'official') {
        const official = await api.getOfficialPlans();
        this.setData({ official: this.decorate(official || []) });
      } else if (tab === 'specialty') {
        const specialty = await api.getSpecialtyPlans();
        this.setData({ specialty: this.decorate(specialty || []) });
      } else if (tab === 'mine') {
        const mine = await api.getMyPlans();
        this.setData({ mine: this.decorate(mine || []) });
      }
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  decorate(list: any[]) {
    return list.map((p: any) => ({
      ...p,
      goal_label: GOAL_LABEL[p.goal] || p.goal || '',
      weekly_text: p.days_per_week ? `每周${p.days_per_week}练` : '',
      days_count: (p.daily_plans || []).length,
    }));
  },

  // ---------- AI 生成 ----------
  onSelectGoal(e: any) {
    this.setData({ aiGoal: e.currentTarget.dataset.key });
  },
  onSelectLevel(e: any) {
    this.setData({ aiLevel: e.currentTarget.dataset.key });
  },
  onDaysMinus() {
    this.setData({ aiDays: Math.max(1, this.data.aiDays - 1) });
  },
  onDaysPlus() {
    this.setData({ aiDays: Math.min(7, this.data.aiDays + 1) });
  },

  async onAiGenerate() {
    const { aiGoal, aiLevel, aiDays } = this.data;
    if (this.data.aiGenerating) return;
    this.setData({ aiGenerating: true });
    wx.showLoading({ title: 'AI 生成计划中...' });
    try {
      const plan = await api.aiGeneratePlan({
        goal: aiGoal,
        level: aiLevel,
        days_per_week: aiDays,
        equipment: ['barbell', 'dumbbell', 'body_weight'],
      });
      wx.hideLoading();
      const title = (plan && (plan.title || plan.plan_json?.title)) || 'AI训练计划';
      wx.showModal({
        title: '计划已生成 ',
        content: `「${title}」已保存到我的计划`,
        showCancel: false,
        success: () => {
          this.setData({ tab: 'mine' });
          this.loadTab('mine');
        },
      });
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ aiGenerating: false });
    }
  },

  // ---------- 领用专项 ----------
  async onAdopt(e: any) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '领用模板',
      content: `确定领用「${name}」到我的计划吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.adoptSpecialtyPlan(id);
          wx.showToast({ title: '已领用', icon: 'success' });
          this.setData({ tab: 'mine' });
          this.loadTab('mine');
        } catch (err: any) {}
      },
    });
  },
});
