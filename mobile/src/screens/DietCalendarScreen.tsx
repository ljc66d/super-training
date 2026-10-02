// 饮食记录日历页 —— 月历标记有饮食记录的日期，点击某天查看当天饮食明细与营养
import React, { useEffect, useMemo, useState } from 'react';
import { Text, YStack, XStack, ScrollView, View, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { MonthCalendar } from '../components/MonthCalendar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { NutritionCard } from '../components/NutritionCard';
import { colors, radius } from '../theme/tokens';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

interface DietRecord {
  record_id: string;
  record_date: string;
  meal_type: string;
  food_items: any;
  total_calories: number | null;
  total_protein: number | null;
  total_fat: number | null;
  total_carbs: number | null;
  source: string;
}

export function DietCalendarScreen({ navigation }: any) {
  const [recordDates, setRecordDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [dayRecords, setDayRecords] = useState<DietRecord[]>([]);
  const [dayStats, setDayStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);

  // 加载所有有记录的日期（日历标记）
  useEffect(() => {
    (async () => {
      try {
        const dates = await api.getDietRecordDates();
        setRecordDates(dates || []);
      } catch (e: any) {
        console.warn(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 切换日期时加载该天的记录与营养
  useEffect(() => {
    setLoadingDay(true);
    (async () => {
      try {
        const [records, stats] = await Promise.all([
          api.getDietRecords(selectedDate),
          api.getDietStats(selectedDate),
        ]);
        setDayRecords(records || []);
        setDayStats(stats || null);
      } catch (e: any) {
        console.warn(e.message);
        setDayRecords([]);
        setDayStats(null);
      } finally {
        setLoadingDay(false);
      }
    })();
  }, [selectedDate]);

  const totalCalories = dayRecords.reduce((s, r) => s + (r.total_calories || 0), 0);

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="饮食记录" subtitle={`共 ${recordDates.length} 天有记录`} onBack={() => navigation.goBack()} />

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>
      ) : (
        <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <YStack gap={16}>
            {/* 月历 */}
            <MonthCalendar
              selectedDate={selectedDate}
              markedDates={recordDates}
              onSelect={setSelectedDate}
            />
            <Text fontSize={11} color={colors.textMuted}>提示：有饮食记录的日期显示橙色圆点，点击可查看当天详情</Text>

            {/* 选中日期详情 */}
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={17} fontWeight="bold" color={colors.text}>{selectedDate}</Text>
              {!loadingDay && dayRecords.length > 0 && (
                <Badge text={`${Math.round(totalCalories)} kcal`} tone="warning" />
              )}
            </XStack>

            {loadingDay ? (
              <YStack alignItems="center" padding={24}><Spinner color={colors.primary} /></YStack>
            ) : dayRecords.length === 0 ? (
              <EmptyState icon="" title="当天没有饮食记录" description="在饮食Tab记录饮食，或点击日期切换查看" />
            ) : (
              <YStack gap={16}>
                {/* 当日营养汇总 */}
                {dayStats && <NutritionCard stats={dayStats} />}

                {/* 每餐明细 */}
                {dayRecords.map((rec) => {
                  const items: any[] = rec.food_items?.items || [];
                  return (
                    <Card key={rec.record_id} title={`${MEAL_LABELS[rec.meal_type] || rec.meal_type} · ${Math.round(rec.total_calories || 0)} kcal`} accent="primary">
                      <YStack gap={8}>
                        <XStack gap={6} flexWrap="wrap">
                          <Badge text={`蛋白 ${Math.round(rec.total_protein || 0)}g`} tone="success" />
                          <Badge text={`碳水 ${Math.round(rec.total_carbs || 0)}g`} tone="warning" />
                          <Badge text={`脂肪 ${Math.round(rec.total_fat || 0)}g`} tone="neutral" />
                        </XStack>

                        {items.length > 0 ? (
                          <YStack gap={6}>
                            {items.map((it, i) => (
                              <XStack key={i} justifyContent="space-between" alignItems="center" backgroundColor={colors.surfaceLight} borderRadius={radius.sm} paddingHorizontal={10} paddingVertical={8}>
                                <Text fontSize={13} color={colors.text}>{it.food_name || '未知食物'}</Text>
                                <Text fontSize={12} color={colors.textMuted}>
                                  {it.weight_g ? `${it.weight_g}g` : ''}
                                  {it.nutrition?.calories ? ` · ${Math.round(it.nutrition.calories)}kcal` : ''}
                                </Text>
                              </XStack>
                            ))}
                          </YStack>
                        ) : (
                          <Text fontSize={12} color={colors.textMuted}>无明细（自然语言记录）</Text>
                        )}
                      </YStack>
                    </Card>
                  );
                })}
              </YStack>
            )}
          </YStack>
        </ScrollView>
      )}
    </YStack>
  );
}

export default DietCalendarScreen;
