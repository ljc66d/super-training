import { api } from '../../utils/api';
import { todayStr, round } from '../../utils/format';

Page({
  data: {
    date: todayStr(),
    weight: '',
    bodyFat: '',
    restingHeart: '',
    saving: false,
    loading: true,
    metrics: [] as any[],
    latest: null as any,
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const metrics = await api.getBodyMetrics();
      const list = (metrics || []).map((m: any) => ({
        ...m,
        weight_text: m.weight_kg != null ? round(m.weight_kg, 1) : '—',
        fat_text: m.body_fat_pct != null ? `${round(m.body_fat_pct, 1)}%` : '—',
        hr_text: m.resting_heart_rate != null ? Math.round(m.resting_heart_rate) : '—',
        bmr_text: m.bmr != null ? Math.round(m.bmr) : '—',
        tdee_text: m.tdee != null ? Math.round(m.tdee) : '—',
      }));
      this.setData({ metrics: list, latest: list.length ? list[0] : null });
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  onDateChange(e: any) {
    this.setData({ date: e.detail.value });
  },

  onWeightInput(e: any) {
    this.setData({ weight: e.detail.value });
  },

  onFatInput(e: any) {
    this.setData({ bodyFat: e.detail.value });
  },

  onHeartInput(e: any) {
    this.setData({ restingHeart: e.detail.value });
  },

  async onSave() {
    const { date, weight, bodyFat, restingHeart } = this.data;
    const payload: any = { record_date: date };
    if (!weight && !bodyFat && !restingHeart) {
      wx.showToast({ title: '请至少填写一项数据', icon: 'none' });
      return;
    }
    const w = parseFloat(weight);
    const f = parseFloat(bodyFat);
    const hr = parseFloat(restingHeart);
    if (weight && (isNaN(w) || w < 20 || w > 300)) {
      wx.showToast({ title: '体重需为 20-300 的数值', icon: 'none' });
      return;
    }
    if (bodyFat && (isNaN(f) || f < 1 || f > 80)) {
      wx.showToast({ title: '体脂率需为 1-80 的数值', icon: 'none' });
      return;
    }
    if (restingHeart && (isNaN(hr) || hr < 30 || hr > 200)) {
      wx.showToast({ title: '静息心率需为 30-200 的数值', icon: 'none' });
      return;
    }
    if (weight) payload.weight_kg = w;
    if (bodyFat) payload.body_fat_pct = f;
    if (restingHeart) payload.resting_heart_rate = hr;

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });
    try {
      await api.createBodyMetric(payload);
      wx.hideLoading();
      wx.showToast({ title: '已记录', icon: 'success' });
      this.setData({ weight: '', bodyFat: '', restingHeart: '' });
      this.load();
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ saving: false });
    }
  },
});
