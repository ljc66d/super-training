// 公开主页 —— 别人看你的资料（只读）
// 数据由 getPublicProfile 返回；生日受 show_birthday 控制
// 底部可发起关注 / 私信，推进社交
import React, { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: '增肌', fat_loss: '减脂', strength: '力量',
  endurance: '耐力', fitness: '塑形', maintain: '维持',
};
const GENDER_LABELS: Record<string, string> = { male: '男', female: '女' };

function calcBmi(h?: number, w?: number) {
  if (!h || !w) return null;
  return (w / Math.pow(h / 100, 2)).toFixed(1);
}

export function PublicProfileScreen({ navigation, route }: any) {
  const { user: me } = useAuth();
  const userId = route?.params?.userId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profile, relations] = await Promise.all([
        api.getPublicProfile(userId),
        api.getUserRelations(userId).catch(() => null),
      ]);
      setData(profile);
      if (relations) setFollowed(!!relations.followed);
    } catch (e: any) {
      setMsg(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (busy) return;
    setBusy(true);
    const next = !followed;
    setFollowed(next);
    try {
      if (next) {
        await api.followUser(userId);
      } else {
        await api.unfollowUser(userId);
      }
    } catch (e: any) {
      setFollowed(!next);
      setMsg(e?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const openChat = () => {
    navigation?.navigate('Messages', { user: { user_id: userId, nickname: data?.nickname } });
  };

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={colors.background}>
        <BackHeader title="TA 的主页" onBack={() => navigation?.goBack()} />
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner color={colors.primary} /></YStack>
      </YStack>
    );
  }

  if (!data) {
    return (
      <YStack flex={1} backgroundColor={colors.background}>
        <BackHeader title="TA 的主页" onBack={() => navigation?.goBack()} />
        <Text textAlign="center" padding={30} color={colors.textMuted}>{msg || '用户不存在'}</Text>
      </YStack>
    );
  }

  const bmi = calcBmi(data.height_cm, data.weight_kg);
  const isMe = me?.user_id === userId;

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="TA 的主页" onBack={() => navigation?.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* 顶部：头像 + 昵称 + 社交按钮 */}
        <Card>
          <XStack gap={14} alignItems="center">
            <View width={64} height={64} borderRadius={32} backgroundColor={colors.primary} alignItems="center" justifyContent="center">
              <Text fontSize={28} color="#fff" fontWeight="bold">{data.nickname?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
            <YStack flex={1} gap={4}>
              <XStack gap={6} alignItems="center">
                <Text fontSize={18} fontWeight="bold" color={colors.text}>{data.nickname}</Text>
                {data.is_coach && (
                  <View backgroundColor="rgba(34,197,94,0.15)" borderRadius={4} paddingHorizontal={6} paddingVertical={1}>
                    <Text fontSize={10} color={colors.success} fontWeight="700">教练</Text>
                  </View>
                )}
              </XStack>
              {data.specialty && <Text fontSize={11} color={colors.textMuted}>专长：{data.specialty}</Text>}
            </YStack>
          </XStack>
          {!isMe && (
            <XStack gap={8} marginTop={12}>
              <Button
                {...({ type: 'button' } as any)}
                flex={1} height={38} borderRadius={radius.md}
                backgroundColor={followed ? colors.surfaceLight : colors.primary}
                borderWidth={1} borderColor={followed ? colors.border : colors.primary}
                onPress={handleFollow} disabled={busy} pressStyle={{ opacity: 0.85 }}
              >
                <Text fontSize={13} fontWeight="700" color={followed ? colors.textSecondary : '#fff'}>
                  {busy ? '…' : followed ? '已关注' : '+ 关注'}
                </Text>
              </Button>
              <Button
                {...({ type: 'button' } as any)}
                flex={1} height={38} borderRadius={radius.md}
                backgroundColor={colors.surfaceLight} borderWidth={1} borderColor={colors.border}
                onPress={openChat} pressStyle={{ opacity: 0.85 }}
              >
                <Text fontSize={13} fontWeight="700" color={colors.text}>私信</Text>
              </Button>
            </XStack>
          )}
        </Card>

        {/* 基础画像 */}
        <Card title="基础资料">
          <YStack gap={8}>
            <Row k="性别" v={data.gender ? GENDER_LABELS[data.gender] || data.gender : '—'} />
            <Row k="生日" v={data.birthday || (data.show_birthday ? '—' : '隐私')} />
            {bmi && <Row k="BMI" v={bmi} />}
            {data.goal && <Row k="训练目标" v={GOAL_LABELS[data.goal] || data.goal} />}
          </YStack>
        </Card>

        {/* 身体数据 */}
        {(data.height_cm || data.weight_kg) && (
          <Card title="身体数据">
            <XStack gap={20}>
              {data.height_cm && <Stat k="身高" v={`${data.height_cm} cm`} />}
              {data.weight_kg && <Stat k="体重" v={`${data.weight_kg} kg`} />}
            </XStack>
          </Card>
        )}

        {/* 社交信息（推进社交） */}
        {(data.location || data.gym) && (
          <Card title="社交信息" accent="primary">
            <YStack gap={8}>
              {data.location && <Row k="所在地" v={data.location} />}
              {data.gym && <Row k="常去健身房" v={data.gym} />}
            </YStack>
          </Card>
        )}

        {msg && (
          <View backgroundColor="rgba(239,68,68,0.12)" borderRadius={radius.sm} padding={10}>
            <Text fontSize={11} color={colors.danger}>{msg}</Text>
          </View>
        )}
        <View height={20} />
      </ScrollView>
    </YStack>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <XStack gap={8} alignItems="center">
      <Text fontSize={12} color={colors.textMuted} width={90}>{k}</Text>
      <Text fontSize={13} color={colors.text} flex={1} numberOfLines={2}>{String(v)}</Text>
    </XStack>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <YStack gap={2}>
      <Text fontSize={11} color={colors.textMuted}>{k}</Text>
      <Text fontSize={16} fontWeight="700" color={colors.text}>{v}</Text>
    </YStack>
  );
}

export default PublicProfileScreen;
