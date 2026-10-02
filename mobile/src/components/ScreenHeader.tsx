// 页面顶部标题组件 —— 标题+副标题+右侧操作
import React from 'react';
import { Text, YStack, XStack, View } from 'tamagui';
import { colors, spacing } from '../theme/tokens';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal={spacing.md}
      paddingTop={spacing.md}
      paddingBottom={spacing.sm}
    >
      <YStack flex={1}>
        <Text fontSize={28} fontWeight="bold" color={colors.text}>{title}</Text>
        {subtitle && <Text fontSize={13} color={colors.textMuted} marginTop={2}>{subtitle}</Text>}
      </YStack>
      {action}
    </XStack>
  );
}

export default ScreenHeader;
