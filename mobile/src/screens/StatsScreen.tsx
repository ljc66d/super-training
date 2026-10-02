// 数据复盘页面 —— 训练统计 / 穿戴数据 / 训练·饮食·身体 趋势图表
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Text, YStack, XStack, View, ScrollView, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { TrendBarChart } from '../components/charts/TrendBarChart';
import { formatNum } from '../components/charts/format';
import { colors, radius } from '../theme/tokens';

type Trend = {
  days: number;
  dates: string[];
  training: { counts: number[]; durations: number[]; calories: number[]; volumes: number[]; rpe: (number | null)[] };
  diet: { calories: number[]; protein: number[]; carbs: number[]; fat: number[]; target_calories: number | null };
  body: { dates: string[]; weights: (number | null)[]; body_fats: (number | null)[]; resting_heart_rates: (number | null)[] };
};

// 疲劳量化管理（GET /stats/fatigue，0-100 分，分越高越疲劳）
type Fatigue = {
  score: number | null;
  status: string;
  level: string;
  advice: string;
  acwr: number | null;
  acwr_label: string;
  rpe_avg: number | null;
  rpe_label: string;
  hr_shift: number | null;
  hr_label: string;
  cal_balance: number | null;
  diet_label: string;
  recent_train_days: number;
  tips?: string[];
  warning?: string;
};

// level → 颜色（peak/good 绿、mild 橙、fatigued/overtrain 红）
const FATIGUE_COLORS: Record<string, string> = {
  peak: colors.success,
  good: colors.success,
  mild: colors.warning,
  fatigued: colors.danger,
  overtrain: colors.danger,
  insufficient: colors.textMuted,
};

type MetricKey = 'counts' | 'durations' | 'calories' | 'volumes' | 'protein' | 'carbs' | 'fat' | 'weights' | 'body_fats' | 'resting_heart_rates';

const RANGES = [7, 30, 90];

// 训练指标
const TRAIN_METRICS: { key: MetricKey; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'counts', label: '训练次数', color: colors.primary, fmt: (v) => `${Math.round(v)}` },
  { key: 'durations', label: '训练时长', color: colors.accent, fmt: (v) => `${Math.round(v)}min` },
  { key: 'calories', label: '热量消耗', color: colors.warning, fmt: (v) => `${Math.round(v)}` },
  { key: 'volumes', label: '训练容量', color: colors.success, fmt: (v) => formatNum(v) },
];

// 饮食指标（热量用柱状图+目标线，其余折线）
const DIET_METRICS: { key: MetricKey; label: string; color: string; bar: boolean }[] = [
  { key: 'calories', label: '摄入热量', color: colors.warning, bar: true },
  { key: 'protein', label: '蛋白质', color: colors.primary, bar: false },
  { key: 'carbs', label: '碳水', color: colors.accent, bar: false },
  { key: 'fat', label: '脂肪', color: colors.danger, bar: false },
];

// 身体指标（稀疏数据，不从0起）
const BODY_METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: 'weights', label: '体重', color: colors.primary, unit: 'kg' },
  { key: 'body_fats', label: '体脂率', color: colors.warning, unit: '%' },
  { key: 'resting_heart_rates', label: '静息心率', color: colors.danger, unit: 'bpm' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Button
      {...({ type: 'button' } as any)}
      size="$2"
      paddingHorizontal={10}
      paddingVertical={5}
      borderRadius={radius.pill}
      backgroundColor={active ? colors.primary : colors.surfaceLight}
      borderWidth={1}
      borderColor={active ? colors.primary : colors.border}
      onPress={onPress}
      pressStyle={{ opacity: 0.8 }}
    >
      <Text fontSize={12} fontWeight={active ? 'bold' : 'normal'} color={active ? '#fff' : colors.textSecondary}>
        {label}
      </Text>
    </Button>
  );
}

