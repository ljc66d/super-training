// 我的运动管理页 —— 管理用户自定义运动种类（增删）
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Button, Input, Text, YStack, XStack, ScrollView, Spinner, View } from 'tamagui';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { colors, radius } from '../theme/tokens';

export function MyCustomSportsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.getCustomSports();
      setList(d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.addCustomSport(name);
      setNewName('');
      load();
    } catch (e: any) {
      alert(e?.message || '保存失败');
    }
  };

  const handleDelete = (sport: any) => {
    const doDelete = async () => {
      try {
        await api.deleteCustomSport(sport.custom_sport_id);
        setList((prev) => prev.filter((s) => s.custom_sport_id !== sport.custom_sport_id));
      } catch (e: any) {
        alert(e?.message || '删除失败');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除「${sport.sport_name}」吗？`)) doDelete();
    } else {
      Alert.alert('删除运动', `确定删除「${sport.sport_name}」吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="我的运动" subtitle="自定义运动种类" onBack={() => navigation.goBack()} />

      {/* 新增 */}
      <View padding={16} paddingBottom={8}>
        <XStack gap={8}>
          <Input
            flex={1}
            value={newName}
            onChangeText={setNewName}
            placeholder="新增运动名称，如 攀岩"
            backgroundColor={colors.surface}
            borderRadius={radius.md}
            color={colors.text}
          />
          <Button
            backgroundColor={colors.primary}
            borderRadius={radius.md}
            onPress={handleAdd}
            disabled={!newName.trim()}
            pressStyle={{ opacity: 0.8 }}
          >
            <Text color="#fff" fontWeight="600">添加</Text>
          </Button>
        </XStack>
      </View>

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color={colors.primary} />
        </YStack>
      ) : list.length === 0 ? (
        <EmptyState title="还没有自定义运动" description="在训练页「自定义」里新增，或在上方输入添加" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
          {list.map((s) => (
            <View
              key={s.custom_sport_id}
              backgroundColor={colors.surface}
              borderRadius={radius.md}
              borderWidth={1}
              borderColor={colors.border}
              padding={12}
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <XStack gap={8} alignItems="center">
                <Badge text={s.sport_name} tone="primary" />
              </XStack>
              <Button
                height={30}
                paddingHorizontal={12}
                borderRadius={radius.md}
                backgroundColor={colors.dangerSoft}
                onPress={() => handleDelete(s)}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text color={colors.danger} fontWeight="600" fontSize={12}>删除</Text>
              </Button>
            </View>
          ))}
        </ScrollView>
      )}
    </YStack>
  );
}

export default MyCustomSportsScreen;
