import { api } from '../../utils/api';
import { storage } from '../../utils/storage';
import { syncTabBar } from '../../utils/tabbar';
import { isLoggedIn } from '../../utils/guard';

const SPORT_CATEGORIES = [
  { key: 'strength', label: '力量训练', category: '力量健美', sport: '力量训练' },
  { key: 'crossfit', label: 'CrossFit', category: '功能训练', sport: 'CrossFit' },
  { key: 'hyrox', label: 'Hyrox', category: '功能训练', sport: 'Hyrox' },
  { key: 'run', label: '跑步', category: '田径耐力', sport: '跑步' },
  { key: 'cycle', label: '骑行', category: '田径耐力', sport: '骑行' },
  { key: 'swim', label: '游泳', category: '田径耐力', sport: '游泳' },
  { key: 'hike', label: '徒步', category: '田径耐力', sport: '徒步' },
  { key: 'custom', label: '自定义', category: '自定义', sport: '' },
];

let uid = 0;
function genId() {
  uid += 1;
  return `w${Date.now()}_${uid}`;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
}

Page({
  data: {
    needLogin: false,
    categories: SPORT_CATEGORIES,
    selectedKey: 'strength',
    category: '力量健美',
    sportName: '力量训练',
    customSport: '',
    customSports: [] as any[],
    newSportName: '',
    isEndurance: false,
    isCrossFit: false,
    isHyrox: false,
    wod: { mode: 'AMRAP', timerMode: 'count-up', timeCapMin: '', rounds: '', extraReps: '', totalMin: '', totalTimeSec: '', movements: [] as any[] },
    hyroxStations: [] as any[],
    metconAvgHr: '',
    metconMaxHr: '',
    overallRpe: '',
    runMode: 'long' as 'long' | 'custom',
    longRun: { distance: '', timeMin: '', avgHr: '', maxHr: '', climb: '' },
    runGroups: [] as any[],
    runGroupAvgHr: '',
    runGroupMaxHr: '',
    started: false,
    elapsed: 0,
    elapsedText: '00:00',
    exercises: [] as any[],
    nlpText: '',
    manualName: '',
    nlpLoading: false,
    saving: false,
    totalSets: 0,
    totalVolume: 0,
  },

  timer: null as any,
  startAt: 0 as number,

  onShow() {
    syncTabBar(this, '/pages/training/training');
    if (!isLoggedIn()) {
      this.setData({ needLogin: true });
      return;
    }
    this.setData({ needLogin: false });
    // 从动作库返回：消费选中动作（按 picker_target 分发到 WOD/Hyrox/力量）
    const picked = storage.get('picked_exercises', []);
    if (Array.isArray(picked) && picked.length > 0 && picked[0]) {
      const target = storage.get('picker_target', 'strength');
      const movId = storage.get('picker_mov_id', '');
      const ex = picked[0];
      if (target === 'wod' && movId) {
        this.setData({
          'wod.movements': this.data.wod.movements.map((m: any) =>
            m.id === movId ? { ...m, name: ex.name || ex.exercise_name, exercise_id: ex.exercise_id } : m),
        });
      } else if (target === 'hyrox' && movId) {
        this.setData({
          hyroxStations: this.data.hyroxStations.map((s: any) =>
            s.id === movId ? { ...s, name: ex.name || ex.exercise_name, exercise_id: ex.exercise_id } : s),
        });
      } else {
        this.addExercises(picked);
      }
      storage.remove('picked_exercises');
      storage.remove('picker_target');
      storage.remove('picker_mov_id');
    }
    // 计时器恢复（页面实例保留，正常不丢；防御性恢复）
    if (this.data.started && !this.timer && this.startAt) {
      this.startTimer();
    }
    this.loadCustomSports();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  loadCustomSports() {
    api.getCustomSports().then((d: any) => {
      this.setData({ customSports: d || [] });
    }).catch(() => {});
  },

  onPickCustomSport(e: any) {
    const { name } = e.currentTarget.dataset;
    this.setData({ customSport: name, selectedKey: 'custom', category: '自定义', sportName: '' });
  },

  onSaveCustomSport() {
    const name = (this.data.newSportName || '').trim();
    if (!name) return;
    api.addCustomSport(name).then(() => {
      this.setData({ newSportName: '', customSport: name, selectedKey: 'custom', category: '自定义', sportName: '' });
      this.loadCustomSports();
    }).catch((err: any) => {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    });
  },

  // ---------- 耐力运动 ----------
  onRunModeChange(e: any) {
    this.setData({ runMode: e.currentTarget.dataset.mode });
  },

  onLongRunInput(e: any) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({ [`longRun.${field}`]: value });
  },

  onAddRunGroup() {
    const g = { id: genId(), distance: '', time_sec: '', rest_sec: '' };
    this.setData({ runGroups: [...this.data.runGroups, g] });
  },

  onRunGroupInput(e: any) {
    const { id, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const runGroups = this.data.runGroups.map((g: any) =>
      g.id === id ? { ...g, [field]: value } : g);
    this.setData({ runGroups });
  },

  onRemoveRunGroup(e: any) {
    const { id } = e.currentTarget.dataset;
    this.setData({ runGroups: this.data.runGroups.filter((g: any) => g.id !== id) });
  },

  onRunGroupAvgHrInput(e: any) {
    this.setData({ runGroupAvgHr: e.detail.value });
  },

  onRunGroupMaxHrInput(e: any) {
    this.setData({ runGroupMaxHr: e.detail.value });
  },

  // ---------- CrossFit WOD ----------
  onWodModeChange(e: any) {
    this.setData({ 'wod.mode': e.currentTarget.dataset.mode });
  },

  onWodTimerModeChange(e: any) {
    this.setData({ 'wod.timerMode': e.currentTarget.dataset.mode });
  },

  onWodFieldInput(e: any) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`wod.${field}`]: e.detail.value });
  },

  onWodAddMovement() {
    const mov = { id: genId(), name: '', reps: '', weight_kg: '', exercise_id: '' };
    this.setData({ 'wod.movements': [...this.data.wod.movements, mov] });
  },

  onWodMovementInput(e: any) {
    const { id, field } = e.currentTarget.dataset;
    const movements = this.data.wod.movements.map((m: any) =>
      m.id === id ? { ...m, [field]: e.detail.value } : m);
    this.setData({ 'wod.movements': movements });
  },

  onWodRemoveMovement(e: any) {
    const { id } = e.currentTarget.dataset;
    this.setData({ 'wod.movements': this.data.wod.movements.filter((m: any) => m.id !== id) });
  },

  onPickWodMovement(e: any) {
    const { id } = e.currentTarget.dataset;
    storage.set('picker_target', 'wod');
    storage.set('picker_mov_id', id);
    wx.navigateTo({ url: '/pages/exercise-library/exercise-library?mode=picker' });
  },

  // ---------- Hyrox 分段 ----------
  onLoadHyroxPreset() {
    const presets: [string, string][] = [
      ['跑步', '1公里'], ['滑雪机 SkiErg', '1000米'], ['跑步', '1公里'],
      ['雪橇推 Sled Push', '50米'], ['跑步', '1公里'], ['雪橇拉 Sled Pull', '50米'],
      ['跑步', '1公里'], ['波比跳远 Burpee Broad Jumps', '80米'], ['跑步', '1公里'],
      ['划船 Rowing', '1000米'], ['跑步', '1公里'], ['农夫行走 Farmer\'s Carry', '200米'],
      ['跑步', '1公里'], ['沙袋箭步蹲 Sandbag Lunges', '100米'], ['跑步', '1公里'],
      ['投药球 Wall Balls', '100次'],
    ];
    this.setData({ hyroxStations: presets.map(([name, metric], i) => ({ id: genId(), name, metric, weight_kg: '', exercise_id: '', done: false })) });
  },

  onAddHyroxStation() {
    this.setData({ hyroxStations: [...this.data.hyroxStations, { id: genId(), name: '', metric: '', weight_kg: '', exercise_id: '', done: false }] });
  },

  onHyroxStationInput(e: any) {
    const { id, field } = e.currentTarget.dataset;
    const stations = this.data.hyroxStations.map((s: any) =>
      s.id === id ? { ...s, [field]: e.detail.value } : s);
    this.setData({ hyroxStations: stations });
  },

  onPickHyroxStation(e: any) {
    const { id } = e.currentTarget.dataset;
    storage.set('picker_target', 'hyrox');
    storage.set('picker_mov_id', id);
    wx.navigateTo({ url: '/pages/exercise-library/exercise-library?mode=picker' });
  },

  onHyroxToggleDone(e: any) {
    const { id } = e.currentTarget.dataset;
    const stations = this.data.hyroxStations.map((s: any) =>
      s.id === id ? { ...s, done: !s.done } : s);
    this.setData({ hyroxStations: stations });
  },

  onRemoveHyroxStation(e: any) {
    const { id } = e.currentTarget.dataset;
    this.setData({ hyroxStations: this.data.hyroxStations.filter((s: any) => s.id !== id) });
  },

  // ---------- 混合高强度心率 ----------
  onMetconAvgHrInput(e: any) {
    this.setData({ metconAvgHr: e.detail.value });
  },

  onMetconMaxHrInput(e: any) {
    this.setData({ metconMaxHr: e.detail.value });
  },

  onOverallRpeInput(e: any) {
    this.setData({ overallRpe: e.detail.value });
  },

  onNewSportInput(e: any) {
    this.setData({ newSportName: e.detail.value });
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startAt) / 1000);
      this.setData({ elapsed, elapsedText: formatDuration(elapsed) });
    }, 1000);
  },

  onSelectCategory(e: any) {
    const { key } = e.currentTarget.dataset;
    if (this.data.started) return;
    const item = this.data.categories.find((c: any) => c.key === key);
    if (!item) return;
    const isEndurance = key === 'run' || key === 'cycle' || key === 'swim' || key === 'hike';
    const isCrossFit = key === 'crossfit';
    const isHyrox = key === 'hyrox';
    if (key === 'custom') {
      // 自定义：直接选中，下方展开「已保存运动」与「新增」输入框
      this.setData({
        selectedKey: 'custom',
        category: '自定义',
        sportName: '',
        isEndurance: false,
        isCrossFit: false,
        isHyrox: false,
      });
      return;
    }
    this.setData({
      selectedKey: key,
      category: item.category,
      sportName: item.sport,
      customSport: '',
      isEndurance,
      isCrossFit,
      isHyrox,
      runMode: key === 'hike' ? 'long' : this.data.runMode,
    });
  },

  onStart() {
    this.startAt = Date.now();
    this.setData({ started: true, elapsed: 0, elapsedText: '00:00' });
    this.startTimer();
    wx.vibrateShort({ type: 'light' });
  },

  async onStop() {
    if (!this.data.started || this.data.saving) return;
    const { exercises, category, sportName, customSport, elapsed, isEndurance, isCrossFit, isHyrox, wod, hyroxStations, metconAvgHr, metconMaxHr, overallRpe, runMode, longRun, runGroups, runGroupAvgHr, runGroupMaxHr } = this.data;

    let detail: any;
    let exList: any[] = [];
    if (isCrossFit) {
      // CrossFit：WOD 结构 + 心率
      detail = {
        wod: { ...wod, movements: wod.movements.filter((m: any) => (m.name || '').trim()) },
        avg_hr: metconAvgHr.trim(),
        max_hr: metconMaxHr.trim(),
      };
    } else if (isHyrox) {
      // Hyrox：分段赛程 + 心率
      detail = {
        hyrox: {
          stations: hyroxStations.map((s: any) => ({
            name: (s.name || '').trim(),
            metric: (s.metric || '').trim(),
            weight_kg: (s.weight_kg || '').trim(),
            exercise_id: (s.exercise_id || '').trim(),
            done: s.done,
          })),
        },
        avg_hr: metconAvgHr.trim(),
        max_hr: metconMaxHr.trim(),
      };
    } else if (isEndurance) {
      if (runMode === 'long') {
        detail = {
          run: {
            mode: 'long',
            distance: (longRun.distance || '').trim(),
            time_min: (longRun.timeMin || '').trim(),
            avg_hr: (longRun.avgHr || '').trim(),
            max_hr: (longRun.maxHr || '').trim(),
            climb: (longRun.climb || '').trim(),
          },
        };
      } else {
        const groups = runGroups
          .filter((g: any) => (g.distance || '').trim() || (g.time_sec || '').trim())
          .map((g: any) => ({
            distance: (g.distance || '').trim(),
            time_sec: (g.time_sec || '').trim(),
            rest_sec: (g.rest_sec || '').trim(),
          }));
        detail = {
          run: {
            mode: 'custom',
            groups,
            avg_hr: (runGroupAvgHr || '').trim(),
            max_hr: (runGroupMaxHr || '').trim(),
          },
        };
      }
    } else {
      // 力量训练：每个完成的组 = 一条 exercise 记录（sets=1）
      exercises.forEach((ex: any) => {
        ex.sets
          .filter((s: any) => s.done && (s.reps || s.weight_kg))
          .forEach((s: any) => {
            exList.push({
              exercise_name: ex.exercise_name,
              exercise_id: ex.exercise_id,
              sets: 1,
              reps: s.reps ? parseInt(s.reps, 10) : 0,
              weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : 0,
              rpe: s.rpe ? parseFloat(s.rpe) : null,
            });
          });
      });
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });
    try {
      const durationMin = Math.max(0, Math.round(elapsed / 60));
      const payload: any = {
        category,
        sport_name: customSport || sportName || (category + '训练'),
        start_time: new Date(this.startAt).toISOString(),
        duration: durationMin,
        exercises: exList,
        notes: (!isEndurance && !isCrossFit && !isHyrox) && exList.length === 0 ? '空训练（未记录动作）' : undefined,
      };
      if (detail) payload.detail = detail;
      // 整体主观疲劳 RPE（有氧/CrossFit/Hyrox，Borg 6-20）
      if (overallRpe && parseFloat(overallRpe) > 0) {
        payload.rpe = parseFloat(overallRpe);
      }
      const res: any = await api.createSession(payload);
      wx.hideLoading();
      const vol = exList.reduce((s, x) => s + (x.weight_kg || 0) * (x.reps || 0), 0);
      const kcal = res?.calories_burned != null ? ` · ${res.calories_burned} kcal` : '';
      wx.showModal({
        title: '训练已保存 ',
        content: (isEndurance || isCrossFit || isHyrox)
          ? `时长 ${durationMin} 分钟${kcal}`
          : `时长 ${durationMin} 分钟 · ${exList.length} 组 · 容量 ${Math.round(vol)} kg`,
        showCancel: false,
        confirmText: '好的',
        success: () => {
          if (this.timer) { clearInterval(this.timer); this.timer = null; }
          this.setData({
            started: false, elapsed: 0, exercises: [], nlpText: '', manualName: '',
            wod: { mode: 'AMRAP', timerMode: 'count-up', timeCapMin: '', rounds: '', extraReps: '', totalMin: '', totalTimeSec: '', movements: [] },
            hyroxStations: [], metconAvgHr: '', metconMaxHr: '', overallRpe: '',
            runMode: 'long', longRun: { distance: '', timeMin: '', avgHr: '', maxHr: '', climb: '' },
            runGroups: [], runGroupAvgHr: '', runGroupMaxHr: '',
          });
        },
      });
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ saving: false });
    }
  },

  // ---------- 动作管理 ----------
  addExercises(items: any[]) {
    if (!items || !items.length) return;
    const newExs = items.map((p: any) => ({
      id: genId(),
      exercise_name: p.name || p.exercise_name,
      exercise_id: p.exercise_id,
      sets: [{ id: genId(), reps: '', weight_kg: '', rpe: '', done: false }],
    }));
    this.setData({ exercises: [...this.data.exercises, ...newExs] }, () => this.recalc());
  },

  onPickFromLibrary() {
    storage.set('picker_target', 'strength');
    storage.set('picker_mov_id', '');
    wx.navigateTo({ url: '/pages/exercise-library/exercise-library?mode=picker' });
  },

  onManualInput(e: any) {
    this.setData({ manualName: e.detail.value });
  },

  onManualAdd() {
    const name = this.data.manualName.trim();
    if (!name) return;
    this.addExercises([{ name }]);
    this.setData({ manualName: '' });
  },

  onNlpInput(e: any) {
    this.setData({ nlpText: e.detail.value });
  },

  async onNlpParse() {
    const text = this.data.nlpText.trim();
    if (!text || this.data.nlpLoading) return;
    this.setData({ nlpLoading: true });
    wx.showLoading({ title: 'AI 解析中...' });
    try {
      const res: any = await api.createSessionNlp(text, new Date().toISOString());
      const session = res?.session;
      const exs: any[] = session?.detail_json?.exercises || [];
      const items = exs
        .filter((e: any) => e.exercise_name)
        .map((e: any) => ({ name: e.exercise_name, exercise_id: e.exercise_id }));
      if (items.length > 0) {
        this.addExercises(items);
      } else {
        this.addExercises([{ name: text }]);
      }
      this.setData({ nlpText: '' });
      wx.hideLoading();
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ nlpLoading: false });
    }
  },

  onRemoveExercise(e: any) {
    const { id } = e.currentTarget.dataset;
    const exercises = this.data.exercises.filter((ex: any) => ex.id !== id);
    this.setData({ exercises }, () => this.recalc());
  },

  onSetField(e: any) {
    const { exid, setid, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const exercises = this.data.exercises.map((ex: any) => {
      if (ex.id !== exid) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s: any) => (s.id === setid ? { ...s, [field]: value } : s)),
      };
    });
    this.setData({ exercises });
  },

  onCompleteSet(e: any) {
    const { exid, setid } = e.currentTarget.dataset;
    const exercises = this.data.exercises.map((ex: any) => {
      if (ex.id !== exid) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s: any) => (s.id === setid ? { ...s, done: true } : s)),
      };
    });
    this.setData({ exercises }, () => {
      this.recalc();
      wx.vibrateShort({ type: 'light' });
    });
  },

  onAddNextSet(e: any) {
    const { exid } = e.currentTarget.dataset;
    const exercises = this.data.exercises.map((ex: any) => {
      if (ex.id !== exid) return ex;
      return { ...ex, sets: [...ex.sets, { id: genId(), reps: '', weight_kg: '', rpe: '', done: false }] };
    });
    this.setData({ exercises }, () => this.recalc());
  },

  recalc() {
    let totalSets = 0;
    let totalVolume = 0;
    this.data.exercises.forEach((ex: any) => {
      ex.sets.forEach((s: any) => {
        if (s.done) {
          totalSets += 1;
          totalVolume += (s.weight_kg ? parseFloat(s.weight_kg) : 0) * (s.reps ? parseInt(s.reps, 10) : 0);
        }
      });
    });
    this.setData({ totalSets, totalVolume: Math.round(totalVolume) });
  },

  onShareAppMessage() {
    return { title: '超会练 · 开始训练', path: '/pages/training/training' };
  },
});
