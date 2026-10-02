// 成就页面 —— 等级/徽章/进度
import React, { useEffect, useState } from 'react';
import { Text, YStack, XStack, ScrollView, View, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius } from '../theme/tokens';

const badgeIcon: Record<string, string> = {
  bronze: '', silver: '', gold: '', platinum: '',
};

export function AchievementScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.getAchievements();
      setData(d);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const d = await api.refreshAchievements();
      setData(d);
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  if (loading) {
    return <YStack flex={1} backgroundColor={colors.background} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>;
  }

  const levelNames = ['', '初级达人', '进阶选手', '训练精英', '健身大师', '巅峰王者'];

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="成就系统" subtitle="记录你的每一份坚持" onBack={() => navigation.goBack()} action={
        <View paddingHorizontal={12} paddingVertical={8} borderRadius={radius.pill} backgroundColor={colors.surfaceLight} onPress={handleRefresh}>
          <Text fontSize={12} color={colors.primary} fontWeight="600">刷新</Text>
        </View>
      } />

      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>
          {/* 等级卡片 */}
          <Card accent="gold">
            <XStack alignItems="center" gap={16}>
              <View width={72} height={72} borderRadius={radius.xl} backgroundColor={colors.surfaceLight} alignItems="center" justifyContent="center">
                <Text fontSize={36}></Text>
              </View>
              <YStack flex={1} gap={4}>
                <Text fontSize={18} fontWeight="bold" color={colors.text}>Lv.{data?.level}</Text>
                <Text fontSize={13} color={colors.primary}>{levelNames[data?.level] || '初级达人'}</Text>
                <Text fontSize={12} color={colors.textMuted}>已解锁 {data?.unlocked_count} 个成就</Text>
              </YStack>
            </XStack>
            <XStack justifyContent="space-around" marginTop={16}>
              {['bronze', 'silver', 'gold', 'platinum'].map((t) => (
                <YStack key={t} alignItems="center" gap={4}>
                  <Text fontSize={24}>{badgeIcon[t]}</Text>
                  <Text fontSize={12} fontWeight="600" color={colors[data?.badge_counts?.[t] > 0 ? t : 'textMuted']}>
                    {data?.badge_counts?.[t] || 0}
                  </Text>
                </YStack>
              ))}
            </XStack>
          </Card>

          {/* 全部成就 */}
          <Text fontSize={16} fontWeight="bold" color={colors.text} marginTop={4}>我的成就</Text>
          {data?.achievements?.map((a: any) => (
            <View
              key={a.code}
              backgroundColor={a.unlocked ? colors.surface : colors.surfaceLight}
              borderRadius={radius.lg}
              borderWidth={1}
              borderColor={a.unlocked ? colors.gold : colors.border}
              padding={14}
              opacity={a.unlocked ? 1 : 0.55}
            >
              <XStack gap={12} alignItems="center">
                <Text fontSize={28}>{a.unlocked ? badgeIcon[a.badge_type] : ''}</Text>
                <YStack flex={1} gap={4}>
                  <Text fontSize={14} fontWeight="600" color={a.unlocked ? colors.text : colors.textSecondary}>
                    {a.title}
                  </Text>
                  <Text fontSize={12} color={colors.textMuted}>{a.description}</Text>
                  <ProgressBar progress={a.progress} target={a.target} color={colors[a.badge_type] || colors.primary} />
                </YStack>
              </XStack>
            </View>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export default AchievementScreen;
