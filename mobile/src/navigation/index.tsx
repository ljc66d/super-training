// 底部Tab导航 —— 每个Tab内部嵌套独立Stack，功能页面拥有正确回退
import React, { useCallback, useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'tamagui';

import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { ExerciseLibraryScreen } from '../screens/ExerciseLibraryScreen';
import { ExerciseHistoryScreen } from '../screens/ExerciseHistoryScreen';
import { DietScreen } from '../screens/DietScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SessionListScreen } from '../screens/SessionListScreen';
import { DietCalendarScreen } from '../screens/DietCalendarScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { FormCheckScreen } from '../screens/FormCheckScreen';
import { AchievementScreen } from '../screens/AchievementScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { ThemeSettingsScreen } from '../screens/ThemeSettingsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { RecommendScreen } from '../screens/RecommendScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { MySharesScreen } from '../screens/MySharesScreen';
import { MyCustomSportsScreen } from '../screens/MyCustomSportsScreen';
import { MyProfileScreen } from '../screens/MyProfileScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab 图标（用标签首字作简洁标识，去 emoji）
const icons: Record<string, { label: string }> = {
  Home: { label: '首页' },
  Training: { label: '训练' },
  Diet: { label: '饮食' },
  Community: { label: '社区' },
  Messages: { label: '私信' },
  Profile: { label: '我的' },
};

function TabIcon({ routeName, focused }: { routeName: string; focused: boolean }) {
  const cfg = icons[routeName];
  return (
    <View alignItems="center" justifyContent="center" paddingTop={6}>
      <Text
        fontSize={15}
        fontWeight="700"
        style={{ color: focused ? colors.primary : colors.textMuted, opacity: focused ? 1 : 0.7 }}
      >
        {cfg?.label?.[0]}
      </Text>
    </View>
  );
}

// 首页 Tab 嵌套 Stack：首页 + 功能页面（可从首页回退到首页）
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SessionList" component={SessionListScreen} options={{ title: '训练记录' }} />
      <Stack.Screen name="MyCustomSports" component={MyCustomSportsScreen} options={{ title: '我的运动' }} />
      <Stack.Screen name="DietCalendar" component={DietCalendarScreen} options={{ title: '饮食记录' }} />
      <Stack.Screen name="Plan" component={PlanScreen} options={{ title: '训练计划' }} />
      <Stack.Screen name="FormCheck" component={FormCheckScreen} options={{ title: '经典力量动作纠错' }} />
      <Stack.Screen name="Achievement" component={AchievementScreen} options={{ title: '我的成就' }} />
      <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '数据复盘' }} />
      <Stack.Screen name="Recommend" component={RecommendScreen} options={{ title: '推荐' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: '私信' }} />
      <Stack.Screen name="Social" component={SocialScreen} options={{ title: '社交' }} />
      <Stack.Screen name="MyShares" component={MySharesScreen} options={{ title: '社区分享' }} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: '我的资料' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'TA 的主页' }} />
    </Stack.Navigator>
  );

}

// “我的” Tab 嵌套 Stack：个人中心 + 功能页面（可从功能页回退到“我的”）
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SessionList" component={SessionListScreen} options={{ title: '训练记录' }} />
      <Stack.Screen name="MyCustomSports" component={MyCustomSportsScreen} options={{ title: '我的运动' }} />
      <Stack.Screen name="DietCalendar" component={DietCalendarScreen} options={{ title: '饮食记录' }} />
      <Stack.Screen name="Plan" component={PlanScreen} options={{ title: '训练计划' }} />
      <Stack.Screen name="FormCheck" component={FormCheckScreen} options={{ title: '经典力量动作纠错' }} />
      <Stack.Screen name="Achievement" component={AchievementScreen} options={{ title: '我的成就' }} />
      <Stack.Screen name="Coach" component={CoachScreen} options={{ title: '教练端' }} />
      <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} options={{ title: '配色主题' }} />
      <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '数据复盘' }} />
      <Stack.Screen name="Recommend" component={RecommendScreen} options={{ title: '推荐' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: '私信' }} />
      <Stack.Screen name="Social" component={SocialScreen} options={{ title: '社交' }} />
      <Stack.Screen name="MyShares" component={MySharesScreen} options={{ title: '社区分享' }} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: '我的资料' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'TA 的主页' }} />
    </Stack.Navigator>
  );

}

function TrainingTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Training" component={TrainingScreen} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: '动作库' }} />
      <Stack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} options={{ title: '历史成绩' }} />
    </Stack.Navigator>
  );
}

function DietTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Diet" component={DietScreen} />
    </Stack.Navigator>
  );
}

function CommunityTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: '私信' }} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: '我的资料' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'TA 的主页' }} />
    </Stack.Navigator>
  );
}

// 私信 Tab：会话列表 + 聊天窗口（MessagesScreen 内部自管理聊天状态）
function MessagesTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: '私信' }} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: '我的资料' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'TA 的主页' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  // 订阅主题：切换深/浅色或配色时重渲染，让底部 Tab 栏同步变色
  const { darkMode, themeKey } = useTheme();
  void darkMode;
  void themeKey;
  // 私信未读数轮询（15s + 切到前台时刷新），用于底部 Tab 红点
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(async () => {
    try {
      const d = await api.getUnreadCount();
      setUnread(d?.unread_count ?? 0);
    } catch { /* 未登录/网络异常时忽略 */ }
  }, []);
  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 15000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
        tabBarLabel: icons[route.name]?.label || route.name,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // 私信未读红点：数字徽标（>99 显示 99+）
        tabBarBadge: route.name === 'Messages' && unread > 0
          ? (unread > 99 ? '99+' : unread)
          : undefined,
        tabBarBadgeStyle: {
          backgroundColor: '#EF4444',
          color: '#fff',
          fontSize: 10,
          minWidth: unread > 9 ? 20 : 16,
          height: unread > 9 ? 16 : 16,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 2,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Training" component={TrainingTab} />
      <Tab.Screen name="Diet" component={DietTab} />
      <Tab.Screen name="Community" component={CommunityTab} />
      <Tab.Screen name="Messages" component={MessagesTab} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