// 疲劳量化管理卡：大数字评分 + 主建议 + 分条建议 + 高风险警示（与小程序数据复盘一致）
function FatigueCard({ fatigue }: { fatigue: Fatigue }) {
  const levelColor = FATIGUE_COLORS[fatigue.level] || colors.textMuted;
  return (
    <Card title="疲劳管理评估" accent="warning">
      {fatigue.level === 'insufficient' || fatigue.score == null ? (
        <Text fontSize={13} color={colors.textMuted} lineHeight={20}>
          {fatigue.advice || '完成几次训练记录和身体数据后，就能生成更可靠的疲劳评估'}
        </Text>
      ) : (
        <YStack gap={10}>
          <XStack gap={14} alignItems="center">
            <XStack alignItems="flex-end" gap={2}>
              <Text fontSize={44} fontWeight="bold" color={levelColor} fontVariant={['tabular-nums']}>
                {fatigue.score}
              </Text>
              <Text fontSize={13} color={colors.textMuted} marginBottom={8}>/100</Text>
            </XStack>
            <YStack gap={4} flex={1}>
              <Text fontSize={16} fontWeight="700" color={levelColor}>{fatigue.status}</Text>
              <Text fontSize={12} color={colors.textSecondary} lineHeight={17}>{fatigue.advice}</Text>
            </YStack>
          </XStack>

          <XStack gap={8} flexWrap="wrap">
            <Badge text={`训练负荷：${fatigue.acwr_label}`} tone="neutral" />
            <Badge text={`静息心率：${fatigue.hr_label}`} tone="neutral" />
            <Badge text={`营养恢复：${fatigue.diet_label}`} tone="neutral" />
          </XStack>

          {fatigue.tips && fatigue.tips.length > 0 && (
            <YStack gap={6}>
              {fatigue.tips.map((tip, i) => (
                <XStack key={i} gap={8} alignItems="flex-start">
                  <View width={5} height={5} borderRadius={3} backgroundColor={colors.primary} marginTop={7} />
                  <Text flex={1} fontSize={12} color={colors.textSecondary} lineHeight={18}>{tip}</Text>
                </XStack>
              ))}
            </YStack>
          )}

          {fatigue.warning && (
            <View backgroundColor="rgba(229,72,77,0.10)" borderRadius={radius.sm} padding={10} borderWidth={1} borderColor="rgba(229,72,77,0.35)">
              <Text fontSize={12} color={colors.danger} lineHeight={18}>{fatigue.warning}</Text>
            </View>
          )}
        </YStack>
      )}
    </Card>
  );
}

// 将稀疏点数据铺到连续日期轴上
function spreadPoints(dates: string[], pointDates: string[], values: (number | null)[]): (number | null)[] {
  const idx: Record<string, number> = {};
  dates.forEach((d, i) => { idx[d] = i; });
  const out: (number | null)[] = new Array(dates.length).fill(null);
  pointDates.forEach((d, i) => {
    if (idx[d] !== undefined && values[i] != null) out[idx[d]] = values[i];
  });
  return out;
}

