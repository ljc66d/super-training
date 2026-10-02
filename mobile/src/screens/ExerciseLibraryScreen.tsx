// 动作库浏览页面 —— 按训练主题分组浏览全部动作
// 点＋连续多选，最后统一返回训练页
import React, { useEffect, useState } from 'react';
import { Button, Image, Text, YStack, XStack, ScrollView, View, Input, Spinner } from 'tamagui';

import { api, API_BASE_URL } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { colors, radius } from '../theme/tokens';

// gif 完整URL：gif_url 存的是相对路径 videos/xxx.gif，后端已挂载 /videos 静态目录
const GIF_BASE = API_BASE_URL.replace('/api/v1', '');

// 训练主题分组（内置，避免接口失败导致无法切换）
const DEFAULT_GROUPS = [
  { key: 'chest', label: '胸', icon: '' },
  { key: 'back', label: '背', icon: '' },
  { key: 'arms', label: '手', icon: '' },
  { key: 'shoulder', label: '肩', icon: '' },
  { key: 'legs', label: '腿', icon: '' },
  { key: 'core', label: '核心', icon: '' },
  { key: 'bodyweight', label: '徒手', icon: '' },
  { key: 'coordination', label: '协调性', icon: '' },
  { key: 'flexibility', label: '灵活性', icon: '' },
];

