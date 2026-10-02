// 通用卡片组件 —— 统一卡片样式（背景/圆角/阴影/内边距）
import React from 'react';
import { Text, View, YStack } from 'tamagui';
import { radius, shadows, colors } from '../theme/tokens';

interface CardProps extends React.ComponentProps<typeof View> {
  /** 卡片标题 */
  title?: string;
  /** 标题右侧操作 */
  action?: React.ReactNode;
  /** 强调色左边框 */
  accent?: keyof typeof colors;
  children: React.ReactNode;
}

export function Card({ title, action, accent, children, ...rest }: CardProps) {
  return (
    <View
      backgroundColor={colors.surface}
      borderRadius={radius.lg}
      padding={16}
      borderWidth={1}
      borderColor={colors.border}
      style={shadows.card}
      {...rest}
    >
      {accent && (
        <View
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={4}
          borderTopLeftRadius={radius.lg}
          borderBottomLeftRadius={radius.lg}
          backgroundColor={colors[accent]}
        />
      )}
      {(title || action) && (
        <YStack flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={12}>
          {title && <Text fontSize={17} fontWeight="bold" color={colors.text}>{title}</Text>}
          {action}
        </YStack>
      )}
      {children}
    </View>
  );
}

export default Card;