export function StatsScreen({ navigation }: any) {
  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [fatigue, setFatigue] = useState<Fatigue | null>(null);
  const [days, setDays] = useState(30);
  const [trainKey, setTrainKey] = useState<MetricKey>('calories');
  const [dietKey, setDietKey] = useState<MetricKey>('calories');
  const [bodyKey, setBodyKey] = useState<MetricKey>('weights');
  const [loading, setLoading] = useState(true);

  const load = (d: number) => {
    setLoading(true);
    Promise.all([api.getSessionStats(), api.getStatsTrend(d), api.getFatigue().catch(() => null)])
      .then(([s, t, f]) => { setStats(s); setTrend(t); setFatigue(f || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(days); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const trainMetric = TRAIN_METRICS.find((m) => m.key === trainKey) || TRAIN_METRICS[0];
  const dietMetric = DIET_METRICS.find((m) => m.key === dietKey) || DIET_METRICS[0];
  const bodyMetric = BODY_METRICS.find((m) => m.key === bodyKey) || BODY_METRICS[0];

  const trainData = useMemo(() => (trend ? trend.training[trainKey as 'counts'] : []), [trend, trainKey]);
  const dietData = useMemo(() => (trend ? trend.diet[dietKey as 'calories'] : []), [trend, dietKey]);
  const bodyData = useMemo(() => {
    if (!trend) return [];
    return spreadPoints(trend.dates, trend.body.dates, trend.body[bodyKey as 'weights' | 'body_fats' | 'resting_heart_rates']);
  }, [trend, bodyKey]);

  const dates = trend?.dates || [];
  const trainSum = trainData.reduce<number>((a, b) => a + (b || 0), 0);
  const dietSum = dietData.reduce<number>((a, b) => a + (b || 0), 0);
  const bodySum = bodyData.reduce<number>((a, b) => a + (b || 0), 0);
  const hasBody = trend && trend.body.dates.length > 0;
  // RPE 均值趋势（双量表归一后按天聚合；旧后端无此字段时安全降级为空）
  const rpeVals: (number | null)[] = ((trend?.training as any)?.rpe ?? []) as (number | null)[];
  const rpeHas = rpeVals.some((v) => v != null);

  if (loading) {
    return <YStack flex={1} backgroundColor={colors.background} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>;
  }

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="数据复盘" subtitle="见证你的进步" onBack={() => navigation?.goBack()} />
      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>
          {/* 周期切换 */}
          <XStack gap={8} justifyContent="flex-end">
            {RANGES.map((d) => (
              <Chip key={d} label={`近${d}天`} active={days === d} onPress={() => setDays(d)} />
            ))}
          </XStack>

          {/* 疲劳管理评估 */}
          {fatigue && <FatigueCard fatigue={fatigue} />}

          {/* 训练统计 */}
          <Card title="训练统计" accent="primary">
            <XStack gap={8} flexWrap="wrap">
              <StatCard label="训练次数" value={stats?.session_count ?? 0} icon="" color={colors.primary} />
              <StatCard label="总时长" value={stats?.total_duration_min ?? 0} unit="min" icon="⏱" color={colors.accent} />
              <StatCard label="总消耗" value={stats ? Math.round(stats.total_calories) : 0} unit="kcal" color={colors.warning} />
              <StatCard label="训练容量" value={stats ? Math.round(stats.total_volume_kg) : 0} unit="kg" color={colors.success} />
            </XStack>
          </Card>

          {/* 训练趋势 */}
          <Card
            title="训练趋势"
            accent="primary"
            action={
              <XStack gap={6} flexWrap="wrap" maxWidth="60%" justifyContent="flex-end">
                {TRAIN_METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} active={trainKey === m.key} onPress={() => setTrainKey(m.key)} />
                ))}
              </XStack>
            }
          >
            {trainSum > 0 ? (
              <View>
                <TrendLineChart
                  data={trainData as number[]}
                  labels={dates}
                  color={trainMetric.color}
                  formatValue={trainMetric.fmt}
                  fromZero
                />
                <Text fontSize={11} color={colors.textMuted} marginTop={6}>
                  近{days}天共 {trainSum} 次训练 · 趋势按日聚合
                </Text>
              </View>
            ) : (
              <EmptyState icon="" title="暂无训练数据" description="开始记录训练，这里将展示你的进步曲线" />
            )}
          </Card>

          {/* RPE 均值趋势（力量 CR-10 / 有氧 Borg 6-20 已按口径归一；绝对值无直观意义，不显示 Y 轴数值） */}
          <Card title="RPE 强度趋势" accent="primary">
            {rpeHas ? (
              <View>
                <TrendLineChart
                  data={rpeVals}
                  labels={dates}
                  color={colors.accent}
                  formatValue={(v) => v.toFixed(1)}
                  fromZero
                  hideYLabels
                />
                <Text fontSize={11} color={colors.textMuted} marginTop={6}>
                  每日训练主观强度均值（力量每组 CR-10、有氧整节 Borg 6-20 折算后等价对比）
                </Text>
              </View>
            ) : (
              <EmptyState icon="" title="暂无 RPE 数据" description="训练时记录主观强度（力量每组 0-10、有氧整节 6-20），这里将展示强度走势" />
            )}
          </Card>

          {/* 饮食趋势 */}
          <Card
            title="饮食趋势"
            accent="warning"
            action={
              <XStack gap={6} flexWrap="wrap" maxWidth="60%" justifyContent="flex-end">
                {DIET_METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} active={dietKey === m.key} onPress={() => setDietKey(m.key)} />
                ))}
              </XStack>
            }
          >
            {dietSum > 0 ? (
              <View>
                {dietMetric.bar ? (
                  <TrendBarChart
                    data={dietData as number[]}
                    labels={dates}
                    color={dietMetric.color}
                    target={trend?.diet.target_calories ?? null}
                    targetLabel="目标"
                  />
                ) : (
                  <TrendLineChart
                    data={dietData as number[]}
                    labels={dates}
                    color={dietMetric.color}
                    formatValue={(v) => `${Math.round(v)}g`}
                    fromZero
                  />
                )}
                {dietMetric.bar && trend?.diet.target_calories ? (
                  <Text fontSize={11} color={colors.textMuted} marginTop={6}>
                    橙色虚线 = 每日目标 {Math.round(trend.diet.target_calories)} kcal · 近{days}天摄入 {Math.round(dietSum)} kcal
                  </Text>
                ) : (
                  <Text fontSize={11} color={colors.textMuted} marginTop={6}>
                    近{days}天{dietMetric.label}合计 {Math.round(dietSum)}{dietMetric.bar ? ' kcal' : 'g'}
                  </Text>
                )}
              </View>
            ) : (
              <EmptyState icon="" title="暂无饮食数据" description="记录饮食后，这里将展示摄入趋势与目标对比" />
            )}
          </Card>

          {/* 身体趋势 */}
          <Card
            title="身体趋势"
            accent="success"
            action={
              <XStack gap={6} flexWrap="wrap" maxWidth="60%" justifyContent="flex-end">
                {BODY_METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} active={bodyKey === m.key} onPress={() => setBodyKey(m.key)} />
                ))}
              </XStack>
            }
          >
            {hasBody && bodySum > 0 ? (
              <View>
                <TrendLineChart
                  data={bodyData}
                  labels={dates}
                  color={bodyMetric.color}
                  formatValue={(v) => `${v.toFixed(1)}${bodyMetric.unit}`}
                  fromZero={false}
                />
                <Text fontSize={11} color={colors.textMuted} marginTop={6}>
                  记录 {trend!.body.dates.length} 次{bodyMetric.label} · 最新 {bodyData.filter((v): v is number => v != null).slice(-1)[0]?.toFixed(1) ?? '—'} {bodyMetric.unit}
                </Text>
              </View>
            ) : (
              <EmptyState title="暂无身体数据" description="在「我的」填写身高体重，这里将展示体重/体脂变化" />
            )}
          </Card>

          {/* 周期统计标签 */}
          <XStack gap={8}>
            <Badge text="周报" tone="primary" />
            <Badge text="月报" tone="neutral" />
            <Badge text="专项" tone="warning" />
          </XStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export default StatsScreen;
