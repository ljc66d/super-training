// 趋势柱状图（纯 SVG 自绘）：摄入 vs 目标对比，支持目标虚线
import React, { useMemo } from 'react';
import { Svg, Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/tokens';
import { formatNum, shortDate, sparseIndexes } from './format';

interface Props {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
  target?: number | null;    // 目标参考线（如每日目标摄入）
  targetLabel?: string;
  formatValue?: (v: number) => string;
}

const PAD = { top: 16, right: 8, bottom: 24, left: 46 };

export function TrendBarChart({
  data, labels, height = 170,
  color = colors.primary, target, targetLabel = '目标',
  formatValue = formatNum,
}: Props) {
  const width = 320;

  const geom = useMemo(() => {
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const n = data.length;
    const maxVal = Math.max(1, ...data, target ?? 0);
    const span = maxVal || 1;
    const yOf = (v: number) => PAD.top + (1 - v / span) * plotH;

    const barW = n > 0 ? Math.min(22, (plotW / n) * 0.62) : 0;
    const bars = data.map((v, i) => {
      const x = PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW) - barW / 2;
      const h = (v / span) * plotH;
      return { x, y: yOf(v), h, v, w: barW };
    });

    const ticks = [0, 0.5, 1].map((t) => ({
      y: PAD.top + (1 - t) * plotH,
      label: formatValue(t * span),
    }));

    const tickIdx = sparseIndexes(n, 6).filter((i) => labels && labels[i]);
    const xLabels = tickIdx.map((i) => ({
      x: PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      label: labels ? shortDate(labels[i]) : `${i + 1}`,
    }));

    const targetY = target != null ? yOf(target) : null;
    return { bars, ticks, xLabels, targetY, span };
  }, [data, labels, height, target, formatValue]);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* 网格线 + Y 轴刻度 */}
      {geom.ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={PAD.left} y1={t.y} x2={width - PAD.right} y2={t.y}
                stroke={colors.border} strokeWidth={1} strokeDasharray={i === 0 ? '0' : '3,4'} />
          <SvgText x={PAD.left - 6} y={t.y + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">
            {t.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* 柱体 */}
      {geom.bars.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={Math.max(b.w, 1)} height={Math.max(b.h, 0)}
              rx={3} fill={color} opacity={b.v > 0 ? 0.9 : 0.15} />
      ))}

      {/* 目标参考线 */}
      {geom.targetY != null && (
        <React.Fragment>
          <Line x1={PAD.left} y1={geom.targetY} x2={width - PAD.right} y2={geom.targetY}
                stroke={colors.accent} strokeWidth={1.6} strokeDasharray="6,4" />
          <SvgText x={width - PAD.right} y={geom.targetY - 5} fontSize={10} fill={colors.accent} textAnchor="end">
            {targetLabel}
          </SvgText>
        </React.Fragment>
      )}

      {/* X 轴标签 */}
      {geom.xLabels.map((l: any, i: number) => (
        <SvgText key={i} x={l.x} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">
          {l.label}
        </SvgText>
      ))}
    </Svg>
  );
}

export default TrendBarChart;
