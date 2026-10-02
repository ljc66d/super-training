// 根导航 —— 仅承载底部Tab导航（功能页面已移入各Tab内部Stack，实现正确回退）
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, XStack, Text } from 'tamagui';

import AppNavigator from './index';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();

// 统一的返回按钮 + 标题 header
function HeaderBack({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View
      backgroundColor={colors.background}
      paddingHorizontal={16}
      paddingVertical={12}
      borderBottomWidth={1}
      borderBottomColor={colors.border}
    >
      <XStack alignItems="center" gap={12}>
        <View
          padding={8}
          borderRadius={8}
          backgroundColor={colors.surface}
          onPress={onBack}
          accessibilityRole="button"
        >
          <Text fontSize={20} color={colors.primary}>←</Text>
        </View>
        <Text fontSize={18} fontWeight="bold" color={colors.text}>{title}</Text>
      </XStack>
    </View>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={AppNavigator} />
    </Stack.Navigator>
  );
}

// 供功能页面使用的统一返回按钮（页面内通过 navigation.goBack() 触发）
export { HeaderBack };
