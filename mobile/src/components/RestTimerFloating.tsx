// 全局组间休息浮窗 —— 可拖动、可缩放，跨页面显示
// 挂在 App 根部，训练中完成一组后任意页面都可见
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, XStack, Button } from 'tamagui';

import { colors, radius } from '../theme/tokens';
import { useTraining } from '../context/TrainingContext';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

export function RestTimerFloating() {
  const { started, elapsed, restRemaining, restSeconds, setRestSeconds, skipRest } = useTraining();

  // 浮窗位置与大小（默认右下角）
  const [pos, setPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 320 : 300, y: 120 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const sizeRef = useRef(1);
  sizeRef.current = scale;

  // 拖动逻辑（web pointer 事件）
  const onPointerDown = useCallback((e: any) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as any).setPointerCapture?.(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: any) => {
    if (dragRef.current) {
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // 滚轮缩放
  const onWheel = useCallback((e: any) => {
    e.preventDefault?.();
    setScale((s) => Math.min(1.6, Math.max(0.6, s + (e.deltaY < 0 ? 0.1 : -0.1))));
  }, []);

  // 窗口尺寸变化时保持在可视范围内
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - 120),
        y: Math.min(p.y, window.innerHeight - 120),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const restPct = restSeconds > 0 ? Math.min(100, ((restSeconds - restRemaining) / restSeconds) * 100) : 0;

  if (!started || restRemaining <= 0) return null;

  const fontScale = scale;

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
        width={280 * scale}
        backgroundColor="rgba(20,22,30,0.96)"
        borderRadius={radius.lg}
        padding={16 * scale}
        alignItems="center"
        gap={8}
        borderWidth={1}
        borderColor={colors.warning}
        shadowColor="#000"
        shadowOpacity={0.4}
        shadowRadius={12}
        shadowOffset={{ width: 0, height: 4 }}
      >
        <XStack width="100%" justifyContent="space-between" alignItems="center">
          <Text fontSize={13 * fontScale} color={colors.warning} fontWeight="700">组间休息</Text>
          <Text fontSize={11 * fontScale} color={colors.textMuted}>拖动/滚轮缩放</Text>
        </XStack>

        {/* 倒计时数字 */}
        <Text fontSize={52 * fontScale} fontWeight="bold" color={colors.warning} fontVariant={['tabular-nums']} lineHeight={58 * fontScale}>
          {formatDuration(restRemaining)}
        </Text>

        {/* 进度条 */}
        <View width="100%" height={6} borderRadius={3} backgroundColor="rgba(255,255,255,0.12)" overflow="hidden">
          <View height={6} width={`${restPct}%`} backgroundColor={colors.warning} />
        </View>

        {/* 总训练时长 */}
        <Text fontSize={10 * fontScale} color={colors.textMuted}>总训练时长 {formatDuration(elapsed)}</Text>

        {/* 时长切换 + 跳过 */}
        <XStack gap={6} flexWrap="wrap" justifyContent="center">
          {[30, 45, 60, 90, 120].map((v) => (
            <Button
              key={v}
              size="$2"
              paddingHorizontal={10}
              height={28}
              backgroundColor={restSeconds === v ? colors.primary : 'rgba(255,255,255,0.1)'}
              borderRadius={radius.pill}
              onPress={(e: any) => { e.stopPropagation?.(); setRestSeconds(v); }}
            >
              <Text fontSize={10} color={restSeconds === v ? '#fff' : colors.textSecondary}>{v}s</Text>
            </Button>
          ))}
        </XStack>
        <Button
          size="$3"
          width="100%"
          height={34}
          backgroundColor={colors.primary}
          borderRadius={radius.pill}
          onPress={(e: any) => { e.stopPropagation?.(); skipRest(); }}
        >
          <Text fontSize={12} color="#fff" fontWeight="600">跳过休息，继续训练 ⏭</Text>
        </Button>

        {/* 缩放控制按钮 */}
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

export default RestTimerFloating;
