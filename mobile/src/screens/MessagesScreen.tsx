// 私信聊天页 —— 会话列表 + 聊天窗口二合一
// 用法：<Messages /> 显示会话列表；<Messages user={{user_id, nickname}} /> 直接打开与 TA 的聊天
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Button, Image, Input, ScrollView, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';
import { fullUrl } from '../utils/url';

interface Conv {
  user: { user_id: string; nickname: string; avatar?: string | null };
  last_message: string;
  last_time: string;
  unread_count: number;
}

interface Msg {
  message_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export function MessagesScreen({ navigation, route }: any) {
  const { user: me } = useAuth();
  const direct = route?.params?.user as { user_id: string; nickname: string } | undefined;

  // 会话列表
  const [convs, setConvs] = useState<Conv[]>([]);
  // 聊天窗口
  const [chatWith, setChatWith] = useState<{ user_id: string; nickname: string } | null>(direct || null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // 搜索加好友
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const copyUid = async (uid: string) => {
    if (!uid) return;
    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(uid);
        } else {
          // HTTP 非安全上下文：降级到 execCommand（兼容旧浏览器/HTTP）
          const ta = document.createElement('textarea');
          ta.value = uid;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } else {
        setMsg('请长按复制 ID');
        return;
      }
      setMsg(`已复制 ID：${uid}`);
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg('复制失败');
    }
  };

