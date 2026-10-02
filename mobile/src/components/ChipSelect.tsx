// 标签式选择器 —— 替代 Tamagui Select 在 Web 端出现的"卡死原生下拉"问题
// 渲染为一行/多行可点击的 pill 按钮，选中高亮，纯 JS 切换
import React from 'react';
import { Text, XStack, YStack, View } from 'tamagui';
import { colors, radius } from '../theme/tokens';

export interface ChipOption {
  key: string;
  label: string;
  icon?: string;
}

interface ChipSelectProps {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
  label?: string;
}

export function ChipSelect({ options, value, onChange, label }: ChipSelectProps) {
  return (
    <YStack gap={6}>
      {label && <Text fontSize={12} color={colors.textMuted}>{label}</Text>}
      <XStack gap={8} flexWrap="wrap">
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <View
              key={opt.key}
              paddingHorizontal={14}
              paddingVertical={8}
              borderRadius={radius.pill}
              backgroundColor={active ? colors.primary : colors.surfaceLight}
              borderWidth={1}
              borderColor={active ? colors.primary : colors.border}
              onPress={() => onChange(opt.key)}
              accessibilityRole="button"
            >
              <Text
                fontSize={13}
                fontWeight={active ? '600' : '500'}
                color={active ? '#fff' : colors.textSecondary}
              >
                {opt.icon ? `${opt.icon} ` : ''}{opt.label}
              </Text>
            </View>
          );
        })}
      </XStack>
    </YStack>
  );
}

export default ChipSelect;