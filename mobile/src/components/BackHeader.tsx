// 带返回按钮的页面头部组件 —— 用于 Stack 功能页面
import React from 'react';
import { Text, YStack, XStack, View } from 'tamagui';
import { colors, radius } from '../theme/tokens';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
  hideBack?: boolean;
}

export function BackHeader({ title, subtitle, onBack, action, hideBack }: BackHeaderProps) {
  return (
    <XStack
      alignItems="center"
      paddingHorizontal={16}
      paddingTop={14}
      paddingBottom={10}
      gap={12}
      borderBottomWidth={1}
      borderBottomColor={colors.border}
      backgroundColor={colors.background}
    >
      {/* 返回按钮（可作为 Tab 根页面时隐藏） */}
      {!hideBack && (
        <View
          padding={10}
          borderRadius={radius.md}
          backgroundColor={colors.surface}
          borderWidth={1}
          borderColor={colors.border}
          onPress={onBack}
          accessibilityRole="button"
        >
          <Text fontSize={18} color={colors.primary}>←</Text>
        </View>
      )}

      <YStack flex={1}>
        <Text fontSize={20} fontWeight="bold" color={colors.text}>{title}</Text>
        {subtitle && <Text fontSize={12} color={colors.textMuted}>{subtitle}</Text>}
      </YStack>

      {action}
    </XStack>
  );
}

export default BackHeader;
