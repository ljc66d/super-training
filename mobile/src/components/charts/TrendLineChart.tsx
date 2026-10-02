// 趋势折线图（纯 SVG 自绘，支持 Web / React Native 双端）
// 支持 null 断点、渐变面积填充、Y 轴刻度与稀疏 X 轴标签
import React, { useMemo } from 'react';
import { Svg, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/tokens';
import { formatNum, shortDate, sparseIndexes } from './format';

interface Props {
  data: (number | null)[];
  labels?: string[];        // 与 data 等长的日期标签（YYYY-MM-DD）
  height?: number;
  color?: string;
  fillColor?: string;       // 面积渐变填充色（默认同 color）
  formatValue?: (v: number) => string;
  fromZero?: boolean;       // Y 轴是否从 0 开始（训练/摄入类），默认 true
  hideYLabels?: boolean;    // 隐藏 Y 轴刻度数字（如 RPE 归一值，绝对值无直观意义只看走势）
}

const PAD_FULL = { top: 16, right: 14, bottom: 24, left: 46 };
const PAD_NO_Y = { top: 16, right: 14, bottom: 24, left: 16 };

export function TrendLineChart({
  data, labels, height = 170,
  color = colors.primary, fillColor,
  formatValue = formatNum, fromZero = true, hideYLabels = false,
}: Props) {
  const width = 320; // 虚拟画布宽度，父容器等比缩放
  const PAD = hideYLabels ? PAD_NO_Y : PAD_FULL;

  const geom = useMemo(() => {
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const valid = data.filter((v): v is number => v !== null && isFinite(v));
    let maxVal = valid.length ? Math.max(...valid) : 1;
    let minVal = valid.length ? Math.min(...valid) : 0;
    if (fromZero) {
      minVal = 0;
      if (maxVal <= 0) maxVal = 1;
    } else {
      if (maxVal === minVal) { maxVal = minVal + (minVal === 0 ? 1 : minVal * 0.1); }
      if (maxVal <= minVal) maxVal = minVal + 1;
    }
    const span = maxVal - minVal || 1;
    const yOf = (v: number) => PAD.top + (1 - (v - minVal) / span) * plotH;

    // 折线 path（null 断点）
    let line = '';
    let area = '';
    let firstX = -1;
    let lastX = -1;
    let started = false;
    data.forEach((v, i) => {
      const x = PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
      if (v === null || !isFinite(v)) { started = false; return; }
      const y = yOf(v);
      if (!started) {
        line += `M${x},${y}`;
        if (firstX < 0) firstX = x;
      } else {
        line += ` L${x},${y}`;
      }
      started = true;
      lastX = x;
    });

    const baseY = PAD.top + plotH;
    if (line && firstX >= 0 && lastX >= 0) {
      area = `${line} L${lastX},${baseY} L${firstX},${baseY} Z`;
    }

    // Y 轴刻度（3 条网格线）
    const ticks = [0, 0.5, 1].map((t) => ({
      y: PAD.top + (1 - t) * plotH,
      label: formatValue(minVal + t * span),
    }));

    // X 轴标签（稀疏，最多 6 个）
    const n = data.length;
    const tickIdx = sparseIndexes(n, 6).filter((i) => labels && labels[i]);
    const xLabels = tickIdx.map((i) => ({
      x: PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      label: labels ? shortDate(labels[i]) : `${i + 1}`,
    }));

    // 数据点圆点（点数太多时省略）
    const dots = n <= 45
      ? data.map((v, i) => {
          if (v === null || !isFinite(v)) return null;
          return {
            x: PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
            y: yOf(v),
          };
        }).filter(Boolean)
      : [];

    return { line, area, ticks, xLabels, dots, maxVal, minVal, baseY, plotW, plotH };
  }, [data, labels, height, formatValue, fromZero, hideYLabels]);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* 网格线 + Y 轴刻度（hideYLabels 时只画网格） */}
      {geom.ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={PAD.left} y1={t.y} x2={width - PAD.right} y2={t.y}
                stroke={colors.border} strokeWidth={1} strokeDasharray={i === 0 ? '0' : '3,4'} />
          {!hideYLabels && (
            <SvgText x={PAD.left - 6} y={t.y + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">
              {t.label}
            </SvgText>
          )}
        </React.Fragment>
      ))}

      {/* 折线 */}
      {geom.line ? (
        <Path d={geom.line} stroke={color} strokeWidth={2.4} fill="none"
              strokeLinejoin="round" strokeLinecap="round" />
      ) : null}

      {/* 数据点 */}
      {geom.dots.map((p: any, i: number) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke={colors.background} strokeWidth={1.5} />
      ))}

      {/* X 轴标签 */}
      {geom.xLabels.map((l: any, i: number) => (
        <SvgText key={i} x={l.x} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">
          {l.label}
        </SvgText>
      ))}
    </Svg>
  );
}

export default TrendLineChart;
