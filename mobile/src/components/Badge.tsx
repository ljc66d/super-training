// 徽章/标签组件 —— 展示状态、严重程度、成就等级
import React from 'react';
import { Text, View } from 'tamagui';
import { colors, radius } from '../theme/tokens';

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'bronze' | 'silver' | 'gold' | 'platinum';

const toneMap: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: '#0EA5E920', fg: colors.primary },
  success: { bg: '#22C55E20', fg: colors.success },
  warning: { bg: '#F59E0B20', fg: colors.warning },
  danger: { bg: '#EF444420', fg: colors.danger },
  neutral: { bg: colors.surfaceLight, fg: colors.textSecondary },
  bronze: { bg: '#CD7F3220', fg: colors.bronze },
  silver: { bg: '#C0C0C020', fg: colors.silver },
  gold: { bg: '#FFD70020', fg: colors.gold },
  platinum: { bg: '#E5E4E220', fg: colors.platinum },
};

interface BadgeProps {
  text: string;
  tone?: BadgeTone;
}

export function Badge({ text, tone = 'neutral' }: BadgeProps) {
  const t = toneMap[tone];
  return (
    <View
      backgroundColor={t.bg}
      borderRadius={radius.sm}
      paddingHorizontal={8}
      paddingVertical={3}
    >
      <Text fontSize={11} fontWeight="600" color={t.fg}>{text}</Text>
    </View>
  );
}

export default Badge;
