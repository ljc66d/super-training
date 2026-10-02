// 动作历史成绩页面 —— 个人纪录(PR) + 历史记录 + 重量趋势
import React, { useEffect, useState } from 'react';
import { Text, YStack, XStack, View, ScrollView, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { colors, radius } from '../theme/tokens';

type HistoryItem = {
  date: string;
  session_id: string;
  sets: number;
  reps: number;
  weight_kg: number;
  volume_kg: number;
  est_1rm: number | null;
};

type Pr = {
  max_weight_kg: number;
  max_weight_date: string;
  max_est_1rm: number | null;
  max_est_1rm_date: string;
  max_volume_kg: number;
  max_volume_date: string;
  total_entries: number;
  last_date: string;
};

export function ExerciseHistoryScreen({ navigation, route }: any) {
  const exerciseName = route?.params?.name || '';
  const [data, setData] = useState<{ history: HistoryItem[]; pr: Pr | null; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exerciseName) { setLoading(false); return; }
    api.getExerciseHistory(exerciseName)
      .then((d: any) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [exerciseName]);

  const weights = (data?.history || []).map((h) => h.weight_kg).reverse();
  const dates = (data?.history || []).map((h) => h.date).reverse();

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="历史成绩" subtitle={exerciseName} onBack={() => navigation?.goBack()} />
      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>
      ) : !data || data.history.length === 0 ? (
        <EmptyState icon="" title="暂无该动作记录" description="完成训练并记录该动作后，这里将展示成绩趋势与个人纪录" />
      ) : (
        <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <YStack gap={16}>
            {/* 个人纪录 */}
            <Card title="个人纪录 PR" accent="primary">
              <XStack gap={8} flexWrap="wrap">
                <StatCard label="最大重量" value={data.pr?.max_weight_kg ?? 0} unit="kg" icon="" color={colors.primary} />
                <StatCard label="估算1RM" value={data.pr?.max_est_1rm ?? 0} unit="kg" icon="" color={colors.warning} />
                <StatCard label="最大容量" value={data.pr ? Math.round(data.pr.max_volume_kg) : 0} unit="kg" color={colors.success} />
                <StatCard label="训练次数" value={data.pr?.total_entries ?? 0} icon="" color={colors.accent} />
              </XStack>
              {data.pr && (
                <Text fontSize={11} color={colors.textMuted} marginTop={8}>
                  最大重量纪录 {data.pr.max_weight_kg}kg（{data.pr.max_weight_date}）· 最近训练 {data.pr.last_date}
                </Text>
              )}
            </Card>

            {/* 重量趋势 */}
            <Card title="重量趋势" accent="warning">
              {weights.length >= 2 ? (
                <TrendLineChart data={weights} labels={dates} color={colors.primary}
                                formatValue={(v) => `${v}kg`} fromZero={false} />
              ) : (
                <Text fontSize={12} color={colors.textMuted} textAlign="center" paddingVertical={24}>
                  至少 2 次记录后展示趋势图
                </Text>
              )}
            </Card>

            {/* 历史记录 */}
            <Card title={`历史记录（${data.total}次）`} accent="success">
              <YStack gap={10}>
                {data.history.map((h, i) => (
                  <View key={i} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12}>
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={14} fontWeight="bold" color={colors.text}>{h.date}</Text>
                      <Text fontSize={12} color={colors.textMuted}>{h.sets}组 × {h.reps}次</Text>
                    </XStack>
                    <XStack gap={10} marginTop={6}>
                      <Badge text={`${h.weight_kg}kg`} tone="primary" />
                      <Badge text={`容量 ${Math.round(h.volume_kg)}kg`} tone="neutral" />
                      {h.est_1rm ? <Badge text={`1RM≈${h.est_1rm}kg`} tone="warning" /> : null}
                    </XStack>
                  </View>
                ))}
              </YStack>
            </Card>
          </YStack>
        </ScrollView>
      )}
    </YStack>
  );
}

function Badge({ text, tone }: { text: string; tone: 'primary' | 'warning' | 'neutral' }) {
  const bg = tone === 'primary' ? 'rgba(14,165,233,0.15)' : tone === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)';
  const fg = tone === 'primary' ? colors.primary : tone === 'warning' ? colors.warning : colors.textMuted;
  return (
    <View backgroundColor={bg} borderRadius={radius.pill} paddingHorizontal={8} paddingVertical={3}>
      <Text fontSize={11} color={fg} fontWeight="600">{text}</Text>
    </View>
  );
}

export default ExerciseHistoryScreen;