  const loadConvs = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConvs(data || []);
    } catch (e: any) {
      console.warn('conversations fail', e?.message);
    }
  }, []);

  const loadMessages = useCallback(async (otherId: string) => {
    setLoading(true);
    try {
      const data = await api.getMessages(otherId);
      setMessages(data?.messages || []);
    } catch (e: any) {
      setMsg(`消息加载失败：${e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const openChat = (u: { user_id: string; nickname: string }) => {
    setChatWith(u);
    setMsg(null);
  };

  useEffect(() => {
    if (chatWith) {
      loadMessages(chatWith.user_id);
      // 消息加载后滚动到底部
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } else {
      loadConvs();
    }
  }, [chatWith, loadMessages, loadConvs]);

  // 进入/返回时刷新未读
  useEffect(() => {
    const sub = navigation?.addListener?.('focus', () => {
      if (!chatWith) loadConvs();
    });
    return sub as any;
  }, [navigation, chatWith, loadConvs]);

  const send = async () => {
    const t = input.trim();
    if (!t || !chatWith || sending) return;
    setSending(true);
    setMsg(null);
    try {
      await api.sendMessage(chatWith.user_id, t);
      setInput('');
      await loadMessages(chatWith.user_id);  // 重新拉取，简单可靠
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      setMsg(e?.message || '发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  // ---------- 聊天窗口模式 ----------
  if (chatWith) {
    return (
      <YStack flex={1} backgroundColor={colors.background}>
        <BackHeader
          title={chatWith.nickname}
          subtitle="私信聊天"
          onBack={() => {
            if (direct) navigation?.goBack();
            else { setChatWith(null); loadConvs(); }
          }}
        />
        {msg && (
          <View backgroundColor="rgba(239,68,68,0.12)" borderRadius={radius.sm} padding={8} marginHorizontal={12} marginTop={4}>
            <Text fontSize={11} color={colors.danger}>{msg}</Text>
          </View>
        )}
        {loading ? (
          <YStack flex={1} alignItems="center" justifyContent="center"><Spinner color={colors.primary} /></YStack>
        ) : (
          <ScrollView
            ref={scrollRef}
            flex={1}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <Text fontSize={12} color={colors.textMuted} textAlign="center" padding={24}>
                还没有消息，打个招呼吧 
              </Text>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === me?.user_id;
              return (
                <XStack key={m.message_id} justifyContent={mine ? 'flex-end' : 'flex-start'}>
                  <View
                    maxWidth="78%"
                    backgroundColor={mine ? colors.primary : colors.surfaceLight}
                    borderRadius={14}
                    borderBottomRightRadius={mine ? 4 : 14}
                    borderBottomLeftRadius={mine ? 14 : 4}
                    paddingHorizontal={12}
                    paddingVertical={8}
                  >
                    <Text fontSize={13} lineHeight={19} color={mine ? '#fff' : colors.text}>
                      {m.content}
                    </Text>
                    <Text fontSize={9} color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted} marginTop={3} textAlign="right">
                      {m.created_at?.slice(11, 16)}
                    </Text>
                  </View>
                </XStack>
              );
            })}
          </ScrollView>
        )}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <XStack gap={8} padding={12} borderTopWidth={1} borderTopColor={colors.border} backgroundColor={colors.surface}>
            <View flex={1} backgroundColor={colors.surfaceLight} borderRadius={radius.pill} paddingHorizontal={14} justifyContent="center">
              <TextInput
                style={{ width: '100%', height: 40, color: colors.text, fontSize: 14 }}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                returnKeyType="send"
                placeholder="输入消息…"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Button
              {...({ type: 'button' } as any)}
              backgroundColor={colors.primary}
              borderRadius={radius.pill}
              paddingHorizontal={18}
              onPress={send}
              disabled={sending || !input.trim()}
              pressStyle={{ opacity: 0.8 }}
            >
              <Text color="#fff" fontWeight="700">{sending ? '…' : '发送'}</Text>
            </Button>
          </XStack>
        </KeyboardAvoidingView>
      </YStack>
    );
  }

  // ---------- 会话列表模式 ----------
  const canGoBack = navigation?.canGoBack?.() ?? false;
  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader
        title="私信"
        subtitle="与伙伴们聊聊"
        hideBack={!canGoBack}
        onBack={() => navigation?.goBack()}
      />

      {/* 搜索 ID / 用户名 加好友 */}
      <YStack paddingHorizontal={16} paddingTop={8} gap={8}>
        <XStack gap={8}>
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
            gap={10}
            alignItems="center"
            backgroundColor={colors.surface}
            borderRadius={radius.md}
            padding={12}
            borderWidth={1}
            borderColor={colors.border}
          >
            <View width={42} height={42} borderRadius={21} backgroundColor={colors.primary} alignItems="center" justifyContent="center" overflow="hidden">
              {searchResult.avatar_url ? (
                <Image src={fullUrl(searchResult.avatar_url)} width="100%" height="100%" resizeMode="cover" />
              ) : (
                <Text color="#fff" fontWeight="bold">{searchResult.nickname?.[0]?.toUpperCase() || 'U'}</Text>
              )}
            </View>
            <YStack flex={1} gap={2}>
              <Text fontSize={14} fontWeight="600" color={colors.text}>{searchResult.nickname}</Text>
              <XStack gap={8} alignItems="center">
                <Text fontSize={11} color={colors.textMuted}>ID：{searchResult.uid || '—'}</Text>
                <Button
                  {...({ type: 'button' } as any)}
                  height={22}
                  paddingHorizontal={8}
                  borderRadius={radius.pill}
                  backgroundColor={colors.surfaceLight}
                  borderWidth={1}
                  borderColor={colors.primary}
                  onPress={() => copyUid(searchResult.uid)}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text fontSize={10} color={colors.primary}>复制</Text>
                </Button>
              </XStack>
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
      </YStack>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {convs.length === 0 ? (
          <Text fontSize={12} color={colors.textMuted} textAlign="center" padding={30}>
            还没有聊天记录
            {'\n'}去社区看看伙伴们的动态，点作者旁的 发起私信
          </Text>
        ) : convs.map((c, i) => (
          <XStack
            key={c.user.user_id}
            gap={10}
            alignItems="center"
            backgroundColor={colors.surface}
            borderRadius={radius.md}
            padding={12}
            borderWidth={1}
            borderColor={colors.border}
            onPress={() => openChat(c.user)}
            pressStyle={{ opacity: 0.7 }}
          >
            <View width={42} height={42} borderRadius={21} backgroundColor={colors.primary} alignItems="center" justifyContent="center" overflow="hidden">
              {c.user.avatar ? (
                <Image src={fullUrl(c.user.avatar)} width="100%" height="100%" resizeMode="cover" />
              ) : (
                <Text color="#fff" fontWeight="bold">{c.user.nickname?.[0]?.toUpperCase() || 'U'}</Text>
              )}
            </View>
            <YStack flex={1} gap={2}>
              <XStack alignItems="center" gap={6}>
                <Text fontSize={14} fontWeight="600" color={colors.text}>{c.user.nickname}</Text>
                {c.unread_count > 0 && (
                  <View backgroundColor={colors.danger} borderRadius={radius.pill} paddingHorizontal={6} paddingVertical={1}>
                    <Text fontSize={10} color="#fff" fontWeight="700">{c.unread_count}</Text>
                  </View>
                )}
              </XStack>
              <Text fontSize={12} color={colors.textMuted} numberOfLines={1}>{c.last_message}</Text>
            </YStack>
            <Text fontSize={10} color={colors.textMuted}>{c.last_time?.slice(5, 16)}</Text>
          </XStack>
        ))}
      </ScrollView>
    </YStack>
  );
}

export default MessagesScreen;
