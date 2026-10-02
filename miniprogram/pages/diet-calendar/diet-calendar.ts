import { api } from '../../utils/api';
import { round } from '../../utils/format';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

Page({
  data: {
    year: 0,
    month: 0,
    week: WEEK,
    cells: [] as any[],
    recordDates: [] as string[],
    selected: '',
    dayStats: null as any,
    dayRecords: [] as any[],
  },

  onLoad() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      selected: this.toStr(now),
    });
    this.loadDates();
    this.buildCalendar(now.getFullYear(), now.getMonth() + 1);
  },

  toStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async loadDates() {
    try {
      const dates = await api.getDietRecordDates();
      this.setData({ recordDates: dates || [] });
      this.buildCalendar(this.data.year, this.data.month);
      this.loadDay(this.data.selected);
    } catch (e: any) {}
  },

  buildCalendar(year: number, month: number) {
    const first = new Date(year, month - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const { recordDates, selected } = this.data;
    const cells: any[] = [];
    for (let i = 0; i < startDow; i++) {
      cells.push({ key: `b${i}`, blank: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        key: `d${d}`,
        day: d,
        date: dateStr,
        hasRecord: recordDates.includes(dateStr),
        selected: dateStr === selected,
      });
    }
    this.setData({ cells });
  },

  onPrevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    this.setData({ year, month });
    this.buildCalendar(year, month);
  },

  onNextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    this.setData({ year, month });
    this.buildCalendar(year, month);
  },

  onSelectDay(e: any) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    this.setData({ selected: date });
    this.buildCalendar(this.data.year, this.data.month);
    this.loadDay(date);
  },

  async loadDay(date: string) {
    try {
      const [stats, records] = await Promise.all([
        api.getDietStats(date).catch(() => null),
        api.getDietRecords(date).catch(() => [] as any[]),
      ]);
      this.setData({
        dayStats: stats
          ? {
              ...stats,
              calories_text: Math.round(stats.total_calories || 0),
              protein_text: round(stats.total_protein),
              carbs_text: round(stats.total_carbs),
              fat_text: round(stats.total_fat),
            }
          : null,
        dayRecords: (records || []).map((r: any) => ({
          ...r,
          calories: r.total_calories ? Math.round(r.total_calories) : 0,
        })),
      });
    } catch (e: any) {}
  },
});
