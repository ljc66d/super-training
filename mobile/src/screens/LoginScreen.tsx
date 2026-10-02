// 登录/注册页面
import React, { useState } from 'react';
import { Button, Image, Input, Text, YStack, XStack, View } from 'tamagui';

import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, nickname || undefined);
      }
    } catch (e: any) {
      setError(e.message === 'UNAUTHORIZED' ? '用户名或密码错误' : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor={colors.background} justifyContent="center" padding={24}>
      {/* Logo */}
      <YStack alignItems="center" gap={10} marginBottom={32}>
        <Image
          source={require('../../assets/logo.jpg')}
          width={200}
          height={200}
          resizeMode="contain"
        />
        <Text fontSize={30} fontWeight="bold" color={colors.text}>超会练</Text>
        <Text fontSize={14} color={colors.textMuted}>训练数据管理</Text>
      </YStack>

      <YStack gap={12}>
        {mode === 'register' && (
          <Input
            size="$4"
            placeholder="昵称（可选）"
            value={nickname}
            onChangeText={setNickname}
            backgroundColor={colors.surface}
            borderRadius={radius.md}
            borderColor={colors.border}
            color={colors.text}
          />
        )}
        <Input
          size="$4"
          placeholder="用户名"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          backgroundColor={colors.surface}
          borderRadius={radius.md}
          borderColor={colors.border}
          color={colors.text}
        />
        <Input
          size="$4"
          placeholder="密码（至少6位）"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          backgroundColor={colors.surface}
          borderRadius={radius.md}
          borderColor={colors.border}
          color={colors.text}
        />
        {error ? <Text color={colors.danger} fontSize={13}>{error}</Text> : null}

        <Button
          size="$5"
          backgroundColor={colors.primary}
          borderRadius={radius.md}
          onPress={handleSubmit}
          disabled={loading}
          marginTop={8}
        >
          <Text color="#fff" fontWeight="700" fontSize={16}>
            {loading ? '请稍候...' : mode === 'login' ? '登 录' : '注 册'}
          </Text>
        </Button>
      </YStack>

      <XStack justifyContent="center" gap={4} marginTop={20}>
        <Text fontSize={13} color={colors.textMuted}>
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
        </Text>
        <Text
          fontSize={13}
          color={colors.primary}
          fontWeight="600"
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? '立即注册' : '去登录'}
        </Text>
      </XStack>
    </YStack>
  );
}

export default LoginScreen;
