// 分段选择器组件 —— 用于页面内切换标签
import React from 'react';
import { Text, XStack, View } from 'tamagui';
import { colors, radius } from '../theme/tokens';

interface Option {
  key: string;
  label: string;
  icon?: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <View
      backgroundColor={colors.surface}
      borderRadius={radius.md}
      padding={4}
      flexDirection="row"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <View
            key={opt.key}
            flex={1}
            paddingVertical={8}
            borderRadius={radius.sm}
            alignItems="center"
            backgroundColor={active ? colors.primary : 'transparent'}
            onPress={() => onChange(opt.key)}
          >
            <Text
              fontSize={13}
              fontWeight={active ? '700' : '500'}
              color={active ? '#fff' : colors.textSecondary}
            >
              {opt.icon ? `${opt.icon} ` : ''}{opt.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default SegmentedControl;