export function ExerciseLibraryScreen({ navigation, route }: any) {
  const [groups, setGroups] = useState<any[]>(DEFAULT_GROUPS);
  const [groupKey, setGroupKey] = useState<string>('chest');
  const [kw, setKw] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<any[]>([]);

  // 用后端分组列表覆盖内置（可选，失败不影响）
  useEffect(() => {
    api.getExerciseGroups().then((g) => {
      if (g?.length) setGroups(g);
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getExercises(kw || undefined, undefined, 500, groupKey);
      setList(data || []);
    } catch (e: any) {
      console.warn(e.message);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupKey) load();
  }, [groupKey]);

  useEffect(() => {
    if (!kw.trim()) return;
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [kw]);

  // 点＋加入已选（去重）
  const addPick = (ex: any) => {
    setPicked((prev) => {
      if (prev.some((p) => p.exercise_id === ex.exercise_id)) return prev;
      return [...prev, { name: ex.name_zh || ex.name, exercise_id: ex.exercise_id }];
    });
  };

  // 完成选择：带已选动作返回训练页
  const finish = () => {
    if (picked.length > 0) {
      navigation.navigate('Training', { pickedList: picked });
    } else {
      navigation.goBack();
    }
  };

  const currentGroup = groups.find((g) => g.key === groupKey);

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="动作库" subtitle={`${currentGroup?.icon || ''} ${currentGroup?.label || ''} · ${list.length} 个动作`} onBack={() => navigation.goBack()} />

      <View paddingHorizontal={16} paddingBottom={8}>
        <Input
          value={kw}
          onChangeText={setKw}
          placeholder="搜索动作（中文/英文）"
          backgroundColor={colors.surfaceLight}
          borderRadius={radius.md}
          color={colors.text}
        />
      </View>

      {/* 训练主题分组：自动换行 Button chips（web端可靠触发） */}
      <View paddingHorizontal={16} marginBottom={8}>
        <XStack gap={8} flexWrap="wrap">
          {groups.map((g) => {
            const active = groupKey === g.key;
            return (
              <Button
                key={g.key}
                paddingHorizontal={14}
                paddingVertical={0}
                height={34}
                borderRadius={radius.pill}
                backgroundColor={active ? colors.primary : colors.surfaceLight}
                borderWidth={0}
                onPress={() => setGroupKey(g.key)}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text fontSize={12} fontWeight="600" color={active ? '#fff' : colors.textSecondary}>
                  {g.icon} {g.label}
                </Text>
              </Button>
            );
          })}
        </XStack>
      </View>

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center"><Spinner size="large" color={colors.primary} /></YStack>
      ) : (
        <ScrollView paddingHorizontal={16} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <YStack gap={8}>
            {list.length === 0 && (
              <Text fontSize={13} color={colors.textMuted} textAlign="center" paddingTop={40}>该分类下暂无动作</Text>
            )}
            {list.map((ex) => {
              const display = ex.name_zh || ex.name;
              const gifUrl = ex.gif_url ? `${GIF_BASE}/${ex.gif_url}` : null;
              const isPicked = picked.some((p) => p.exercise_id === ex.exercise_id);
              return (
                <View
                  key={ex.exercise_id}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  borderWidth={1}
                  borderColor={isPicked ? colors.primary : colors.border}
                  padding={12}
                >
                  <XStack justifyContent="space-between" alignItems="center" gap={10}>
                    {/* 动作GIF演示 */}
                    {gifUrl && (
                      <View
                        width={64}
                        height={64}
                        borderRadius={radius.sm}
                        overflow="hidden"
                        backgroundColor={colors.surfaceLight}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Image
                          source={{ uri: gifUrl }}
                          width={64}
                          height={64}
                          resizeMode="cover"
                          onError={(e: any) => { (e.currentTarget as any).style.display = 'none'; }}
                        />
                      </View>
                    )}
                    <YStack flex={1} gap={2}>
                      <Text fontSize={14} fontWeight="600" color={colors.text}>{display}</Text>
                      {ex.name_zh && ex.name !== ex.name_zh && (
                        <Text fontSize={11} color={colors.textMuted}>{ex.name}</Text>
                      )}
                      <XStack gap={6} marginTop={4} flexWrap="wrap">
                        {ex.target_muscle && (
                          <View backgroundColor={colors.surfaceLight} paddingHorizontal={8} paddingVertical={2} borderRadius={radius.pill}>
                            <Text fontSize={10} color={colors.textSecondary}>{ex.target_muscle}</Text>
                          </View>
                        )}
                        {ex.equipment && (
                          <View backgroundColor={colors.surfaceLight} paddingHorizontal={8} paddingVertical={2} borderRadius={radius.pill}>
                            <Text fontSize={10} color={colors.textSecondary}>{ex.equipment}</Text>
                          </View>
                        )}
                      </XStack>
                    </YStack>
                    {/* 历史记录 + 加入训练 */}
                    <XStack gap={8} alignItems="center">
                      <Button
                        height={36}
                        paddingHorizontal={12}
                        borderRadius={radius.md}
                        backgroundColor={colors.surfaceLight}
                        borderWidth={1}
                        borderColor={colors.border}
                        onPress={() => navigation.navigate('ExerciseHistory', { name: display })}
                        pressStyle={{ opacity: 0.7 }}
                      >
                        <Text fontSize={12} color={colors.textSecondary} fontWeight="600">历史记录</Text>
                      </Button>
                      <Button
                        width={36}
                        height={36}
                        padding={0}
                        borderRadius={radius.md}
                        backgroundColor={isPicked ? colors.success : colors.primary}
                        onPress={() => addPick(ex)}
                        pressStyle={{ opacity: 0.7 }}
                      >
                        <Text fontSize={16} color="#fff" fontWeight="700">{isPicked ? '✓' : '＋'}</Text>
                      </Button>
                    </XStack>
                  </XStack>
                </View>
              );
            })}
          </YStack>
        </ScrollView>
      )}

      {/* 底部已选栏 + 完成选择 */}
      {picked.length > 0 && (
        <View
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          backgroundColor={colors.surface}
          borderTopWidth={1}
          borderTopColor={colors.border}
          padding={12}
        >
          <XStack gap={10} alignItems="center">
            <YStack flex={1}>
              <Text fontSize={13} fontWeight="600" color={colors.text}>已选 {picked.length} 个动作</Text>
              <Text fontSize={11} color={colors.textMuted} numberOfLines={1}>{picked.map((p) => p.name).join('、')}</Text>
            </YStack>
            <Button backgroundColor={colors.primary} borderRadius={radius.md} onPress={finish}>
              <Text color="#fff" fontWeight="700">完成选择 →</Text>
            </Button>
          </XStack>
        </View>
      )}
    </YStack>
  );
}

export default ExerciseLibraryScreen;
