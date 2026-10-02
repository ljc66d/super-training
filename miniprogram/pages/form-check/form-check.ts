import { api } from '../../utils/api';
import { formatDateTime, round } from '../../utils/format';

Page({
  data: {
    tab: 'actions' as 'actions' | 'records',
    loading: false,
    actions: [] as any[],
    records: [] as any[],
    videoLoading: false,
    selectedAction: null as any,
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
      if (tab === 'actions') {
        const actions: any[] = await api.getFormCheckActions();
        // 展示后端支持的全部动作（13 个）
        this.setData({ actions: actions || [] });
      } else {
        const records = await api.getFormCheckRecords();
        const list = (records || []).map((r: any) => {
          const fb = r.feedback_json || {};
          return {
            ...r,
            time_text: formatDateTime(r.created_at),
            score: round(r.score),
            level: fb.level || '',
            corrections: fb.corrections || [],
          };
        });
        this.setData({ records: list });
      }
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelectAction(e: any) {
    const { index } = e.currentTarget.dataset;
    const action = this.data.actions[index];
    this.setData({ selectedAction: action });
  },

  onCloseDetail() {
    this.setData({ selectedAction: null });
  },

  /** 阻止弹窗内点击冒泡到 mask */
  noop() {},

  async onVideoCheck() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const filePath = res.tempFiles[0].tempFilePath;
        this.setData({ videoLoading: true });
        wx.showLoading({ title: '上传并分析中\n约需30~60秒', mask: true });
        try {
          const result: any = await api.formCheckVideo(filePath);
          wx.hideLoading();
          const score = Math.round(result?.score || 0);
          const fb = result?.feedback || {};
          wx.showModal({
            title: `评分 ${score}/100`,
            content: fb.summary || (fb.corrections || []).join('\n') || '分析完成',
            showCancel: false,
          });
          this.setData({ tab: 'records' });
          this.loadTab('records');
        } catch (e: any) {
          wx.hideLoading();
        } finally {
          this.setData({ videoLoading: false });
        }
      },
    });
  },

  onShareAppMessage() {
    return { title: '超会练 · AI动作纠错', path: '/pages/form-check/form-check' };
  },
});
