/**
 * 格式化工具：日期 / 数字 / 单位
 *
 * 时区约定：后端 created_at 用 SQL 的 func.now()（UTC），序列化为
 * "YYYY-MM-DD HH:MM:SS"（无时区标记）。JS 若按本地时间解析会差 8 小时，
 * 因此统一把这种格式视为 UTC 再转本地显示。
 */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 解析后端时间字符串为本地 Date：
 * - "YYYY-MM-DD HH:MM:SS"（空格分隔，视为 UTC）→ 补 Z 转本地
 * - 带 T 或带时区的 ISO 字符串 → 标准解析
 * - 纯日期 "YYYY-MM-DD" → 原样返回当天 00:00（本地）
 */
export function parseDate(dateStr: string): Date {
  const s = String(dateStr || '').trim();
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00`);
  }
  return new Date(s);
}

export function todayStr(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  // 纯日期字符串原样返回（避免时区偏移把日期改到前一天）
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间：刚刚、x分钟前、x小时前、x天前或日期 */
export function fromNow(dateStr?: string): string {
  if (!dateStr) return '';
  const t = parseDate(dateStr).getTime();
  if (isNaN(t)) return dateStr;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}天前`;
  return formatDate(dateStr);
}

export function round(n: number | null | undefined, digits: number = 0): number | string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export function thousands(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

export function percent(n: number | null | undefined, digits: number = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}
