// 个人中心页面 —— 用户信息/能量需求/功能入口/登出
import React, { useEffect, useState } from 'react';
import { Button, Image, Text, YStack, XStack, ScrollView, View, Input, Spinner } from 'tamagui';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { ChipSelect } from '../components/ChipSelect';
import { colors, radius } from '../theme/tokens';
import { TRAINING_GOALS } from '../utils/constants';
import { sanitizeNumber } from '../utils/input';
import { fullUrl } from '../utils/url';

// 活动强度（TDEE 计算依据，标准 PAL 系数）
const ACTIVITY_LEVELS = [
  { key: '1.2', label: '久坐（几乎不运动）' },
  { key: '1.375', label: '轻度（每周运动1-3次）' },
  { key: '1.55', label: '中度（每周运动3-5次）' },
  { key: '1.725', label: '高度（每周运动6-7次）' },
  { key: '1.9', label: '极高（体力劳动/每天训练）' },
];

// 功能入口（按类型分组：训练数据 / 饮食数据 / 社交 / 外部数据 / 其他）
const FEATURE_GROUPS: { title: string; items: { key: string; label: string; desc: string }[] }[] = [
  {
    title: '训练数据',
    items: [
      { key: 'SessionList', label: '训练记录', desc: '每日训练日历' },
      { key: 'MyCustomSports', label: '我的运动', desc: '自定义运动种类' },
      { key: 'Plan', label: '训练计划', desc: '生成/官方/备赛' },
      { key: 'FormCheck', label: '动作纠错', desc: '俯卧撑/深蹲/卧推/硬拉/实力推/引体' },
      { key: 'Stats', label: '数据复盘', desc: '趋势图表与统计' },
    ],
  },
  {
    title: '饮食数据',
    items: [
      { key: 'DietCalendar', label: '饮食记录', desc: '每日饮食日历' },
      { key: 'Recommend', label: '推荐', desc: '相似身材的人吃什么' },
    ],
  },
  {
    title: '社交',
    items: [
      { key: 'Social', label: '社交', desc: '粉丝与朋友列表' },
      { key: 'Messages', label: '私信', desc: '与伙伴私密聊天' },
      { key: 'MyShares', label: '社区分享', desc: '管理我发布的分享' },
    ],
  },
  {
    title: '其他',
    items: [
      { key: 'Achievement', label: '我的成就', desc: '徽章与等级' },
      { key: 'ThemeSettings', label: '配色主题', desc: '自定义页面配色' },
      { key: 'Coach', label: '教练端', desc: '学员管理' },
    ],
  },
];

export function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [energy, setEnergy] = useState<any>(null);

  useEffect(() => {
    api.getEnergyNeeds().then(setEnergy).catch(() => {});
  }, []);

  const navigateTo = (key: string) => { navigation.navigate(key); };

  return (
    <ScrollView backgroundColor={colors.background} contentContainerStyle={{ paddingBottom: 100 }}>
      <ScreenHeader title="超会练" subtitle={`的${user?.nickname || user?.username}，继续加油`} />

      <YStack padding={16} gap={16}>
        {/* 用户信息 + 登出（点用户区域进入个人资料） */}
        <View backgroundColor={colors.surface} borderRadius={radius.lg} padding={16} borderWidth={1} borderColor={colors.border}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack gap={12} alignItems="center" flex={1}
              onPress={() => navigation.navigate('MyProfile')} pressStyle={{ opacity: 0.85 }}>
              <View width={48} height={48} borderRadius={radius.pill} backgroundColor={colors.primary} alignItems="center" justifyContent="center" overflow="hidden">
                {user?.avatar_url ? (
                  <Image src={fullUrl(user.avatar_url)} width="100%" height="100%" resizeMode="cover" />
                ) : (
                  <Text fontSize={22} color="#fff" fontWeight="bold">{user?.nickname?.[0]?.toUpperCase() || 'U'}</Text>
                )}
              </View>
              <YStack gap={2} flex={1}>
                <XStack gap={4} alignItems="center">
                  <Text fontSize={17} fontWeight="bold" color={colors.text}>{user?.nickname || user?.username}</Text>
                  <Text fontSize={11} color={colors.textMuted}>›</Text>
                </XStack>
                <Text fontSize={12} color={colors.textMuted}>ID: {user?.uid || '—'} · 点击编辑资料</Text>
              </YStack>
            </XStack>
            <Button size="$2" variant="outlined" theme="red" onPress={logout}>
              <Text fontSize={12} color={colors.danger}>退出</Text>
            </Button>
          </XStack>
        </View>

        {/* 能量需求 */}
        <Card title="我的能量需求" accent="primary">
          {energy ? (
            <>
              <XStack gap={8} flexWrap="wrap">
                <StatCard label="BMR" value={energy.bmr ?? '—'} color={colors.primary} />
                <StatCard label="TDEE" value={energy.tdee ?? '—'} color={colors.accent} />
                <StatCard label="每日目标" value={energy.target_calories ?? '—'} icon="" color={colors.warning} flex={2} />
              </XStack>
              <XStack gap={8} marginTop={8} flexWrap="wrap">
                <Badge text={`蛋白 ${energy.target_protein ?? '—'}g`} tone="primary" />
                <Badge text={`碳水 ${energy.target_carbs ?? '—'}g`} tone="success" />
                <Badge text={`脂肪 ${energy.target_fat ?? '—'}g`} tone="warning" />
              </XStack>
            </>
          ) : (
            <Text fontSize={13} color={colors.textMuted}>完善身高/体重/生日后计算能量需求</Text>
          )}
        </Card>

        {/* 功能入口（按类型分组） */}
        <Text fontSize={16} fontWeight="bold" color={colors.text}>功能中心</Text>
        {FEATURE_GROUPS.map((g) => (
          <View key={g.title}>
            <Text fontSize={13} fontWeight="700" color={colors.textSecondary} marginBottom={8}>{g.title}</Text>
            <XStack flexWrap="wrap" gap={10}>
              {g.items.map((f) => (
                <View key={f.key} flexBasis="47%" flexGrow={1} backgroundColor={colors.surface} borderRadius={radius.md} padding={14} borderWidth={1} borderColor={colors.border} onPress={() => navigateTo(f.key)}>
                  <Text fontSize={15} fontWeight="600" color={colors.text}>{f.label}</Text>
                  <Text fontSize={11} color={colors.textMuted} marginTop={2}>{f.desc}</Text>
                </View>
              ))}
            </XStack>
          </View>
        ))}
      </YStack>
    </ScrollView>
  );
}

export default ProfileScreen;
