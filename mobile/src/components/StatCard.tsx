// 统计数值卡片 —— 展示指标数值+单位+图标+趋势
import React from 'react';
import { Text, XStack, YStack, View } from 'tamagui';
import { Card } from './Card';
import { colors, radius } from '../theme/tokens';

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon?: string;
  color?: string;
  flex?: number;
}

export function StatCard({ label, value, unit, icon, color = colors.primary, flex = 1 }: StatCardProps) {
  return (
    <View flex={flex} backgroundColor={colors.surface} borderRadius={radius.md} padding={14} borderWidth={1} borderColor={colors.border}>
      <XStack alignItems="center" gap={6} marginBottom={6}>
        {icon && <Text fontSize={14}>{icon}</Text>}
        <Text fontSize={12} color={colors.textMuted}>{label}</Text>
      </XStack>
      <XStack alignItems="baseline" gap={4}>
        <Text fontSize={24} fontWeight="bold" color={color}>{value}</Text>
        {unit && <Text fontSize={12} color={colors.textMuted}>{unit}</Text>}
      </XStack>
    </View>
  );
}

export default StatCard;
