// CrossFit WOD 计时浮窗：可拖动/缩放，跨页面持续，CrossFit 训练中显示
// 倒计时目标时长 AMRAP 用 timeCapMin、EMOM 用 totalMin，归零显示红色"时间到"；Chipper 固定正计时
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, XStack, Button } from 'tamagui';

import { colors, radius } from '../theme/tokens';
import { useTraining } from '../context/TrainingContext';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

export function WodTimerFloating() {
  const { started, elapsed, category, wod, stop } = useTraining();

  // 浮窗位置（默认右上角，避免与 RestTimerFloating 右下角重叠）
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // 拖动（web pointer 事件）
  const onPointerDown = useCallback((e: any) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as any).setPointerCapture?.(e.pointerId);
  }, [pos]);
  const onPointerMove = useCallback((e: any) => {
    if (dragRef.current) {
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    }
  }, []);
  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);
  const onWheel = useCallback((e: any) => {
    e.preventDefault?.();
    setScale((s) => Math.min(1.6, Math.max(0.6, s + (e.deltaY < 0 ? 0.1 : -0.1))));
  }, []);

  // 窗口尺寸变化时保持可见
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setPos((p) => ({
        x: Math.max(0, Math.min(p.x, window.innerWidth - 120)),
        y: Math.max(0, Math.min(p.y, window.innerHeight - 120)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!started || category !== 'CrossFit') return null;

  // 计算目标时长（秒）—— 倒计时使用
  let targetSec = 0;
  if (wod.mode === 'AMRAP') targetSec = parseFloat(wod.timeCapMin) * 60 || 0;
  else if (wod.mode === 'EMOM') targetSec = parseFloat(wod.totalMin) * 60 || 0;
  else if (wod.mode === 'Chipper') targetSec = parseFloat(wod.totalTimeSec) || 0;

  const isCountDown = wod.timerMode === 'count-down' && targetSec > 0;
  const remain = isCountDown ? Math.max(0, targetSec - elapsed) : elapsed;
  const done = isCountDown && remain === 0;

  // 倒计时进度：已过时长/目标（正计时不显示）
  const pct = isCountDown && targetSec > 0
    ? Math.min(100, ((targetSec - remain) / targetSec) * 100)
    : 0;

  const accent = done ? colors.danger : isCountDown ? colors.warning : colors.primary;
  const title = done
    ? '⏰ 时间到！'
    : isCountDown
      ? `⏰ WOD 倒计时（${wod.mode}）`
      : wod.mode === 'Chipper'
        ? '⏱ WOD 完成总时间'
        : '⏱ WOD 正计时';

  return (
    <View
      {...({ position: 'fixed', onWheel } as any)}
      left={pos.x}
      top={pos.y}
      zIndex={9999}
      cursor="move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      userSelect="none"
    >
      <View
        width={300 * scale}
        backgroundColor="rgba(20,22,30,0.96)"
        borderRadius={radius.lg}
        padding={16 * scale}
        alignItems="center"
        gap={8}
        borderWidth={1}
        borderColor={accent}
        shadowColor="#000"
        shadowOpacity={0.4}
        shadowRadius={12}
        shadowOffset={{ width: 0, height: 4 }}
      >
        <XStack width="100%" justifyContent="space-between" alignItems="center">
          <Text fontSize={13 * scale} color={accent} fontWeight="700">{title}</Text>
          <Text fontSize={10 * scale} color={colors.textMuted}>拖动/滚轮缩放</Text>
        </XStack>

        <Text
          fontSize={52 * scale}
          fontWeight="bold"
          color={done ? colors.danger : colors.text}
          fontVariant={['tabular-nums']}
          lineHeight={58 * scale}
        >
          {formatDuration(remain)}
        </Text>

        {isCountDown && (
          <View width="100%" height={6} borderRadius={3} backgroundColor="rgba(255,255,255,0.12)" overflow="hidden">
            <View height={6} width={`${pct}%`} backgroundColor={accent} />
          </View>
        )}

        <Text fontSize={10 * scale} color={colors.textMuted}>
          训练累计 {formatDuration(elapsed)} / {isCountDown && targetSec > 0 ? `目标 ${formatDuration(targetSec)}` : wod.mode}
        </Text>

        <XStack gap={6}>
          <Button
            size="$3"
            flex={1}
            height={34}
            backgroundColor={colors.danger}
            borderRadius={radius.pill}
            onPress={(e: any) => { e.stopPropagation?.(); stop(); }}
          >
            <Text fontSize={12} color="#fff" fontWeight="600">结束训练</Text>
          </Button>
        </XStack>

        <XStack gap={6}>
          <Button size="$2" height={24} paddingHorizontal={10} backgroundColor="rgba(255,255,255,0.08)" borderRadius={radius.pill}
            onPress={(e: any) => { e.stopPropagation?.(); setScale((s) => Math.max(0.6, s - 0.15)); }}>
            <Text fontSize={11} color={colors.textMuted}>－</Text>
          </Button>
          <Text fontSize={10} color={colors.textMuted} alignSelf="center">{Math.round(scale * 100)}%</Text>
          <Button size="$2" height={24} paddingHorizontal={10} backgroundColor="rgba(255,255,255,0.08)" borderRadius={radius.pill}
            onPress={(e: any) => { e.stopPropagation?.(); setScale((s) => Math.min(1.6, s + 0.15)); }}>
            <Text fontSize={11} color={colors.textMuted}>＋</Text>
          </Button>
        </XStack>
      </View>
    </View>
  );
}

export default WodTimerFloating;
