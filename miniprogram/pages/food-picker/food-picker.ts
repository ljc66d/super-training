import { api } from '../../utils/api';
import { todayStr } from '../../utils/format';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐',
};

interface PickedFood {
  food_id: string;
  food_name: string;
  weight_g: number;
  calories: number;   // 每 100g 热量，用于已选列表估算
}

Page({
  data: {
    date: todayStr(),
    mealType: 'lunch',
    mealLabel: '午餐',
    keyword: '',
    groups: [] as any[],
    activeGroup: 'all',
    foods: [] as any[],
    searching: false,
    picked: [] as PickedFood[],
    showWeightModal: false,
    pickFood: null as any,
    pickWeight: '100',
    saving: false,
  },

  onLoad(options: any) {
    const mealType = MEAL_LABELS[options.meal] ? options.meal : 'lunch';
    this.setData({
      date: options.date || todayStr(),
      mealType,
      mealLabel: MEAL_LABELS[mealType],
    });
    wx.setNavigationBarTitle({ title: `食物库 · ${MEAL_LABELS[mealType]}` });
    // 进入页面先展示食物库默认列表，搜索后再按关键词过滤
    this.loadFoods();
    this.loadGroups();
  },

  onKeywordInput(e: any) {
    this.setData({ keyword: e.detail.value });
  },

  async loadFoods(kw?: string, group?: string) {
    if (this.data.searching) return;
    this.setData({ searching: true });
    try {
      const foods = await api.getFoods(kw || undefined, group || undefined);
      this.setData({ foods: foods || [] });
    } catch (e: any) {
      wx.showToast({ title: '加载食物库失败，请检查网络', icon: 'none' });
    } finally {
      this.setData({ searching: false });
    }
  },

  async loadGroups() {
    try {
      const groups = await api.getFoodGroups();
      this.setData({ groups: [{ key: 'all', label: '全部', count: 0 }].concat(groups || []) });
    } catch (e: any) {
      // 分类栏加载失败不阻塞浏览，保持仅有「全部」
    }
  },

  onGroupTap(e: any) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeGroup) return;
    // 切分类即清空搜索词；搜索时（有关键词）以搜索为准，忽略分类
    this.setData({ activeGroup: key, keyword: '' });
    this.loadFoods('', key === 'all' ? undefined : key);
  },

  async onSearch() {
    const kw = this.data.keyword.trim();
    // 有关键词时全库搜索（忽略分类），为空时回到当前分类列表
    if (kw) {
      if (this.data.activeGroup !== 'all') this.setData({ activeGroup: 'all' });
      this.loadFoods(kw);
    } else {
      this.loadFoods('');
    }
  },

  onPickFood(e: any) {
    const { index } = e.currentTarget.dataset;
    const food = this.data.foods[index];
    if (!food) return;
    this.setData({ pickFood: food, showWeightModal: true, pickWeight: '100' });
  },

  /** 阻止弹窗内点击冒泡到 mask */
  noop() {},

  onWeightInput(e: any) {
    this.setData({ pickWeight: e.detail.value });
  },

  onQuickWeight(e: any) {
    this.setData({ pickWeight: e.currentTarget.dataset.w });
  },

  onCloseModal() {
    this.setData({ showWeightModal: false, pickFood: null });
  },

  onConfirmPick() {
    const { pickFood, pickWeight, picked } = this.data;
    if (!pickFood) return;
    const w = parseFloat(pickWeight);
    if (!w || w <= 0) {
      wx.showToast({ title: '请填写有效克数', icon: 'none' });
      return;
    }
    const list = picked.slice();
    const exist = list.findIndex((p) => p.food_id === pickFood.food_id);
    if (exist >= 0) {
      list[exist] = { ...list[exist], weight_g: w };
    } else {
      list.push({
        food_id: pickFood.food_id,
        food_name: pickFood.name,
        weight_g: w,
        calories: pickFood.calories || 0,
      });
    }
    this.setData({ picked: list, showWeightModal: false, pickFood: null });
  },

  onRemovePicked(e: any) {
    const { index } = e.currentTarget.dataset;
    this.setData({ picked: this.data.picked.filter((_: PickedFood, i: number) => i !== index) });
  },

  async onConfirmAdd() {
    const { picked, saving, date, mealType } = this.data;
    if (!picked.length || saving) return;
    this.setData({ saving: true });
    wx.showLoading({ title: '记录中...' });
    try {
      await api.createDietRecord({
        record_date: date,
        meal_type: mealType,
        food_items: picked.map((p) => ({
          food_id: p.food_id,
          food_name: p.food_name,
          weight_g: p.weight_g,
        })),
        source: 'manual',
      });
      wx.hideLoading();
      wx.showToast({ title: `已记录 ${picked.length} 项`, icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e: any) {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: '记录失败，请重试', icon: 'none' });
    }
  },
});
