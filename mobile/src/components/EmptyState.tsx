// 空状态组件 —— 无数据时的友好提示
import React from 'react';
import { Text, YStack } from 'tamagui';
import { colors } from '../theme/tokens';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <YStack alignItems="center" justifyContent="center" padding={32} gap={8}>
      {icon ? <Text fontSize={32} color={colors.textMuted}>{icon}</Text> : null}
      <Text fontSize={16} fontWeight="600" color={colors.text}>{title}</Text>
      {description && <Text fontSize={13} color={colors.textMuted} textAlign="center">{description}</Text>}
      {action && <YStack marginTop={12}>{action}</YStack>}
    </YStack>
  );
}

export default EmptyState;
