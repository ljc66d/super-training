// 「超会练」应用入口
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, View, Spinner, YStack, Text } from 'tamagui';

import tamaguiConfig from './tamagui.config';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TrainingProvider } from './src/context/TrainingContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { RestTimerFloating } from './src/components/RestTimerFloating';
import { WodTimerFloating } from './src/components/WodTimerFloating';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme/tokens';

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" gap={8} backgroundColor={colors.background}>
        <Spinner size="large" color={colors.primary} />
        <Text color={colors.textMuted}>加载中...</Text>
      </YStack>
    );
  }

  return user ? <RootNavigator /> : <LoginScreen />;
}

// 应用外壳：订阅主题，切换深/浅色时重渲染，让背景与状态栏同步变色
function AppShell() {
  const { darkMode } = useTheme();
  void darkMode;
  return (
    <View flex={1} backgroundColor={colors.background}>
      {/* 禁用 linking（URL同步）：功能页面已放入各Tab内部Stack，通过 navigation prop
          编程式导航即可正确回退；避免Web端URL解析到错误Tab。 */}
      <NavigationContainer
        ref={navigationRef}
        linking={{ enabled: false, prefixes: ['http://localhost:8091', 'https://super-training.app'] }}
      >
        <AuthProvider>
          <Root />
        </AuthProvider>
      </NavigationContainer>
      {/* 全局浮窗：跨页面显示，可拖动/缩放 */}
      <RestTimerFloating />
      <WodTimerFloating />
      <StatusBar style={darkMode ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TamaguiProvider config={tamaguiConfig}>
        <TrainingProvider>
          <AppShell />
        </TrainingProvider>
      </TamaguiProvider>
    </ThemeProvider>
  );
}
