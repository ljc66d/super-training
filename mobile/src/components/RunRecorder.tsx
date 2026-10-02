// 跑步记录组件 —— 长跑（手动输入距离/时间/心率）或自定义分组（每组距离+成绩+组间歇）
// 数据手动输入；训练正计时（开始/结束复用全局计时）
import React from 'react';
import { Button, Input, Text, XStack, YStack, Spinner } from 'tamagui';

import { Card } from './Card';
import { SegmentedControl } from './SegmentedControl';
import { colors, radius } from '../theme/tokens';
import { RunMode, useTraining } from '../context/TrainingContext';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RUN_MODES: { key: RunMode; label: string }[] = [
  { key: 'long', label: '单次长距离' },
  { key: 'custom', label: '自定义' },
];

export function RunRecorder() {
  const {
    started, elapsed, start, stop, saving,
    runMode, setRunMode, longRun, setLongRun, runGroups, setRunGroups, completeRunGroup,
    runGroupAvgHr, setRunGroupAvgHr, runGroupMaxHr, setRunGroupMaxHr,
    category,
  } = useTraining();

  const sportMeta: Record<string, string> = {
    '跑步': '跑步记录',
    '骑行': '骑行记录',
    '游泳': '游泳记录',
    '徒步': '徒步记录',
  };
  const meta = sportMeta[category] || '跑步记录';
  // 徒步只有单次长距离，不显示「单次长距离/自定义」切换
  const showModeSwitch = category !== '徒步';

  const patchLongRun = (partial: Partial<typeof longRun>) =>
    setLongRun((prev) => ({ ...prev, ...partial }));

  const addGroup = () => {
    setRunGroups((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), distance: '', timeSec: '', restSec: '', done: false },
    ]);
  };
  const patchGroup = (id: string, partial: Partial<{ distance: string; timeSec: string; restSec: string }>) => {
    setRunGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...partial } : g)));
  };
  const removeGroup = (id: string) => {
    setRunGroups((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <Card title={meta} accent="primary">
      <YStack gap={10}>
        {showModeSwitch && (
          <SegmentedControl
            options={RUN_MODES}
            value={runMode}
            onChange={(k) => setRunMode(k as RunMode)}
          />
        )}

        {/* 长跑：距离 + 时间 + 心率 */}
        {(showModeSwitch ? runMode : 'long') === 'long' ? (
          <YStack gap={8}>
            <XStack gap={8}>
              <YStack flex={1} gap={4}>
                <Text fontSize={11} color={colors.textMuted}>距离(km)</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="5"
                  value={longRun.distance}
                  onChangeText={(v) => patchLongRun({ distance: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
              <YStack flex={1} gap={4}>
                <Text fontSize={11} color={colors.textMuted}>时间(分钟)</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="30"
                  value={longRun.timeMin}
                  onChangeText={(v) => patchLongRun({ timeMin: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
            </XStack>
            <XStack gap={8}>
              <YStack flex={1} gap={4}>
                <Text fontSize={11} color={colors.textMuted}>最高心率</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="180"
                  value={longRun.maxHr}
                  onChangeText={(v) => patchLongRun({ maxHr: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
              <YStack flex={1} gap={4}>
                <Text fontSize={11} color={colors.textMuted}>平均心率</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="150"
                  value={longRun.avgHr}
                  onChangeText={(v) => patchLongRun({ avgHr: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
            </XStack>
            {(category === '跑步' || category === '骑行' || category === '徒步') && (
              <YStack gap={4}>
                <Text fontSize={11} color={colors.textMuted}>爬升(米)</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="累计爬升，如 150"
                  value={longRun.climb}
                  onChangeText={(v) => patchLongRun({ climb: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
            )}
          </YStack>
        ) : (
          <YStack gap={8}>
            <Text fontSize={12} color={colors.textMuted}>
              自定义分组：每组填写距离 + 成绩（秒）+ 组间歇（秒）
            </Text>
            {/* 平均/最高心率（可选，用于热量计算：有平均心率走整体心率法，无则按每组成绩拆分估算） */}
            <XStack gap={8}>
              <YStack flex={1} gap={4}>
                <Text fontSize={11} color={colors.textMuted}>平均心率 (可选)</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="160"
                  value={runGroupAvgHr}
                  onChangeText={(v) => setRunGroupAvgHr(v.replace(/[^\d.]/g, ''))}
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
                  value={runGroupMaxHr}
                  onChangeText={(v) => setRunGroupMaxHr(v.replace(/[^\d.]/g, ''))}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
              </YStack>
            </XStack>
            {runGroups.length === 0 && (
              <Text fontSize={12} color={colors.textMuted} textAlign="center" paddingVertical={8}>
                还没有分组，点下方「＋ 添加分组」
              </Text>
            )}
            {runGroups.map((g, i) => (
              <YStack
                key={g.id}
                backgroundColor={g.done ? colors.successSoft : colors.surfaceLight}
                borderRadius={radius.md}
                padding={10}
                gap={6}
                borderWidth={1}
                borderColor={g.done ? colors.success : colors.border}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={13} fontWeight="700" color={colors.text}>第 {i + 1} 组</Text>
                  <XStack gap={6} alignItems="center">
                    {started && (
                      <Button
                        size="$2"
                        height={32}
                        paddingHorizontal={10}
                        backgroundColor={g.done ? colors.success : colors.primary}
                        onPress={() => completeRunGroup(g.id)}
                        disabled={g.done}
                      >
                        <Text fontSize={12} color="#fff" fontWeight="600">{g.done ? '✓ 已完成' : '完成'}</Text>
                      </Button>
                    )}
                    {!started && (
                      <Button size="$2" theme="red" onPress={() => removeGroup(g.id)}>
                        <Text fontSize={12} color={colors.danger}>删除</Text>
                      </Button>
                    )}
                  </XStack>
                </XStack>
                <XStack gap={8}>
                  <YStack flex={1} gap={4}>
                    <Text fontSize={11} color={colors.textMuted}>距离(米)</Text>
                    <Input
                      keyboardType="numeric"
                      placeholder="400"
                      value={g.distance}
                      onChangeText={(v) => patchGroup(g.id, { distance: v })}
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                  </YStack>
                  <YStack flex={1} gap={4}>
                    <Text fontSize={11} color={colors.textMuted}>成绩(秒)</Text>
                    <Input
                      keyboardType="numeric"
                      placeholder="90"
                      value={g.timeSec}
                      onChangeText={(v) => patchGroup(g.id, { timeSec: v })}
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                  </YStack>
                  <YStack flex={1} gap={4}>
                    <Text fontSize={11} color={colors.textMuted}>组间歇(秒)</Text>
                    <Input
                      keyboardType="numeric"
                      placeholder="60"
                      value={g.restSec}
                      onChangeText={(v) => patchGroup(g.id, { restSec: v })}
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                  </YStack>
                </XStack>
              </YStack>
            ))}
            <Button
              backgroundColor={colors.surfaceLight}
              borderRadius={radius.md}
              borderWidth={1}
              borderColor={colors.border}
              onPress={addGroup}
            >
              <Text color={colors.text} fontWeight="600">＋ 添加分组</Text>
            </Button>
          </YStack>
        )}

        {/* 开始 / 结束（正计时） */}
        {!started ? (
          <Button
            backgroundColor={colors.primary}
            borderRadius={radius.md}
            size="$4"
            width="100%"
            onPress={start}
          >
            <Text color="#fff" fontWeight="700" fontSize={16}>▶ 开始训练</Text>
          </Button>
        ) : (
          <YStack gap={8}>
            <YStack alignItems="center" paddingVertical={6} gap={4}>
              <Text fontSize={11} color={colors.textMuted}>⏱ {category}计时</Text>
              <Text fontSize={44} fontWeight="bold" color={colors.text} fontVariant={['tabular-nums']}>
                {fmt(elapsed)}
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

export default RunRecorder;
