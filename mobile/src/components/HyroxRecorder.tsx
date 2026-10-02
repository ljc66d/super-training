// Hyrox 记录组件 —— 用户自定义分段（段数自由增删），每段选择动作 + 填写次数/距离 + 描述
// 标准 16 段赛程作为可选模板（"加载标准赛程"一键填充）；训练正计时，逐段勾选完成
import React from 'react';
import { Button, Input, Text, XStack, YStack, Spinner } from 'tamagui';

import { Card } from './Card';
import { colors, radius } from '../theme/tokens';
import { HyroxStation, useTraining, presetHyroxStations } from '../context/TrainingContext';

interface Props {
  navigation?: any;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HyroxRecorder({ navigation }: Props) {
  const {
    started, elapsed, start, stop, saving,
    hyroxStations, setHyroxStations, setHyroxEditingId,
    metconAvgHr, setMetconAvgHr, metconMaxHr, setMetconMaxHr,
  } = useTraining();

  const patchStation = (id: string, partial: Partial<HyroxStation>) => {
    setHyroxStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const addStation = () => {
    setHyroxStations((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: '',
        metric: '',
        weight_kg: '',
        description: undefined,
        exerciseId: undefined,
        source: undefined,
        done: false,
      },
    ]);
  };

  const removeStation = (id: string) => {
    setHyroxStations((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleDone = (id: string) => {
    setHyroxStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  };

  const loadTemplate = () => {
    setHyroxStations(presetHyroxStations());
  };

  const pickFromLibrary = (id: string) => {
    setHyroxEditingId(id);
    navigation?.navigate('ExerciseLibrary');
  };

  const doneCount = hyroxStations.filter((s) => s.done).length;

  return (
    <Card title="Hyrox 赛程" accent="success">
      <YStack gap={10}>
        <Text fontSize={12} color={colors.textMuted}>
          自定义分段：每段选择动作（动作库/手动输入）+ 填写次数或距离，训练时逐段完成（正计时）
        </Text>

        {hyroxStations.length === 0 && (
          <Text fontSize={12} color={colors.textMuted} textAlign="center" paddingVertical={12}>
            还没有分段，点下方「添加分段」或「加载标准赛程」
          </Text>
        )}

        {hyroxStations.map((s, i) => (
          <YStack
            key={s.id}
            backgroundColor={s.done ? colors.successSoft : colors.surfaceLight}
            borderRadius={radius.md}
            padding={10}
            gap={6}
            borderWidth={1}
            borderColor={s.done ? colors.success : colors.border}
          >
            <XStack justifyContent="space-between" alignItems="center" gap={8}>
              <XStack alignItems="center" gap={6} flex={1}>
                <Text fontSize={13} fontWeight="700" color={colors.textMuted}>{i + 1}.</Text>
                {s.source === 'public' ? <Text fontSize={13}></Text> : s.source === 'private' ? <Text fontSize={13}></Text> : null}
                {started ? (
                  <Text fontSize={13} fontWeight="600" color={colors.text} flex={1} numberOfLines={2}>
                    {s.name || '未命名分段'}
                  </Text>
                ) : (
                  <Input
                    flex={1}
                    value={s.name}
                    onChangeText={(v) => patchStation(s.id, { name: v })}
                    placeholder="动作/站名（必填）"
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                  />
                )}
              </XStack>
              <XStack gap={6} alignItems="center">
                {started ? (
                  <Button
                    height={34}
                    paddingHorizontal={12}
                    backgroundColor={s.done ? colors.success : colors.surfaceLight}
                    borderRadius={radius.md}
                    onPress={() => toggleDone(s.id)}
                  >
                    <Text color={s.done ? '#fff' : colors.textSecondary} fontWeight="700">
                      {s.done ? '✓ 完成' : '完成'}
                    </Text>
                  </Button>
                ) : (
                  <>
                    <Button
                      size="$2"
                      height={32}
                      paddingHorizontal={10}
                      backgroundColor={colors.surface}
                      borderWidth={1}
                      borderColor={colors.primary}
                      onPress={() => pickFromLibrary(s.id)}
                    >
                      <Text fontSize={12} color={colors.primary} fontWeight="600">动作库</Text>
                    </Button>
                    <Button size="$2" height={32} theme="red" onPress={() => removeStation(s.id)}>
                      <Text fontSize={12} color={colors.danger}>删除</Text>
                    </Button>
                  </>
                )}
              </XStack>
            </XStack>

            {!started ? (
              <>
                <XStack gap={6}>
                  <Input
                    flex={1}
                    keyboardType="numeric"
                    value={s.weight_kg || ''}
                    onChangeText={(v) => patchStation(s.id, { weight_kg: v })}
                    placeholder="重量kg（可选）"
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                  />
                  <Input
                    flex={1}
                    value={s.metric}
                    onChangeText={(v) => patchStation(s.id, { metric: v })}
                    placeholder="次数/距离，如 1000米 或 100次"
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                  />
                </XStack>
                <Input
                  value={s.description || ''}
                  onChangeText={(v) => patchStation(s.id, { description: v })}
                  placeholder="描述（可选，如动作要领）"
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </>
            ) : (
              <XStack gap={6}>
                {s.weight_kg ? (
                  <Text fontSize={12} color={colors.textSecondary}>{s.weight_kg}kg</Text>
                ) : null}
                {s.metric ? (
                  <Text fontSize={12} color={colors.textSecondary}>{s.metric}</Text>
                ) : null}
              </XStack>
            )}
          </YStack>
        ))}

        {/* 操作按钮 */}
        {!started && (
          <XStack gap={8}>
            <Button
              flex={1}
              backgroundColor={colors.surfaceLight}
              borderRadius={radius.md}
              borderWidth={1}
              borderColor={colors.border}
              onPress={addStation}
            >
              <Text color={colors.text} fontWeight="600">＋ 添加分段</Text>
            </Button>
            <Button
              flex={1}
              backgroundColor={colors.surfaceLight}
              borderRadius={radius.md}
              borderWidth={1}
              borderColor={colors.border}
              onPress={loadTemplate}
            >
              <Text color={colors.text} fontWeight="600">加载标准赛程</Text>
            </Button>
          </XStack>
        )}

        {/* 心率（可选，用于热量计算） */}
        <XStack gap={8}>
          <YStack flex={1} gap={4}>
            <Text fontSize={11} color={colors.textMuted}>平均心率 (可选)</Text>
            <Input
              keyboardType="numeric"
              placeholder="155"
              value={metconAvgHr}
              onChangeText={(v) => setMetconAvgHr(v.replace(/[^\d.]/g, ''))}
              backgroundColor={colors.surface}
              borderRadius={radius.md}
              color={colors.text}
            />
          </YStack>
          <YStack flex={1} gap={4}>
            <Text fontSize={11} color={colors.textMuted}>最高心率 (可选)</Text>
            <Input
              keyboardType="numeric"
              placeholder="185"
              value={metconMaxHr}
              onChangeText={(v) => setMetconMaxHr(v.replace(/[^\d.]/g, ''))}
              backgroundColor={colors.surface}
              borderRadius={radius.md}
              color={colors.text}
            />
          </YStack>
        </XStack>

        {/* 开始 / 结束 */}
        {!started ? (
          <Button
            backgroundColor={colors.primary}
            borderRadius={radius.md}
            size="$4"
            width="100%"
            onPress={start}
            disabled={hyroxStations.length === 0}
          >
            <Text color="#fff" fontWeight="700" fontSize={16}>▶ 开始 Hyrox 训练</Text>
          </Button>
        ) : (
          <YStack gap={8}>
            {/* 正计时 + 完成进度 */}
            <YStack alignItems="center" paddingVertical={6} gap={4}>
              <Text fontSize={11} color={colors.textMuted}>⏱ Hyrox 正计时</Text>
              <Text fontSize={44} fontWeight="bold" color={colors.text} fontVariant={['tabular-nums']}>
                {fmt(elapsed)}
              </Text>
              <Text fontSize={12} color={colors.textSecondary}>
                进度：{doneCount}/{hyroxStations.length} 段完成
              </Text>
            </YStack>
            <Button
              backgroundColor={colors.danger}
              borderRadius={radius.md}
              size="$4"
              width="100%"
              onPress={stop}
              disabled={saving}
            >
              {saving ? <Spinner color="white" /> : <Text color="#fff" fontWeight="700" fontSize={16}>■ 结束训练并保存</Text>}
            </Button>
          </YStack>
        )}
      </YStack>
    </Card>
  );
}

export default HyroxRecorder;
