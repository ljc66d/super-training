// 社交页 —— 粉丝列表 / 关注列表（朋友）切换
// 每行：头像昵称 + 目标 + 关注按钮 + 私信快捷入口
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, ScrollView, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: '增肌', fat_loss: '减脂', strength: '力量',
  endurance: '耐力', fitness: '塑形', beginner: '新手',
};

interface UserRow {
  user_id: string;
  nickname: string;
  goal?: string | null;
  avatar?: string | null;
  followed?: boolean;
  location?: string | null;
  gym?: string | null;
  is_coach?: boolean;
  specialty?: string | null;
  same_gym?: boolean;
}

export function SocialScreen({ navigation }: any) {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<'followers' | 'following' | 'nearby'>('followers');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    setNote(null);
    try {
      if (tab === 'nearby') {
        const data = await api.getNearbyUsers();
        setRows(data?.users || []);
        setNote(data?.note || null);
      } else {
        const data = tab === 'followers'
          ? await api.getFollowers(me?.user_id || '')
          : await api.getFollowing(me?.user_id || '');
        setRows(data || []);
      }
    } catch (e: any) {
      setMsg(`加载失败：${e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  }, [tab, me?.user_id]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (u: UserRow) => {
    if (busyId) return;
    setBusyId(u.user_id);
    try {
      if (u.followed) {
        await api.unfollowUser(u.user_id);
      } else {
        await api.followUser(u.user_id);
      }
      setRows((prev) => prev.map((r) => r.user_id === u.user_id ? { ...r, followed: !u.followed } : r));
    } catch (e: any) {
      setMsg(e?.message || '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  const openChat = (u: UserRow) => {
    navigation?.navigate('Messages', { user: { user_id: u.user_id, nickname: u.nickname } });
  };

  const handleSearch = async () => {
    const q = searchText.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const r = await api.searchUser(q);
      setSearchResult(r || null);
    } catch (e: any) {
      setMsg(e?.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleFollowSearch = async () => {
    const r = searchResult;
    if (!r || busyId) return;
    setBusyId(r.user_id);
    try {
      if (r.followed) {
        await api.unfollowUser(r.user_id);
      } else {
        await api.followUser(r.user_id);
      }
      setSearchResult({ ...r, followed: !r.followed });
    } catch (e: any) {
      setMsg(e?.message || '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="社交" subtitle="粉丝与朋友" onBack={() => navigation?.goBack()} />

      {/* Tab 切换 */}
      <XStack paddingHorizontal={16} gap={8}>
        {(['followers', 'following', 'nearby'] as const).map((k) => (
          <View
            key={k}
            flex={1}
            alignItems="center"
            paddingVertical={8}
            borderRadius={radius.md}
            backgroundColor={tab === k ? colors.primary : colors.surface}
            borderWidth={1}
            borderColor={tab === k ? colors.primary : colors.border}
            onPress={() => setTab(k)}
            pressStyle={{ opacity: 0.8 }}
          >
            <Text fontSize={13} fontWeight="700" color={tab === k ? '#fff' : colors.textSecondary}>
              {k === 'followers' ? '粉丝' : k === 'following' ? '朋友' : '同城'}
            </Text>
          </View>
        ))}
      </XStack>

      {/* 搜索 ID 加好友 */}
      <XStack paddingHorizontal={16} gap={8} paddingTop={12}>
        <Input
          flex={1}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="输入 ID 或用户名搜索"
          placeholderTextColor={colors.textMuted}
          backgroundColor={colors.surface}
          borderRadius={radius.md}
          borderWidth={1}
          borderColor={colors.border}
          color={colors.text}
          onSubmitEditing={handleSearch}
        />
        <Button
          {...({ type: 'button' } as any)}
          height={44}
          paddingHorizontal={14}
          borderRadius={radius.md}
          backgroundColor={colors.primary}
          onPress={handleSearch}
          disabled={searching}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text color="#fff" fontWeight="600" fontSize={13}>{searching ? '…' : '搜索'}</Text>
        </Button>
      </XStack>
      {searchResult && (
        <XStack
          marginHorizontal={16}
          marginTop={10}
          gap={10}
          alignItems="center"
          backgroundColor={colors.surface}
          borderRadius={radius.md}
          padding={12}
          borderWidth={1}
          borderColor={colors.border}
        >
          <View width={42} height={42} borderRadius={21} backgroundColor={colors.primary} alignItems="center" justifyContent="center">
            <Text color="#fff" fontWeight="bold">{searchResult.nickname?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <YStack flex={1} gap={2}>
            <Text fontSize={14} fontWeight="600" color={colors.text}>{searchResult.nickname}</Text>
            <Text fontSize={11} color={colors.textMuted}>ID：{searchResult.uid || '—'}</Text>
          </YStack>
          <Button
            {...({ type: 'button' } as any)}
            height={30}
            paddingHorizontal={12}
            borderRadius={radius.pill}
            backgroundColor={searchResult.followed ? colors.surfaceLight : colors.primary}
            borderWidth={1}
            borderColor={searchResult.followed ? colors.border : colors.primary}
            onPress={handleFollowSearch}
            disabled={busyId === searchResult.user_id}
            pressStyle={{ opacity: 0.8 }}
          >
            <Text fontSize={12} fontWeight="600" color={searchResult.followed ? colors.textSecondary : '#fff'}>
              {searchResult.followed ? '已关注' : '+ 关注'}
            </Text>
          </Button>
        </XStack>
      )}
      {note && (
        <Text fontSize={11} color={colors.textMuted} paddingHorizontal={16} paddingTop={6}>{note}</Text>
      )}

      {msg && (
        <View backgroundColor="rgba(239,68,68,0.12)" borderRadius={radius.sm} padding={8} marginHorizontal={16} marginTop={8}>
          <Text fontSize={11} color={colors.danger}>{msg}</Text>
        </View>
      )}

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner color={colors.primary} /></YStack>
      ) : rows.length === 0 ? (
        <Text fontSize={12} color={colors.textMuted} textAlign="center" padding={30}>
          {tab === 'followers' ? '还没有粉丝\n去社区发动态，让更多人认识你'
            : tab === 'following' ? '还没有关注任何人\n在社区帖子点「+ 关注」即可'
              : '还没有同城伙伴\n先去「我的资料」填写所在地'}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
          {rows.map((u) => (
            <XStack
              key={u.user_id}
              gap={10}
              alignItems="center"
              backgroundColor={colors.surface}
              borderRadius={radius.md}
              padding={12}
              borderWidth={1}
              borderColor={colors.border}
            >
              <View width={42} height={42} borderRadius={21} backgroundColor={colors.primary} alignItems="center" justifyContent="center">
                <Text color="#fff" fontWeight="bold">{u.nickname?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <YStack flex={1} gap={2}>
                <XStack gap={6} alignItems="center">
                  <Text fontSize={14} fontWeight="600" color={colors.text}>{u.nickname}</Text>
                  {u.is_coach && (
                    <View backgroundColor="rgba(34,197,94,0.15)" borderRadius={4} paddingHorizontal={5} paddingVertical={1}>
                      <Text fontSize={9} color={colors.success} fontWeight="700">教练</Text>
                    </View>
                  )}
                  {u.same_gym && (
                    <View backgroundColor="rgba(59,130,246,0.15)" borderRadius={4} paddingHorizontal={5} paddingVertical={1}>
                      <Text fontSize={9} color={colors.primary} fontWeight="700">同健身房</Text>
                    </View>
                  )}
                </XStack>
                {u.location && <Text fontSize={11} color={colors.textMuted}>{u.location}</Text>}
                {u.gym && <Text fontSize={11} color={colors.textMuted}>{u.gym}</Text>}
                {u.goal && (
                  <Text fontSize={11} color={colors.textMuted}>
                    目标：{GOAL_LABELS[u.goal] || u.goal}
                  </Text>
                )}
              </YStack>
              {u.user_id !== me?.user_id && (
                <>
                  <Button
                    {...({ type: 'button' } as any)}
                    height={30}
                    paddingHorizontal={10}
                    borderRadius={radius.pill}
                    backgroundColor={u.followed ? colors.surfaceLight : colors.primary}
                    borderWidth={1}
                    borderColor={u.followed ? colors.border : colors.primary}
                    onPress={() => toggleFollow(u)}
                    disabled={busyId === u.user_id}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <Text fontSize={12} fontWeight="600" color={u.followed ? colors.textSecondary : '#fff'}>
                      {busyId === u.user_id ? '…' : u.followed ? '已关注' : '+ 关注'}
                    </Text>
                  </Button>
                  <Button
                    {...({ type: 'button' } as any)}
                    height={30}
                    width={34}
                    padding={0}
                    borderRadius={radius.pill}
                    backgroundColor={colors.surfaceLight}
                    borderWidth={1}
                    borderColor={colors.border}
                    onPress={() => openChat(u)}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <Text fontSize={13}></Text>
                  </Button>
                </>
              )}
            </XStack>
          ))}
        </ScrollView>
      )}
    </YStack>
  );
}

export default SocialScreen;
