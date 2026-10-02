// 训练记录日历页 —— 月历标记训练日，点击某天查看当天具体训练
import React, { useEffect, useMemo, useState } from 'react';
import { Text, YStack, XStack, ScrollView, View, Spinner } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { MonthCalendar } from '../components/MonthCalendar';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { colors, radius } from '../theme/tokens';

interface Session {
  session_id: string;
  sport_name: string;
  category: string;
  start_time: string;
  duration: number | null;
  calories_burned: number | null;
  source: string;
  detail_json: any;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

export function SessionListScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data || []);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 按日期分组
  const groups: Record<string, Session[]> = useMemo(() => {
    const g: Record<string, Session[]> = {};
    sessions.forEach((s) => {
      const date = (s.start_time || '').slice(0, 10);
      if (!g[date]) g[date] = [];
      g[date].push(s);
    });
    return g;
  }, [sessions]);

  // 有训练记录的日期
  const markedDates = Object.keys(groups);

  // 选中当天的训练
  const daySessions = groups[selectedDate] || [];
  const dayCalories = daySessions.reduce((s, x) => s + (x.calories_burned || 0), 0);
  const sourceLabel: Record<string, string> = { manual: '手动', nlp: '语音', wearable: '穿戴', photo: '拍照' };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="训练记录" subtitle={`共 ${sessions.length} 次训练`} onBack={() => navigation.goBack()} />

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>
      ) : (
        <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <YStack gap={16}>
            {/* 月历 */}
            <MonthCalendar
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelect={setSelectedDate}
            />
            <Text fontSize={11} color={colors.textMuted}>提示：有训练记录的日期显示橙色圆点，点击可查看当天详情</Text>

            {/* 选中日期详情 */}
            <YStack gap={10}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={17} fontWeight="bold" color={colors.text}>{selectedDate}</Text>
                {daySessions.length > 0 && (
                  <XStack gap={6}>
                    <Badge text={`${daySessions.length}次`} tone="primary" />
                    <Badge text={`${Math.round(dayCalories)}kcal`} tone="warning" />
                  </XStack>
                )}
              </XStack>

              {daySessions.length === 0 ? (
                <EmptyState icon="" title="当天没有训练" description="在训练Tab开始记录，或点击日期切换查看" />
              ) : (
                daySessions.map((s) => {
                  const time = (s.start_time || '').slice(11, 16);
                  const volume = s.detail_json?.volume_kg;
                  return (
                    <Card key={s.session_id}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack flex={1} gap={3}>
                          <XStack alignItems="center" gap={6}>
                            <Text fontSize={14} color={colors.textMuted}>{time}</Text>
                            <Text fontSize={15} fontWeight="600" color={colors.text}>{s.sport_name}</Text>
                          </XStack>
                          <XStack gap={6} flexWrap="wrap">
                            {s.duration ? <Badge text={`⏱ ${s.duration}分钟`} tone="neutral" /> : null}
                            {volume ? <Badge text={`${Math.round(volume)}kg`} tone="success" /> : null}
                            <Badge text={sourceLabel[s.source] || '手动'} tone="neutral" />
                          </XStack>
                        </YStack>
                        <Text fontSize={18} fontWeight="bold" color={colors.accent}>
                          {s.calories_burned ? `${Math.round(s.calories_burned)}kcal` : '—'}
                        </Text>
                      </XStack>
                    </Card>
                  );
                })
              )}
            </YStack>
          </YStack>
        </ScrollView>
      )}
    </YStack>
  );
}

export default SessionListScreen;
