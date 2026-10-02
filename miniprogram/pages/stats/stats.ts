import { api } from '../../utils/api';
import { round } from '../../utils/format';

const DAYS_OPTIONS = [7, 30, 90];

const TRAIN_METRICS = [
  { key: 'counts', label: '训练次数', unit: '' },
  { key: 'durations', label: '训练时长', unit: 'min' },
  { key: 'calories', label: '热量消耗', unit: 'kcal' },
  { key: 'volumes', label: '训练容量', unit: 'kg' },
];

const DIET_METRICS = [
  { key: 'calories', label: '摄入热量', unit: 'kcal' },
  { key: 'protein', label: '蛋白质', unit: 'g' },
  { key: 'carbs', label: '碳水', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
];

/** 疲劳等级 → 展示颜色 */
const LEVEL_CLASS: Record<string, string> = {
  peak: 'text-success',
  good: 'text-success',
  mild: 'text-warning',
  fatigued: 'text-danger',
  overtrain: 'text-danger',
};

/** 从 trend.body 提取静息心率记录（非空值，最新在前） */
function buildHrList(trend: any): any[] {
  const body = trend?.body || {};
  const dates = body.dates || [];
  const hrs = body.resting_heart_rates || [];
  const list: any[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (hrs[i] != null && hrs[i] !== '') {
      list.push({ date: dates[i], hr: Math.round(Number(hrs[i])) });
    }
  }
  return list.reverse();
}

/** 用 canvas 2D 画折线图（稀疏点数据：null 跳过，折线连接有效点） */
function drawLineChart(
  ctx: any, width: number, height: number,
  values: (number | null)[], dates: string[],
  opts: { min: number; max: number; color: string; showYLabels?: boolean },
) {
  // showYLabels=false 时隐藏 Y 轴数值（RPE 趋势用：混合了 CR-10 与 Borg 6-20 两套量表，
  // 折算后的绝对值没有直观意义，只呈现相对高低走势，避免用户误读具体数字）
  const showYLabels = opts.showYLabels !== false;
  const padding = { left: showYLabels ? 36 : 14, right: 14, top: 14, bottom: 26 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const { color } = opts;

  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  let min = opts.min;
  let max = opts.max;
  if (valid.length && (min == null || max == null)) {
    min = Math.min(...valid);
    max = Math.max(...valid);
    if (min === max) { min -= 5; max += 5; }
    const pad = (max - min) * 0.15 || 5;
    min = Math.floor(min - pad);
    max = Math.ceil(max + pad);
  }
  if (min == null) min = 0;
  if (max == null) max = 10;

  ctx.clearRect(0, 0, width, height);

  // 网格 + Y 轴刻度
  const steps = 4;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= steps; i++) {
    const val = max - ((max - min) * i) / steps;
    const y = padding.top + (plotH * i) / steps;
    ctx.strokeStyle = '#262A31';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    if (showYLabels) {
      ctx.fillStyle = '#5C6570';
      ctx.fillText(String(Math.round(val)), padding.left - 6, y);
    }
  }

  // 有效点
  const n = values.length;
  const pts: Array<{ x: number; y: number; v: number }> = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n <= 1 ? padding.left + plotW / 2 : padding.left + (plotW * i) / (n - 1);
    const y = padding.top + plotH * (1 - (v - min!) / (max! - min!));
    pts.push({ x, y, v });
  });

  // 折线
  if (pts.length > 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  // 数据点
  pts.forEach((p) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // X 轴日期标签（首、中、尾）
  ctx.fillStyle = '#5C6570';
  ctx.textAlign = 'center';
  const showIdx = new Set([0, Math.floor((n - 1) / 2), n - 1]);
  showIdx.forEach((i) => {
    if (i < 0 || i >= n || !dates[i]) return;
    const x = n <= 1 ? padding.left + plotW / 2 : padding.left + (plotW * i) / (n - 1);
    ctx.fillText(dates[i].slice(5), x, height - padding.bottom + 12);
  });
}

/** 把数组折叠成最多 N 段（均值），保证柱状图可读 */
function bucketize(arr: number[], n = 14): number[] {
  if (!arr || !arr.length) return [];
  if (arr.length <= n) return arr;
  const size = Math.ceil(arr.length / n);
  const out: number[] = [];
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size).filter((v) => v !== null && v !== undefined);
    if (!chunk.length) continue;
    out.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
  }
  return out;
}

