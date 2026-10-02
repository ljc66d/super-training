import { api } from '../../utils/api';
import { todayStr, round } from '../../utils/format';
import { syncTabBar } from '../../utils/tabbar';
import { isLoggedIn } from '../../utils/guard';

const MEAL_TYPES = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐',
};

/** 压缩图片到指定宽度：分类模型输入仅 224px，压到 320 留余量，
    规避 callContainer 请求包 100KB 上限（手机原图 2~10MB 必超限）。 */
function compressToWidth(src: string, width: number): Promise<string> {
  return new Promise((resolve) => {
    wx.compressImage({
      src,
      quality: 70,
      compressedWidth: width,
      success: (r) => resolve(r.tempFilePath),
      fail: () => resolve(src),   // 压缩失败退回原图，不阻断流程
    });
  });
}

Page({
  data: {
    needLogin: false,
    date: todayStr(),
    mealTypes: MEAL_TYPES,
    mealType: 'lunch',
    mealLabel: '午餐',
    stats: null as any,
    records: [] as any[],
    assess: null as any,
    loading: true,
    // NLP
    nlpText: '',
    nlpLoading: false,
    // 拍照
    photoLoading: false,
    // 食材克数编辑面板
    showIngredientPanel: false,
    editDishNames: [] as string[],
    editDishText: '',
    editItems: [] as any[],
  },

  onShow() {
    syncTabBar(this, '/pages/diet/diet');
    if (!isLoggedIn()) {
      this.setData({ needLogin: true, loading: false });
      return;
    }
    this.setData({ needLogin: false });
    this.load();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async load() {
    const { date } = this.data;
    this.setData({ loading: true });
    try {
      const [stats, records, assess] = await Promise.all([
        api.getDietStats(date),
        api.getDietRecords(date).catch(() => [] as any[]),
        api.assessDiet(date).catch(() => null),
      ]);
      const list = (records || []).map((r: any) => ({
        ...r,
        meal_label: MEAL_LABELS[r.meal_type] || '饮食',
        calories_text: r.total_calories ? Math.round(r.total_calories) : 0,
      }));
      const s = stats || {};
      this.setData({
        stats: {
          ...s,
          calories_text: Math.round(s.total_calories || 0),
          protein_text: round(s.total_protein),
          carbs_text: round(s.total_carbs),
          fat_text: round(s.total_fat),
        },
        records: list,
        assess,
      });
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      this.setData({ loading: false });
    }
  },

  onDateChange(e: any) {
    this.setData({ date: e.detail.value }, () => this.load());
  },

  onSelectMeal(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ mealType: key, mealLabel: MEAL_LABELS[key] || key });
  },

  // ---------- 食物库选择 ----------
  goFoodPicker() {
    const { date, mealType } = this.data;
    wx.navigateTo({ url: `/pages/food-picker/food-picker?date=${date}&meal=${mealType}` });
  },

  /** 阻止弹窗内点击冒泡到 mask */
  noop() {},

  // ---------- 自然语言 ----------
  onNlpInput(e: any) {
    this.setData({ nlpText: e.detail.value });
  },

  async onNlpSubmit() {
    const text = this.data.nlpText.trim();
    if (!text || this.data.nlpLoading) return;
    this.setData({ nlpLoading: true });
    wx.showLoading({ title: 'AI 解析中...' });
    try {
      const res: any = await api.createDietRecordNlp(text, this.data.date);
      wx.hideLoading();
      this.setData({ nlpText: '' });
      const cal = Math.round(res?.total_calories || res?.record?.total_calories || 0);
      wx.showToast({ title: `已记录 ${cal} kcal`, icon: 'success' });
      this.load();
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ nlpLoading: false });
    }
  },

  // ---------- 拍照识别 ----------
  async onPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: async (res) => {
        const filePath = res.tempFiles[0].tempFilePath;
        this.setData({ photoLoading: true });
        wx.showLoading({ title: '识别中...' });
        try {
          // 压缩到 320 宽：模型只吃 224，压小既不影响精度又绕开 100KB 限制
          const small = await compressToWidth(filePath, 320);
          const data: any = await api.recognizeDietPhoto(small);
          wx.hideLoading();
          const dishes = data?.dishes || [];
          const items = data?.items || [];
          if (!dishes.length && !items.length) {
            wx.showModal({
              title: '未识别出食物',
              content: '可换一张更清晰的图片，或使用自然语言记录',
              showCancel: false,
            });
            return;
          }
          // 识别出菜品 → 弹出食材克数编辑面板，让用户逐个填克数后再计算
          if (dishes.length) {
            this.openIngredientPanel(dishes, items);
            return;
          }
          // 无菜品映射 → 按原逻辑直接提交单食物
          const itemsJson = JSON.stringify(
            items.map((it: any) => ({
              food_name: it.food_name,
              food_id: it.food_id || undefined,
              weight_g: Number(it.weight_g) || 100,
              cooking_factor: it.cooking_factor || 1.0,
              cooking_method: it.cooking_method || null,
            }))
          );
          const rec: any = await api.recordDietPhoto('', this.data.mealType, itemsJson);
          wx.showToast({ title: `记录成功 ${Math.round(rec?.total_calories || 0)} kcal`, icon: 'success' });
          this.load();
        } catch (e: any) {
          wx.hideLoading();
        } finally {
          this.setData({ photoLoading: false });
        }
      },
    });
  },

  // ---------- 食材克数编辑面板 ----------
  /** 识别出菜品后，把每道菜的食材展开成可编辑列表（默认建议克数，用户可改） */
  openIngredientPanel(dishes: any[], items: any[]) {
    const editItems: any[] = [];
    const dishNames: string[] = [];
    for (const dish of dishes) {
      dishNames.push(dish.name);
      for (const ing of (dish.ingredients || [])) {
        editItems.push({
          dish: dish.name,
          name: ing.name,
          food_name: ing.matched ? ing.food_name : ing.name,
          food_id: ing.food_id || null,
          weight: String(ing.weight_g ?? ''),
          is_seasoning: !!ing.is_seasoning,
        });
      }
    }
    // 未命中菜品的单食物也并进来，让用户统一编辑
    for (const it of items) {
      editItems.push({
        dish: '',
        name: it.food_name,
        food_name: it.food_name,
        food_id: it.food_id || null,
        weight: String(it.weight_g || 100),
        is_seasoning: false,
      });
    }
    this.setData({
      showIngredientPanel: true,
      editDishNames: dishNames,
      editDishText: dishNames.join('、'),
      editItems,
    });
  },

  onIngredientWeight(e: any) {
    const index = e.currentTarget.dataset.index;
    const editItems = this.data.editItems.slice();
    editItems[index].weight = e.detail.value;
    this.setData({ editItems });
  },

  onRemoveIngredient(e: any) {
    const index = e.currentTarget.dataset.index;
    const editItems = this.data.editItems.filter((_: any, i: number) => i !== index);
    this.setData({ editItems });
  },

  onCancelIngredient() {
    this.setData({ showIngredientPanel: false, editItems: [], editDishNames: [], editDishText: '' });
  },

  async onConfirmIngredients() {
    const valid = this.data.editItems.filter((it: any) => (parseFloat(it.weight) || 0) > 0);
    if (!valid.length) {
      wx.showToast({ title: '请至少保留一种食材', icon: 'none' });
      return;
    }
    const itemsJson = JSON.stringify(
      valid.map((it: any) => ({
        food_name: it.food_name || it.name,
        food_id: it.food_id || undefined,
        weight_g: parseFloat(it.weight) || 0,
        cooking_factor: 1.0,
      }))
    );
    wx.showLoading({ title: '计算中...' });
    try {
      const rec: any = await api.recordDietPhoto('', this.data.mealType, itemsJson);
      wx.hideLoading();
      wx.showToast({ title: `记录成功 ${Math.round(rec?.total_calories || 0)} kcal`, icon: 'success' });
      this.setData({ showIngredientPanel: false, editItems: [], editDishNames: [], editDishText: '' });
      this.load();
    } catch (e: any) {
      wx.hideLoading();
    }
  },

  onDeleteRecord(e: any) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条饮食记录吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteDietRecord(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        } catch (err: any) {}
      },
    });
  },

  onShareAppMessage() {
    return { title: '超会练 · 饮食记录', path: '/pages/diet/diet' };
  },
});
