// 训练计划页面 —— AI生成/官方预设/专项备赛/我的计划
import React, { useEffect, useState } from 'react';
import { Button, Text, YStack, XStack, ScrollView, View, Input, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { sanitizeInteger } from '../utils/input';
import { colors, radius } from '../theme/tokens';

type TabKey = 'ai' | 'official' | 'specialty' | 'mine';

const TABS = [
  { key: 'ai' as TabKey, label: '生成' },
  { key: 'official' as TabKey, label: '官方' },
  { key: 'specialty' as TabKey, label: '备赛' },
  { key: 'mine' as TabKey, label: '我的' },
];

const GOALS = [
  { key: 'muscle_gain', label: '增肌' },
  { key: 'fat_loss', label: '减脂' },
  { key: 'strength', label: '力量' },
  { key: 'endurance', label: '耐力' },
  { key: 'maintain', label: '保持' },
];

const LEVELS = [
  { key: 'beginner', label: '初级' },
  { key: 'intermediate', label: '中级' },
  { key: 'advanced', label: '高级' },
];

export function PlanScreen({ navigation }: any) {
  const [tab, setTab] = useState<TabKey>('ai');
  const [goal, setGoal] = useState('muscle_gain');
  const [level, setLevel] = useState('beginner');
  const [days, setDays] = useState('3');
  const [generated, setGenerated] = useState<any>(null);
  const [officialPlans, setOfficialPlans] = useState<any[]>([]);
  const [specialtyPlans, setSpecialtyPlans] = useState<any[]>([]);
  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getOfficialPlans().then(setOfficialPlans).catch(() => {});
    api.getSpecialtyPlans().then(setSpecialtyPlans).catch(() => {});
    api.getMyPlans().then(setMyPlans).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const plan = await api.aiGeneratePlan({
        goal, level, days_per_week: parseInt(days),
        equipment: ['barbell', 'dumbbell', 'body_weight'],
      });
      setGenerated(plan);
      const my = await api.getMyPlans();
      setMyPlans(my);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdopt = async (planId: string) => {
    try {
      await api.adoptSpecialtyPlan(planId);
      const my = await api.getMyPlans();
      setMyPlans(my);
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  // 渲染单日训练
  const renderDay = (day: any, key: string) => (
    <View key={key} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} marginBottom={8}>
      <Text fontSize={14} fontWeight="600" color={colors.primary} marginBottom={8}>
        {day.title}
      </Text>
      {day.exercises?.map((ex: any, i: number) => (
        <XStack key={i} justifyContent="space-between" paddingVertical={4}>
          <Text fontSize={13} color={colors.text} flex={1}>{ex.name}</Text>
          <XStack gap={8}>
            <Text fontSize={12} color={colors.textSecondary}>{ex.sets}组×{ex.reps}</Text>
            {ex.rpe && <Text fontSize={12} color={colors.textMuted}>RPE{ex.rpe}</Text>}
          </XStack>
        </XStack>
      ))}
    </View>
  );

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="训练计划" subtitle="AI生成 / 官方 / 专项备赛" onBack={() => navigation.goBack()} />
      <View paddingHorizontal={16}>
        <SegmentedControl options={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>

      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* ===== AI 生成 ===== */}
        {tab === 'ai' && (
          <YStack gap={16}>
            <Card title="AI 个性化计划" accent="primary">
              <YStack gap={12}>
                <YStack gap={6}>
                  <Text fontSize={13} color={colors.textMuted}>训练目标</Text>
                  <XStack gap={8} flexWrap="wrap">
                    {GOALS.map((g) => (
                      <BadgeSelector key={g.key} label={g.label} active={goal === g.key} onPress={() => setGoal(g.key)} />
                    ))}
                  </XStack>
                </YStack>
                <YStack gap={6}>
                  <Text fontSize={13} color={colors.textMuted}>经验水平</Text>
                  <XStack gap={8}>
                    {LEVELS.map((l) => (
                      <BadgeSelector key={l.key} label={l.label} active={level === l.key} onPress={() => setLevel(l.key)} />
                    ))}
                  </XStack>
                </YStack>
                <YStack gap={6}>
                  <Text fontSize={13} color={colors.textMuted}>每周训练天数</Text>
                  <Input
                    value={days}
                    onChangeText={(v) => setDays(sanitizeInteger(v))}
                    keyboardType="numeric"
                    placeholder="1-7"
                    backgroundColor={colors.surfaceLight}
                    borderRadius={radius.md}
                    color={colors.text}
                  />
                </YStack>
                <Button
                  backgroundColor={colors.primary}
                  borderRadius={radius.md}
                  onPress={handleGenerate}
                  disabled={loading}
                  size="$4"
                >
                  {loading ? <Spinner color="white" /> : <Text color="#fff" fontWeight="600">生成我的计划</Text>}
                </Button>
              </YStack>
            </Card>

            {generated && (
              <Card title={generated.title} accent="success" action={<Badge text={generated.split === 'push_pull_leg' ? '推拉腿' : generated.split} tone="primary" />}>
                <Text fontSize={13} color={colors.textMuted} marginBottom={12}>{generated.summary}</Text>
                {generated.daily_plans?.map((d: any, i: number) => renderDay(d, `gen-${i}`))}
                <YStack marginTop={8} gap={6}>
                  <Text fontSize={13} fontWeight="600" color={colors.primary}>训练要点</Text>
                  {generated.guidelines?.map((g: string, i: number) => (
                    <Text key={i} fontSize={12} color={colors.textSecondary}>• {g}</Text>
                  ))}
                </YStack>
              </Card>
            )}
          </YStack>
        )}

        {/* ===== 官方预设 ===== */}
        {tab === 'official' && (
          <YStack gap={12}>
            {officialPlans.length === 0 && <EmptyState title="暂无官方计划" />}
            {officialPlans.map((plan) => (
              <View key={plan.plan_id} backgroundColor={colors.surface} borderRadius={radius.lg} borderWidth={1} borderColor={colors.border} padding={16} onPress={() => setExpanded(expanded === plan.plan_id ? null : plan.plan_id)}>
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1} gap={4}>
                    <Text fontSize={15} fontWeight="600" color={colors.text}>{plan.title}</Text>
                    <Text fontSize={12} color={colors.textMuted}>{plan.description}</Text>
                    <XStack gap={6} marginTop={4}>
                      <Badge text={`${plan.days_per_week}天/周`} tone="primary" />
                      <Badge text={plan.level} tone="neutral" />
                    </XStack>
                  </YStack>
                  <Text fontSize={16} color={colors.textMuted}>{expanded === plan.plan_id ? '▴' : '▾'}</Text>
                </XStack>
                {expanded === plan.plan_id && (
                  <YStack marginTop={12}>
                    {plan.daily_plans?.map((d: any, i: number) => renderDay(d, `off-${plan.plan_id}-${i}`))}
                  </YStack>
                )}
              </View>
            ))}
          </YStack>
        )}

        {/* ===== 专项备赛 ===== */}
        {tab === 'specialty' && (
          <YStack gap={12}>
            {specialtyPlans.map((plan) => (
              <Card key={plan.plan_id} title={plan.title} accent="gold" action={<Badge text={plan.sport} tone="gold" />}>
                <Text fontSize={12} color={colors.textMuted} marginBottom={8}>{plan.description}</Text>
                <XStack gap={6} marginBottom={8}>
                  {plan.phases?.map((p: any, i: number) => (
                    <Badge key={i} text={`${p.phase}`} tone="warning" />
                  ))}
                </XStack>
                <Button
                  size="$3"
                  backgroundColor={colors.gold}
                  onPress={() => handleAdopt(plan.plan_id)}
                >
                  <Text color="#1a1a1a" fontWeight="600">领用此计划</Text>
                </Button>
              </Card>
            ))}
          </YStack>
        )}

        {/* ===== 我的计划 ===== */}
        {tab === 'mine' && (
          <YStack gap={12}>
            {myPlans.length === 0 && <EmptyState title="还没有计划" description="去AI生成或领用官方计划吧" />}
            {myPlans.map((plan: any) => (
              <View key={plan.plan_id} backgroundColor={colors.surface} borderRadius={radius.lg} borderWidth={1} borderColor={colors.border} padding={16} onPress={() => setExpanded(expanded === plan.plan_id ? null : plan.plan_id)}>
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1} gap={4}>
                    <Text fontSize={15} fontWeight="600" color={colors.text}>{plan.title}</Text>
                    <XStack gap={6}>
                      {plan.is_ai_generated && <Badge text="AI生成" tone="primary" />}
                      {plan.plan_json?.is_custom && <Badge text="自定义" tone="success" />}
                      <Badge text={`${plan.days_per_week}天`} tone="neutral" />
                    </XStack>
                  </YStack>
                  <Text fontSize={16} color={colors.textMuted}>{expanded === plan.plan_id ? '▴' : '▾'}</Text>
                </XStack>
                {expanded === plan.plan_id && plan.plan_json?.daily_plans && (
                  <YStack marginTop={12}>
                    {plan.plan_json.daily_plans.map((d: any, i: number) => renderDay(d, `my-${plan.plan_id}-${i}`))}
                  </YStack>
                )}
              </View>
            ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}

// 标签选择器（内联组件）
function BadgeSelector({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View
      paddingHorizontal={14}
      paddingVertical={8}
      borderRadius={radius.pill}
      backgroundColor={active ? colors.primary : colors.surfaceLight}
      onPress={onPress}
    >
      <Text fontSize={13} fontWeight={active ? '600' : '500'} color={active ? '#fff' : colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default PlanScreen;