Page({
  data: {
    days: 30,
    daysOptions: DAYS_OPTIONS,
    loading: true,
    stats: null as any,
    trend: null as any,
    fatigue: null as any,
    hrList: [] as any[],
    latestHr: null as any,
    hasRpe: false,
    trainKey: 'counts',
    trainMetrics: TRAIN_METRICS,
    dietKey: 'calories',
    dietMetrics: DIET_METRICS,
    trainBars: [] as any[],
    dietBars: [] as any[],
    trainSum: 0,
    dietSum: 0,
    trainUnit: '',
    dietUnit: 'kcal',
  },

  onLoad() {
    this.load();
  },

  load() {
    const d = this.data.days;
    this.setData({ loading: true });
    Promise.all([api.getSessionStats(), api.getStatsTrend(d), api.getFatigue().catch(() => null)])
      .then(([stats, trend, fatigue]: any[]) => {
        const s = stats || {};
        const f = fatigue
          ? { ...fatigue, levelClass: LEVEL_CLASS[fatigue.level] || 'text-warning' }
          : null;
        const hrList = buildHrList(trend);
        let latestHr: any = null;
        if (hrList.length > 0) {
          const latest = hrList[0];
          const prev = hrList.length > 1 ? hrList[1] : null;
          latestHr = {
            hr: latest.hr,
            date: latest.date,
            change: prev ? latest.hr - prev.hr : null,
          };
        }
        const rpeArr = (trend.training && trend.training.rpe) || [];
        const hasRpe = rpeArr.some((v: any) => v != null);
        this.setData({
          stats: {
            ...s,
            duration_text: Math.round(s.total_duration_min || 0),
            volume_text: Math.round(s.total_volume_kg || 0),
          },
          trend,
          fatigue: f,
          hrList,
          latestHr,
          hasRpe,
        }, () => {
          this.buildCharts();
          setTimeout(() => this.drawLineCharts(), 60);
        });
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }));
  },

  onSelectDays(e: any) {
    const { days } = e.currentTarget.dataset;
    this.setData({ days }, () => this.load());
  },

  onSelectTrainMetric(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ trainKey: key }, () => this.buildCharts());
  },

  onSelectDietMetric(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ dietKey: key }, () => this.buildCharts());
  },

  buildCharts() {
    const { trend, trainKey, dietKey } = this.data;
    if (!trend) return;

    const dates = trend.dates || [];
    const trainRaw: number[] = (trend.training && trend.training[trainKey]) || [];
    const dietRaw: number[] = (trend.diet && trend.diet[dietKey]) || [];

    const tm = TRAIN_METRICS.find((m) => m.key === trainKey) || TRAIN_METRICS[0];
    const dm = DIET_METRICS.find((m) => m.key === dietKey) || DIET_METRICS[0];

    this.setData({
      trainBars: this.toBars(bucketize(trainRaw), dates.length),
      dietBars: this.toBars(bucketize(dietRaw), dates.length),
      trainSum: trainRaw.reduce((a, b) => a + (b || 0), 0),
      dietSum: dietRaw.reduce((a, b) => a + (b || 0), 0),
      trainUnit: tm.unit,
      dietUnit: dm.unit,
    });
  },

  /** 柱状图高度按最大值归一化，保底 8% 保证矮柱可见 */
  toBars(arr: number[], totalLen: number) {
    if (!arr.length) return [];
    const max = Math.max(...arr);
    return arr.map((v) => ({
      h: max > 0 ? Math.max(8, Math.round((v / max) * 100)) : 8,
      v: round(v),
    }));
  },

  /** 画静息心率与 RPE 均值两个折线图（canvas 2D） */
  drawLineCharts() {
    const { trend } = this.data;
    if (!trend) return;
    const dates: string[] = trend.dates || [];
    const hrVals: any[] = (trend.body && trend.body.resting_heart_rates) || [];
    const rpeVals: any[] = (trend.training && trend.training.rpe) || [];

    const query = wx.createSelectorQuery();
    query.select('#hrChart').fields({ node: true, size: true });
    query.select('#rpeChart').fields({ node: true, size: true });
    query.exec((res: any) => {
      if (res && res[0]) {
        this.drawOneLine(res[0], hrVals, dates, { min: 40, max: 100, color: '#3ECF8E' });
      }
      if (res && res[1]) {
        this.drawOneLine(res[1], rpeVals, dates,
          { min: 0, max: 10, color: '#FF8A5C', showYLabels: false });
      }
    });
  },

  drawOneLine(info: any, values: any[], dates: string[], opts: any) {
    if (!info || !info.node) return;
    const canvas = info.node;
    const ctx = canvas.getContext('2d');
    let dpr = 2;
    try {
      dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
    } catch (e) {}
    canvas.width = info.width * dpr;
    canvas.height = info.height * dpr;
    ctx.scale(dpr, dpr);
    drawLineChart(ctx, info.width, info.height, values, dates, opts);
  },

  onShareAppMessage() {
    return { title: '超会练 · 数据复盘', path: '/pages/stats/stats' };
  },
});
