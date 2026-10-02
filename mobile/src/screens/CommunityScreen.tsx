// 社区页面 —— 朋友圈/微博式动态流：图片+文案 / 纯文字 / 纯图片(≤9张) / 点赞 / 文字评论
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform } from 'react-native';
import { Button, Input, Text, YStack, XStack, ScrollView, View, Image, Spinner } from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { api, API_BASE_URL } from '../api/client';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';

const typeIcon: Record<string, string> = {
  training: '', diet: '', milestone: '', normal: '',
};

// 相对 URL（/uploads/xx）转完整可访问地址
function fullUrl(u: string): string {
  if (!u) return u;
  return u.startsWith('http') ? u : `${API_BASE_URL.replace(/\/api\/v1$/, '')}${u}`;
}

// 上传前压缩（最长边 1280 + quality 0.7）
async function compressImage(uri: string): Promise<string> {
  try {
    const r = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return r.uri;
  } catch (e) {
    console.warn('compress failed', e);
    return uri;
  }
}

export function CommunityScreen({ navigation }: any) {
  const { user: me } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState<string | null>(null);

  // 发布
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [pickedImages, setPickedImages] = useState<{ uri: string; name: string }[]>([]);
  const [publishing, setPublishing] = useState(false);

  // 评论
  const [commentPost, setCommentPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.getPosts();
      setPosts(p || []);
    } catch (e: any) {
      console.warn(e.message);
      setMsg('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ---- 发布 ----
  const pickImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setMsg('需要相册权限'); return; }
      const remain = 9 - pickedImages.length;
      if (remain <= 0) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remain,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const news = result.assets.slice(0, remain).map((a) => ({
        uri: a.uri, name: a.fileName || `img_${Date.now()}.jpg`,
      }));
      setPickedImages((prev) => [...prev, ...news].slice(0, 9));
    } catch (e: any) {
      setMsg(`选图失败：${e?.message || ''}`);
    }
  };

  const removePicked = (i: number) => {
    setPickedImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handlePost = async () => {
    if (!content.trim() && pickedImages.length === 0) {
      setMsg('写点什么或选张图吧');
      return;
    }
    setPublishing(true);
    setMsg(null);
    try {
      // 逐张压缩并上传图片
      const urls: string[] = [];
      for (const img of pickedImages) {
        const compressed = await compressImage(img.uri);
        const form = new FormData();
        if (Platform.OS === 'web') {
          const res = await fetch(compressed);
          const blob = await res.blob();
          form.append('file', new File([blob], img.name, { type: 'image/jpeg' }));
        } else {
          form.append('file', { uri: compressed, name: img.name, type: 'image/jpeg' } as any);
        }
        const up = await api.uploadPostImage(form);
        if (up?.url) urls.push(up.url);
      }
      // 发帖
      await api.createPost({
        content: content.trim() || undefined,
        post_type: pickedImages.length > 0 && !content.trim() ? 'normal' : 'normal',
        images: urls,
      });
      setContent('');
      setPickedImages([]);
      setComposerOpen(false);
      await loadPosts();
    } catch (e: any) {
      setMsg(`发布失败：${e?.message || '请重试'}`);
    } finally {
      setPublishing(false);
    }
  };

  // ---- 点赞（乐观更新）----
  const handleLike = async (post: any) => {
    const idx = posts.findIndex((p) => p.post_id === post.post_id);
    if (idx < 0) return;
    const next = posts.map((p, i) => i === idx
      ? { ...p, liked: !p.liked, like_count: Math.max(0, p.like_count + (p.liked ? -1 : 1)) }
      : p);
    setPosts(next);
    try {
      const r = await api.likePost(post.post_id);
      setPosts((prev) => prev.map((p) => p.post_id === post.post_id
        ? { ...p, liked: r?.liked, like_count: r?.like_count ?? p.like_count }
        : p));
    } catch (e: any) {
      setPosts(posts); // 回滚
      setMsg('点赞失败');
    }
  };

  // ---- 关注（乐观更新）----
  const handleFollow = async (post: any) => {
    if (followBusy || post.user_id === me?.user_id) return;
    setFollowBusy(post.user_id);
    const target = !post.followed;
    setPosts((prev) => prev.map((p) => p.post_id === post.post_id ? { ...p, followed: target } : p));
    try {
      if (target) {
        await api.followUser(post.user_id);
      } else {
        await api.unfollowUser(post.user_id);
      }
    } catch (e: any) {
      setPosts((prev) => prev.map((p) => p.post_id === post.post_id ? { ...p, followed: !target } : p)); // 回滚
      setMsg('关注操作失败');
    } finally {
      setFollowBusy(null);
    }
  };

  // ---- 私信 ----
  const openChat = (post: any) => {
    navigation?.navigate('Messages', { user: { user_id: post.user_id, nickname: post.author } });
  };

  // ---- 查看主页 ----
  const openProfile = (post: any) => {
    if (post.user_id === me?.user_id) {
      navigation?.navigate('MyProfile');
    } else {
      navigation?.navigate('PublicProfile', { userId: post.user_id });
    }
  };

  // ---- 评论 ----
  const openComments = async (post: any) => {
    setCommentPost(post);
    setComments([]);
    setCommentText('');
    try {
      const cs = await api.getComments(post.post_id);
      setComments(cs || []);
    } catch (e: any) {
      setMsg('评论加载失败');
    }
  };

  const sendComment = async () => {
    const t = commentText.trim();
    if (!t || !commentPost) return;
    setCommentLoading(true);
    setMsg(null);
    try {
      await api.createComment(commentPost.post_id, t);
      setCommentText('');
      const cs = await api.getComments(commentPost.post_id);
      setComments(cs || []);
      // 更新帖子评论数
      setPosts((prev) => prev.map((p) => p.post_id === commentPost.post_id
        ? { ...p, comment_count: p.comment_count + 1 } : p));
      setCommentPost((prev: any) => ({ ...prev, comment_count: prev.comment_count + 1 }));
    } catch (e: any) {
      setMsg(`评论失败：${e?.message || '请重试'}`);
    } finally {
      setCommentLoading(false);
    }
  };

  // ---- 图片九宫格布局 ----
  const renderImages = (images: string[], maxW: number) => {
    if (!images?.length) return null;
    const n = images.length;
    const total = images.slice(0, 9);
    // 单张=大图；2张=并排；3张=三列；4+ = 3列网格
    const col = n === 2 ? 2 : 3;
    const gap = 6;
    const size = n === 1 ? maxW : (maxW - gap * (col - 1)) / col;
    return (
      <XStack gap={gap} flexWrap="wrap" marginTop={10}>
        {total.map((u, i) => (
          <View key={i}
                width={n === 1 ? size : size}
                height={n === 1 ? Math.min(size * 0.75, 260) : size}
                borderRadius={radius.sm}
                overflow="hidden"
                backgroundColor={colors.surfaceLight}>
            <Image src={fullUrl(u)} width="100%" height="100%" resizeMode="cover" />
          </View>
        ))}
      </XStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <ScreenHeader title="社区" subtitle="分享训练与生活" action={
        <View paddingHorizontal={12} paddingVertical={8} borderRadius={radius.pill}
              backgroundColor={colors.primary} onPress={() => setComposerOpen(true)}>
          <Text fontSize={12} color="#fff" fontWeight="600">＋ 发布</Text>
        </View>
      } />

      {msg && (
        <View paddingHorizontal={16} paddingBottom={4}>
          <Text fontSize={12} color={colors.danger}>{msg}</Text>
        </View>
      )}

      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>
          {loading ? (
            <YStack alignItems="center" padding={30}><Spinner color={colors.primary} /></YStack>
          ) : posts.length === 0 ? (
            <EmptyState icon="" title="还没有动态" description="发布第一条动态：图片、文字、训练打卡都行" />
          ) : (
            posts.map((post) => (
              <Card key={post.post_id}>
                <XStack gap={10} alignItems="center" marginBottom={8}>
                  <View
                    width={40} height={40} borderRadius={radius.pill} backgroundColor={colors.primary}
                    alignItems="center" justifyContent="center" overflow="hidden"
                    onPress={() => openProfile(post)} pressStyle={{ opacity: 0.7 }}
                  >
                    {post.author_avatar ? (
                      <Image src={fullUrl(post.author_avatar)} width="100%" height="100%" resizeMode="cover" />
                    ) : (
                      <Text color="#fff" fontWeight="bold">{post.author?.[0]?.toUpperCase() || 'U'}</Text>
                    )}
                  </View>
                  <YStack flex={1} onPress={() => openProfile(post)} pressStyle={{ opacity: 0.7 }}>
                    <Text fontSize={14} fontWeight="600" color={colors.text}>{post.author}</Text>
                    <Text fontSize={11} color={colors.textMuted}>{post.created_at?.slice(0, 16)}</Text>
                  </YStack>
                  {post.user_id === me?.user_id ? (
                    <Badge text="我的" tone="neutral" />
                  ) : (
                    <XStack gap={6} alignItems="center">
                      <Button
                        {...({ type: 'button' } as any)}
                        height={28}
                        paddingHorizontal={10}
                        borderRadius={radius.pill}
                        backgroundColor={post.followed ? colors.surfaceLight : colors.primary}
                        borderWidth={1}
                        borderColor={post.followed ? colors.border : colors.primary}
                        onPress={() => handleFollow(post)}
                        disabled={followBusy === post.user_id}
                        pressStyle={{ opacity: 0.8 }}
                      >
                        <Text fontSize={11} fontWeight="600" color={post.followed ? colors.textSecondary : '#fff'}>
                          {followBusy === post.user_id ? '…' : post.followed ? '已关注' : '+ 关注'}
                        </Text>
                      </Button>
                      <Button
                        {...({ type: 'button' } as any)}
                        height={28}
                        paddingHorizontal={10}
                        borderRadius={radius.sm}
                        backgroundColor={colors.surfaceLight}
                        borderWidth={1}
                        borderColor={colors.border}
                        onPress={() => openChat(post)}
                        pressStyle={{ opacity: 0.8 }}
                      >
                        <Text fontSize={11} fontWeight="600" color={colors.textSecondary}>私信</Text>
                      </Button>
                    </XStack>
                  )}
                  <Badge text={typeIcon[post.post_type] || post.post_type} tone="primary" />
                </XStack>

                {post.content && (
                  <Text fontSize={14} color={colors.text} lineHeight={20}>{post.content}</Text>
                )}
                {renderImages(post.images || [], 260)}

                {post.stats && (
                  <XStack gap={8} marginTop={10} flexWrap="wrap">
                    {post.stats.duration && <Badge text={`⏱ ${post.stats.duration}分钟`} tone="neutral" />}
                    {post.stats.calories && <Badge text={`${post.stats.calories}kcal`} tone="warning" />}
                  </XStack>
                )}

                <XStack gap={20} marginTop={12} borderTopWidth={1} borderTopColor={colors.border} paddingTop={10}>
                  <XStack gap={4} alignItems="center" onPress={() => handleLike(post)}>
                    <Text fontSize={14} color={post.liked ? '#EF4444' : colors.textSecondary}>
                      {post.liked ? '❤️' : '🤍'}
                    </Text>
                    <Text fontSize={13} color={post.liked ? '#EF4444' : colors.textSecondary}>
                      {post.like_count}
                    </Text>
                  </XStack>
                  <XStack gap={4} alignItems="center" onPress={() => openComments(post)}>
                    <Text fontSize={14} color={colors.textSecondary}>💬</Text>
                    <Text fontSize={13} color={colors.textSecondary}>{post.comment_count}</Text>
                  </XStack>
                </XStack>
              </Card>
            ))
          )}
        </YStack>
      </ScrollView>

      {/* 发布弹窗：文案 + 图片（≤9张） */}
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.5)">
          <YStack backgroundColor={colors.surface} borderTopLeftRadius={radius.xl} borderTopRightRadius={radius.xl} padding={20} gap={12}>
            <Text fontSize={18} fontWeight="bold" color={colors.text}>发布动态</Text>
            <Input
              multiline
              height={90}
              textAlignVertical="top"
              placeholder="分享你的训练感受、生活点滴..."
              value={content}
              onChangeText={setContent}
              backgroundColor={colors.surfaceLight}
              borderRadius={radius.md}
              color={colors.text}
            />

            {/* 图片选择与预览（最多9张） */}
            {pickedImages.length > 0 && (
              <XStack gap={6} flexWrap="wrap">
                {pickedImages.map((img, i) => (
                  <View key={i} width={72} height={72} borderRadius={radius.sm} overflow="hidden" position="relative">
                    <Image src={img.uri} width="100%" height="100%" resizeMode="cover" />
                    <View position="absolute" top={2} right={2} width={20} height={20} borderRadius={10}
                          backgroundColor="rgba(0,0,0,0.6)" alignItems="center" justifyContent="center"
                          onPress={() => removePicked(i)}>
                      <Text fontSize={11} color="#fff">✕</Text>
                    </View>
                  </View>
                ))}
              </XStack>
            )}
            <XStack gap={10}>
              <Button flex={1} variant="outlined" backgroundColor={colors.surfaceLight}
                      onPress={pickImages} disabled={publishing}>
                <Text color={colors.textSecondary}>图片 {pickedImages.length}/9</Text>
              </Button>
              <Button flex={1} variant="outlined" onPress={() => setComposerOpen(false)} disabled={publishing}>
                <Text color={colors.textMuted}>取消</Text>
              </Button>
              <Button flex={2} backgroundColor={colors.primary} onPress={handlePost} disabled={publishing}>
                {publishing
                  ? <Spinner color="#fff" size="small" />
                  : <Text color="#fff" fontWeight="600">发布</Text>}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Modal>

      {/* 评论面板 */}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.5)">
          <YStack backgroundColor={colors.surface} borderTopLeftRadius={radius.xl} borderTopRightRadius={radius.xl}
                height="60%" padding={16} gap={10}>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={16} fontWeight="bold" color={colors.text}>评论 {commentPost?.comment_count || 0}</Text>
              <Text fontSize={14} color={colors.textMuted} onPress={() => setCommentPost(null)}>✕ 关闭</Text>
            </XStack>

            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack gap={12}>
                {comments.length === 0 ? (
                  <Text fontSize={12} color={colors.textMuted} textAlign="center" padding={20}>还没有评论，来抢沙发</Text>
                ) : comments.map((c, i) => (
                  <XStack key={i} gap={8}>
                    <View width={30} height={30} borderRadius={15} backgroundColor={colors.surfaceLight} alignItems="center" justifyContent="center">
                      <Text fontSize={12} color={colors.textSecondary}>{c.author?.[0]?.toUpperCase() || 'U'}</Text>
                    </View>
                    <YStack flex={1}>
                      <Text fontSize={13} fontWeight="600" color={colors.text}>{c.author}</Text>
                      <Text fontSize={13} color={colors.textSecondary} lineHeight={18}>{c.content}</Text>
                      <Text fontSize={10} color={colors.textMuted}>{c.created_at?.slice(0, 16)}</Text>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </ScrollView>

            <XStack gap={8} alignItems="center" borderTopWidth={1} borderTopColor={colors.border} paddingTop={10}>
              <Input
                flex={1}
                height={38}
                fontSize={13}
                paddingHorizontal={10}
                backgroundColor={colors.surfaceLight}
                borderRadius={radius.pill}
                placeholder="友善评论..."
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={sendComment}
                color={colors.text}
              />
              <Button height={38} paddingHorizontal={16} backgroundColor={colors.primary} onPress={sendComment} disabled={commentLoading || !commentText.trim()}>
                {commentLoading ? <Spinner color="#fff" size="small" /> : <Text color="#fff" fontSize={13} fontWeight="600">发送</Text>}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Modal>
    </YStack>
  );
}

export default CommunityScreen;
