// 图表数值格式化工具
export function formatNum(v: number): string {
  if (!isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  if (abs >= 1000) {
    const s = v.toFixed(0);
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(1);
}

// 日期 'YYYY-MM-DD' -> 'MM-DD'（跨年时显示 'YY-MM'）
export function shortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.slice(5);
  return `${m[2]}-${m[3]}`;
}

// 稀疏取标签：n 个数据点最多显示 maxTicks 个
export function sparseIndexes(n: number, maxTicks: number): number[] {
  if (n <= 0) return [];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (maxTicks - 1);
  const out: number[] = [];
  for (let i = 0; i < maxTicks; i++) {
    out.push(Math.round(i * step));
  }
  // 保证唯一且包含首尾
  const uniq = [...new Set(out)];
  if (uniq[uniq.length - 1] !== n - 1) uniq[uniq.length - 1] = n - 1;
  return uniq;
}
