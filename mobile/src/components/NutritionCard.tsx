// 营养卡片组件 —— 展示当日宏量营养素与供能占比
import React from 'react';
import { Text, XStack, YStack, View } from 'tamagui';
import { colors } from '../theme/tokens';

interface Props {
  stats: {
    total_calories: number;
    total_protein: number;
    total_fat: number;
    total_carbs: number;
    protein_pct: number;
    fat_pct: number;
    carbs_pct: number;
  };
}

export function NutritionCard({ stats }: Props) {
  const items = [
    { label: '热量', value: `${Math.round(stats.total_calories)}`, unit: 'kcal', color: colors.primary },
    { label: '蛋白质', value: `${Math.round(stats.total_protein)}`, unit: 'g', color: colors.success },
    { label: '碳水', value: `${Math.round(stats.total_carbs)}`, unit: 'g', color: colors.warning },
    { label: '脂肪', value: `${Math.round(stats.total_fat)}`, unit: 'g', color: colors.danger },
  ];

  return (
    <YStack backgroundColor={colors.surface} padding={16} borderRadius={16} gap={12}>
      <Text fontSize={17} fontWeight="bold" color={colors.text}>营养摄入</Text>
      <XStack justifyContent="space-between">
        {items.map((it) => (
          <YStack key={it.label} alignItems="center" flex={1} gap={4}>
            <Text color={it.color} fontSize={20} fontWeight="bold">
              {it.value}
            </Text>
            <Text color={colors.textMuted} fontSize={11}>{it.unit}</Text>
            <Text color={colors.textMuted} fontSize={11}>{it.label}</Text>
          </YStack>
        ))}
      </XStack>
      {/* 供能占比条 */}
      <YStack gap={4} marginTop={8}>
        <Text color={colors.textMuted} fontSize={11}>供能占比</Text>
        <XStack height={12} borderRadius={8} overflow="hidden">
          <View flex={stats.protein_pct} backgroundColor={colors.success} />
          <View flex={stats.carbs_pct} backgroundColor={colors.warning} />
          <View flex={stats.fat_pct} backgroundColor={colors.danger} />
        </XStack>
        <XStack gap={12} marginTop={4}>
          <Text color={colors.success} fontSize={11}>蛋白 {stats.protein_pct}%</Text>
          <Text color={colors.warning} fontSize={11}>碳水 {stats.carbs_pct}%</Text>
          <Text color={colors.danger} fontSize={11}>脂肪 {stats.fat_pct}%</Text>
        </XStack>
      </YStack>
    </YStack>
  );
}
