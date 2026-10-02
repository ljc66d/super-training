// 我的社区分享管理页 —— 列出我发布的动态，可改可见性（公开/仅自己）/删除；
// 展示点赞人与评论详情（公共社区流不暴露，仅本人可见）
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Button, Image, Text, YStack, XStack, ScrollView, Spinner, View } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { colors, radius } from '../theme/tokens';
import { fullUrl } from '../utils/url';

const TYPE_LABEL: Record<string, string> = {
  training: '训练', diet: '饮食', milestone: '里程碑', normal: '日常',
};

const AVATAR_SIZE = 28;

export function MySharesScreen({ navigation }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.getMyPosts();
      setPosts(d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleVisibility = async (post: any) => {
    const next = !post.is_public;
    try {
      await api.updatePostVisibility(post.post_id, next);
      setPosts((prev) => prev.map((p) =>
        p.post_id === post.post_id ? { ...p, is_public: next } : p));
    } catch (e: any) {
      alert(e?.message || '修改失败');
    }
  };

  const handleDelete = (post: any) => {
    const doDelete = async () => {
      try {
        await api.deletePost(post.post_id);
        setPosts((prev) => prev.filter((p) => p.post_id !== post.post_id));
      } catch (e: any) {
        alert(e?.message || '删除失败');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('确定删除这条分享吗？删除后不可恢复。')) doDelete();
    } else {
      Alert.alert('删除分享', '删除后不可恢复，确定继续吗？', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="社区分享" subtitle="管理我发布的分享" onBack={() => navigation.goBack()} />
      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color={colors.primary} />
        </YStack>
      ) : posts.length === 0 ? (
        <EmptyState title="还没有发布分享" description="在社区发布动态后，可在这里管理可见性与删除" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
          {posts.map((post) => {
            const likes: any[] = post.likes || [];
            const comments: any[] = post.comments || [];
            return (
              <Card key={post.post_id}>
                <YStack gap={10}>
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack gap={6} alignItems="center">
                      <Badge text={TYPE_LABEL[post.post_type] || '日常'} tone="primary" />
                      <Badge text={post.is_public ? '公开' : '仅自己'} tone={post.is_public ? 'success' : 'neutral'} />
                    </XStack>
                    <Text fontSize={11} color={colors.textMuted}>{post.created_at?.slice(0, 16)}</Text>
                  </XStack>
                  {post.content ? (
                    <Text fontSize={13} color={colors.text} numberOfLines={2} lineHeight={18}>{post.content}</Text>
                  ) : (
                    <Text fontSize={12} color={colors.textMuted}>（图片/数据分享）</Text>
                  )}

                  {/* 点赞人列表（仅本人可见） */}
                  {likes.length > 0 && (
                    <YStack gap={6} paddingTop={6} borderTopWidth={1} borderTopColor={colors.border}>
                      <Text fontSize={11} color={colors.textMuted}>❤️ {likes.length} 人点赞</Text>
                      <XStack gap={6} flexWrap="wrap">
                        {likes.map((l) => (
                          <XStack key={l.user_id} alignItems="center" gap={4}>
                            <View width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} backgroundColor={colors.surfaceLight} overflow="hidden" alignItems="center" justifyContent="center">
                              {l.avatar_url ? (
                                <Image src={fullUrl(l.avatar_url)} width="100%" height="100%" resizeMode="cover" />
                              ) : (
                                <Text fontSize={10} color={colors.textMuted}>{l.nickname?.[0]?.toUpperCase() || 'U'}</Text>
                              )}
                            </View>
                            <Text fontSize={11} color={colors.textSecondary}>{l.nickname}</Text>
                          </XStack>
                        ))}
                      </XStack>
                    </YStack>
                  )}

                  {/* 评论详情（仅本人可见，公共社区仍只显示评论数） */}
                  {comments.length > 0 && (
                    <YStack gap={6} paddingTop={6} borderTopWidth={likes.length > 0 ? 0 : 1} borderTopColor={colors.border}>
                      <Text fontSize={11} color={colors.textMuted}>💬 {comments.length} 条评论</Text>
                      {comments.map((c) => (
                        <XStack key={c.comment_id} gap={6} alignItems="flex-start">
                          <View width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} backgroundColor={colors.surfaceLight} overflow="hidden" alignItems="center" justifyContent="center" marginTop={2}>
                            {c.author_avatar ? (
                              <Image src={fullUrl(c.author_avatar)} width="100%" height="100%" resizeMode="cover" />
                            ) : (
                              <Text fontSize={10} color={colors.textMuted}>{c.author?.[0]?.toUpperCase() || 'U'}</Text>
                            )}
                          </View>
                          <YStack flex={1} gap={2}>
                            <XStack gap={6} alignItems="baseline">
                              <Text fontSize={12} fontWeight="600" color={colors.text}>{c.author}</Text>
                              <Text fontSize={10} color={colors.textMuted}>{c.created_at?.slice(0, 16)}</Text>
                            </XStack>
                            <Text fontSize={13} color={colors.text} lineHeight={18}>{c.content}</Text>
                          </YStack>
                        </XStack>
                      ))}
                    </YStack>
                  )}

                  <XStack gap={8} justifyContent="flex-end" marginTop={4}>
                    <Button
                      height={32}
                      paddingHorizontal={12}
                      borderRadius={radius.md}
                      backgroundColor={colors.surfaceLight}
                      borderWidth={1}
                      borderColor={colors.border}
                      onPress={() => toggleVisibility(post)}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <Text color={colors.textSecondary} fontWeight="600" fontSize={12}>
                        {post.is_public ? '设为仅自己' : '设为公开'}
                      </Text>
                    </Button>
                    <Button
                      height={32}
                      paddingHorizontal={12}
                      borderRadius={radius.md}
                      backgroundColor={colors.dangerSoft}
                      onPress={() => handleDelete(post)}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <Text color={colors.danger} fontWeight="600" fontSize={12}>删除</Text>
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </YStack>
  );
}

export default MySharesScreen;