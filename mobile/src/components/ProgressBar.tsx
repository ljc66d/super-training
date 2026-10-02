// 进度条组件 —— 成就进度/热量完成度等
import React from 'react';
import { View, Text, XStack } from 'tamagui';
import { colors, radius } from '../theme/tokens';

interface ProgressBarProps {
  progress: number;   // 当前值
  target: number;     // 目标值
  color?: string;
  showText?: boolean;
  height?: number;
}

export function ProgressBar({ progress, target, color = colors.primary, showText = true, height = 8 }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
  return (
    <XStack alignItems="center" gap={8}>
      <View flex={1} height={height} backgroundColor={colors.surfaceLight} borderRadius={radius.sm} overflow="hidden">
        <View
          width={`${pct}%`}
          height={height}
          backgroundColor={color}
          borderRadius={radius.sm}
        />
      </View>
      {showText && (
        <Text fontSize={11} color={colors.textMuted} width={60} textAlign="right">
          {progress}/{target}
        </Text>
      )}
    </XStack>
  );
}

export default ProgressBar;
