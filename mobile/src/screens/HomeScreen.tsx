// 首页 —— 今日热量闭环/快捷入口/训练与饮食
import React, { useEffect, useState } from 'react';
import { Button, Image, Text, YStack, XStack, View, Spinner, Input, ScrollView } from 'tamagui';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { colors, radius } from '../theme/tokens';
import { onDataEvent, DATA_EVENTS } from '../utils/events';
import { fullUrl } from '../utils/url';

export function HomeScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restHr, setRestHr] = useState('');
  const [savingHr, setSavingHr] = useState(false);

  useEffect(() => {
    if (user?.resting_heart_rate != null) {
      setRestHr(String(user.resting_heart_rate));
    }
  }, [user?.resting_heart_rate]);

  const saveRestHr = async () => {
    const v = parseFloat(restHr);
    if (!v || v <= 0) return;
    setSavingHr(true);
    try {
      // 1) 写入身体数据历史（用于复盘：体重/体脂/静息心率 趋势）
      const today = new Date().toISOString().slice(0, 10);
      await api.createBodyMetric({
        record_date: today,
        resting_heart_rate: v,
        recorded_at: new Date().toISOString(),
      });
      // 2) 同步用户最新静息心率（供热量计算即时使用）
      await updateProfile({ resting_heart_rate: v });
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setSavingHr(false);
    }
  };

  const loadToday = () => {
    api.getToday().then(setToday).catch(() => {}).finally(() => setLoading(false));
  };

  // 首次加载 + 页面获得焦点 + 全局数据事件时刷新（饮食/训练保存后实时更新）
  useEffect(() => {
    loadToday();
    const unsubFocus = navigation?.addListener?.('focus', loadToday);
    const unsubDiet = onDataEvent(DATA_EVENTS.DIET_UPDATED, loadToday);
    const unsubTrain = onDataEvent(DATA_EVENTS.TRAINING_UPDATED, loadToday);
    return () => {
      unsubFocus?.();
      unsubDiet();
      unsubTrain();
    };
  }, [navigation]);

  const navigateTo = (key: string) => { navigation.navigate(key); };

  const balance = today?.calorie_balance ?? 0;

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      {/* 头部 */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={20} paddingTop={20} paddingBottom={8}>
        <XStack alignItems="baseline" flexWrap="wrap">
          <Text fontSize={14} color={colors.textMuted}>你 </Text>
          <Text fontSize={30} fontWeight="bold" color={colors.text}>超会练</Text>
          <Text fontSize={14} color={colors.textMuted}>，{user?.nickname || '健身达人'}。</Text>
        </XStack>
        <View width={44} height={44} borderRadius={radius.pill} backgroundColor={colors.primary} alignItems="center" justifyContent="center" overflow="hidden">
          {user?.avatar_url ? (
            <Image src={fullUrl(user.avatar_url)} width="100%" height="100%" resizeMode="cover" />
          ) : (
            <Text fontSize={20} color="#fff" fontWeight="bold">{user?.nickname?.[0]?.toUpperCase() || 'U'}</Text>
          )}
        </View>
      </XStack>

        <ScrollView flex={1} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          {/* 热量闭环 */}
          <Card title="今日热量闭环" accent="primary" action={loading ? <Spinner size="small" /> : <Badge text="实时" tone="success" />}>
          <XStack gap={8} flexWrap="wrap">
            <StatCard label="总消耗" value={today ? Math.round(today.today_tdee ?? 0) : '—'} color={colors.accent} />
            <StatCard label="饮食摄入" value={today ? Math.round(today.food_calories_intake ?? 0) : '—'} color={colors.primary} />
            <StatCard
              label="热量差"
              value={today?.calorie_balance != null ? Math.round(today.calorie_balance) : '—'}
              color={balance > 0 ? colors.warning : colors.success}
              flex={2}
            />
          </XStack>
          {today?.target_intake_calories && (
            <Text fontSize={12} color={colors.textMuted} marginTop={8}>
              今日目标摄入 {Math.round(today.target_intake_calories)} kcal · 训练消耗 {Math.round(today.training_calories_burned ?? 0)} kcal
            </Text>
          )}
        </Card>

        {/* 快捷操作 */}
        <XStack gap={10}>
          <View flex={1} backgroundColor={colors.primary} borderRadius={radius.md} padding={16} onPress={() => navigation.navigate('Training')}>
            <Text fontSize={16} fontWeight="bold" color="#fff">开始训练</Text>
            <Text fontSize={11} color="#fff" opacity={0.8} marginTop={2}>记录训练</Text>
          </View>
          <View flex={1} backgroundColor={colors.surface} borderRadius={radius.md} padding={16} borderWidth={1} borderColor={colors.border} onPress={() => navigation.navigate('Diet')}>
            <Text fontSize={16} fontWeight="bold" color={colors.text}>记录饮食</Text>
            <Text fontSize={11} color={colors.textMuted} marginTop={2}>营养计算</Text>
          </View>
        </XStack>

        {/* 功能快捷入口 */}
        <Text fontSize={16} fontWeight="bold" color={colors.text} marginTop={4}>快捷功能</Text>
        <XStack gap={10} flexWrap="wrap">
          <QuickItem label="训练记录" onPress={() => navigateTo('SessionList')} />
          <QuickItem label="饮食记录" onPress={() => navigateTo('DietCalendar')} />
          <QuickItem label="训练计划" onPress={() => navigateTo('Plan')} />
          <QuickItem label="动作纠错" onPress={() => navigateTo('FormCheck')} />
          <QuickItem label="数据复盘" onPress={() => navigateTo('Stats')} />
          <QuickItem label="推荐" onPress={() => navigateTo('Recommend')} />
          <QuickItem label="成就" onPress={() => navigateTo('Achievement')} />
        </XStack>

        {/* 今日概览 */}
        <Card title="今日状态">
          <XStack gap={8} flexWrap="wrap">
            <StatCard label="训练" value={today?.session_count ?? 0} color={colors.primary} />
            <StatCard label="摄入蛋白" value={today ? Math.round(today.intake?.protein ?? 0) : 0} unit="g" color={colors.success} />
            <StatCard label="摄入碳水" value={today ? Math.round(today.intake?.carbs ?? 0) : 0} unit="g" color={colors.warning} />
            <StatCard label="摄入脂肪" value={today ? Math.round(today.intake?.fat ?? 0) : 0} unit="g" color={colors.danger} />
          </XStack>

          {/* 每日静息心率（供热量计算用） */}
          <XStack gap={8} marginTop={10} alignItems="center">
            <Text fontSize={12} color={colors.textSecondary}>每日静息心率</Text>
            <Input
              flex={1}
              keyboardType="numeric"
              value={restHr}
              onChangeText={setRestHr}
              placeholder="如 60"
              backgroundColor={colors.surface}
              borderRadius={radius.md}
              color={colors.text}
              height={36}
            />
            <Text fontSize={12} color={colors.textMuted}>bpm</Text>
            <Button
              backgroundColor={colors.primary}
              borderRadius={radius.md}
              height={36}
              paddingHorizontal={14}
              onPress={saveRestHr}
              disabled={savingHr}
            >
              {savingHr ? <Spinner size="small" color="white" /> : <Text color="#fff" fontWeight="600" fontSize={12}>保存</Text>}
            </Button>
          </XStack>
        </Card>
      </ScrollView>
    </YStack>
  );
}

function QuickItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View flexBasis="22%" flexGrow={1} backgroundColor={colors.surface} borderRadius={radius.md} paddingVertical={12} paddingHorizontal={8} alignItems="center" borderWidth={1} borderColor={colors.border} onPress={onPress}>
      <Text fontSize={13} fontWeight="600" color={colors.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default HomeScreen;
