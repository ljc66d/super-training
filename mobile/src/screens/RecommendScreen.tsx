// 智能推荐页 —— 协同过滤："相似身材的人都在吃什么"
import React, { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { colors, radius } from '../theme/tokens';

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: '增肌',
  fat_loss: '减脂',
  strength: '力量',
  endurance: '耐力',
  maintain: '保持',
};

interface Food {
  name: string;
  count: number;
  matched: boolean;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  category: string | null;
}

interface SimilarUser {
  username: string;
  nickname: string;
  score: number;
  goal: string | null;
  bmi: number | null;
}

export function RecommendScreen({ navigation }: any) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [users, setUsers] = useState<SimilarUser[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.getRecommendFoods(8);
      setFoods(data?.foods || []);
      setUsers(data?.top_similar || []);
      setNote(data?.note || '');
    } catch (e: any) {
      console.warn(e.message);
      setErr(e?.message || '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="推荐" subtitle="相似身材的人都在吃什么" onBack={() => navigation?.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* 说明 */}
        <Card title="协同过滤推荐" accent="primary">
          <Text fontSize={12} color={colors.textMuted} lineHeight={18}>
            {note || '根据身材（BMI/体脂率）、性别年龄、训练目标与运动习惯的相似度，为你推荐伙伴们常吃的食物。'}
          </Text>
          {users.length > 0 && (
            <XStack gap={6} flexWrap="wrap" marginTop={8}>
              {users.map((u, i) => (
                <View key={i} paddingHorizontal={8} paddingVertical={4}
                      borderRadius={radius.pill} backgroundColor={colors.surfaceLight}
                      borderWidth={1} borderColor={colors.border}>
                  <Text fontSize={11} color={colors.textSecondary}>
                    {u.nickname} · 相似度 {u.score}分
                    {u.goal ? ` · ${GOAL_LABELS[u.goal] || u.goal}` : ''}
                    {u.bmi ? ` · BMI ${u.bmi}` : ''}
                  </Text>
                </View>
              ))}
            </XStack>
          )}
        </Card>

        {loading ? (
          <YStack alignItems="center" padding={30}><Spinner color={colors.primary} /></YStack>
        ) : err ? (
          <YStack alignItems="center" padding={30} gap={10}>
            <Text fontSize={13} color={colors.danger}>{err}</Text>
            <Button backgroundColor={colors.primary} borderRadius={radius.md} onPress={load}>
              <Text color="#fff" fontSize={13} fontWeight="600">重试</Text>
            </Button>
          </YStack>
        ) : foods.length === 0 ? (
          <YStack alignItems="center" padding={30} gap={8}>
            <Text fontSize={30}></Text>
            <Text fontSize={13} color={colors.textSecondary}>还没有相似伙伴的饮食数据</Text>
            <Text fontSize={12} color={colors.textMuted} textAlign="center" lineHeight={18}>
              完善"我的"里的身高/体重/体脂/目标，并多记录几次训练和饮食，
              推荐会越来越准
            </Text>
          </YStack>
        ) : (
          <>
            <Text fontSize={13} fontWeight="700" color={colors.text}>
              伙伴们常吃的 {foods.length} 种食物
            </Text>
            {foods.map((f, i) => (
              <View key={i} backgroundColor={colors.surface} borderRadius={radius.md}
                    padding={14} borderWidth={1} borderColor={colors.border}>
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text fontSize={15} fontWeight="700" color={colors.text}>{f.name}</Text>
                    <Text fontSize={11} color={colors.textMuted} marginTop={2}>
                      {f.count} 位相似伙伴吃过{f.category ? ` · ${f.category}` : ''}
                    </Text>
                  </YStack>
                  {f.matched && f.calories != null && (
                    <YStack alignItems="flex-end">
                      <Text fontSize={16} fontWeight="800" color={colors.warning}>
                        {Math.round(f.calories)} kcal
                      </Text>
                      <Text fontSize={10} color={colors.textMuted}>
                        P{Math.round(f.protein || 0)} C{Math.round(f.carbs || 0)} F{Math.round(f.fat || 0)}
                        <Text fontSize={10}>（每100g）</Text>
                      </Text>
                    </YStack>
                  )}
                </XStack>
              </View>
            ))}
            <Button
              {...({ type: 'button' } as any)}
              backgroundColor={colors.surfaceLight}
              borderWidth={1}
              borderColor={colors.border}
              borderRadius={radius.md}
              onPress={load}
              marginTop={4}
            >
              <Text color={colors.textSecondary} fontSize={13} fontWeight="600">换一批</Text>
            </Button>
          </>
        )}
      </ScrollView>
    </YStack>
  );
}
