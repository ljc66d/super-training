// CrossFit 记录组件 —— WOD（技能/力量部分在 CrossFit 模式下隐藏，由 TrainingScreen 控制）
// WOD 模式：AMRAP 限时做轮、EMOM 每分钟固定动作、Chipper 一次做完记总时长
// 动作明细：支持「从动作库选」+「手动添加并自动存入用户私有动作库」
// 计时方式：用户自选正计时 / 倒计时（AMRAP/EMOM 用模式字段作为目标时长；Chipper 总是正计时记总时间）
import React, { useEffect, useState } from 'react';
import { Button, Input, Text, XStack, YStack, ScrollView, Spinner } from 'tamagui';

import { Card } from './Card';
import { SegmentedControl } from './SegmentedControl';
import { colors, radius } from '../theme/tokens';
import { WodData, WodMode, TimerMode, WodMovement, useTraining } from '../context/TrainingContext';
import { api } from '../api/client';

interface Props {
  started: boolean;
  elapsed: number;
  navigation?: any;
  wod: WodData;
  setWod: (w: WodData) => void;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const WOD_MODES: { key: WodMode; label: string }[] = [
  { key: 'AMRAP', label: 'AMRAP' },
  { key: 'EMOM', label: 'EMOM' },
  { key: 'Chipper', label: 'Chipper' },
];
const TIMER_MODES: { key: TimerMode; label: string }[] = [
  { key: 'count-up', label: '正计时' },
  { key: 'count-down', label: '倒计时' },
];
const ADD_SOURCES: { key: 'library' | 'manual'; label: string }[] = [
  { key: 'library', label: '从动作库选' },
  { key: 'manual', label: '手动添加' },
];

export function CrossFitRecorder({ started, elapsed, navigation, wod, setWod }: Props) {
  const { start, stop, saving, metconAvgHr, setMetconAvgHr, metconMaxHr, setMetconMaxHr } = useTraining();

  const patch = (p: Partial<WodData>) => setWod({ ...wod, ...p });

  const [addSource, setAddSource] = useState<'library' | 'manual'>('library');

  const [mName, setMName] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mReps, setMReps] = useState('');
  const [mSaving, setMSaving] = useState(false);

  const [libQuery, setLibQuery] = useState('');
  const [libResults, setLibResults] = useState<any[]>([]);
  const [libLoading, setLibLoading] = useState(false);

  useEffect(() => {
    if (addSource !== 'library') return;
    const q = libQuery.trim();
    if (!q) { setLibResults([]); return; }
    setLibLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r: any = await api.getExercises(q, undefined, 15);
        setLibResults(Array.isArray(r) ? r : []);
      } catch {
        setLibResults([]);
      } finally {
        setLibLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [libQuery, addSource]);

  const addFromLibrary = (ex: any) => {
    const name = ex.name_zh || ex.name;
    if (!name) return;
    const mov: WodMovement = {
      id: Math.random().toString(36).slice(2),
      name,
      reps: '',
      weight_kg: '',
      exerciseId: ex.exercise_id,
      source: 'public',
    };
    patch({ movements: [...wod.movements, mov] });
    setLibQuery('');
    setLibResults([]);
  };

  const addManual = async () => {
    const name = mName.trim();
    if (!name) return;
    setMSaving(true);
    const desc = mDesc.trim();
    const reps = mReps.trim();
    const id = Math.random().toString(36).slice(2);
    let exerciseId: string | undefined;
    try {
      const res: any = await api.createPrivateExercise({
        name,
        instructions_zh: desc || undefined,
      });
      exerciseId = res?.exercise_id;
    } catch {
      // 入库失败也允许加入本次 WOD
    }
    patch({
      movements: [
        ...wod.movements,
        { id, name, reps, weight_kg: '', description: desc || undefined, exerciseId, source: 'private' },
      ],
    });
    setMName('');
    setMDesc('');
    setMReps('');
    setMSaving(false);
  };

  const removeMovement = (mid: string) => {
    patch({ movements: wod.movements.filter((m) => m.id !== mid) });
  };
  const updateMovement = (mid: string, partial: Partial<WodMovement>) => {
    patch({ movements: wod.movements.map((m) => (m.id === mid ? { ...m, ...partial } : m)) });
  };

  const renderTimer = () => {
    if (!started) return null;
    let targetSec = 0;
    if (wod.mode === 'AMRAP') targetSec = parseFloat(wod.timeCapMin) * 60 || 0;
    else if (wod.mode === 'EMOM') targetSec = parseFloat(wod.totalMin) * 60 || 0;
    else if (wod.mode === 'Chipper') targetSec = parseFloat(wod.totalTimeSec) || 0;

    if (wod.timerMode === 'count-down' && targetSec > 0) {
      const remain = Math.max(0, targetSec - elapsed);
      const done = remain === 0;
      return (
        <YStack alignItems="center" paddingVertical={6}>
          <Text fontSize={11} color={colors.textMuted}>⏰ WOD 倒计时</Text>
          <Text
            fontSize={44}
            fontWeight="bold"
            color={done ? colors.danger : colors.text}
            fontVariant={['tabular-nums']}
          >
            {fmt(remain)}{done ? '  时间到！' : ''}
          </Text>
        </YStack>
      );
    }
    return (
      <YStack alignItems="center" paddingVertical={6}>
        <Text fontSize={11} color={colors.textMuted}>
          {wod.mode === 'Chipper' ? '⏱ WOD 已用时间（保存时记录）' : '⏱ WOD 正计时'}
        </Text>
        <Text fontSize={44} fontWeight="bold" color={colors.text} fontVariant={['tabular-nums']}>
          {fmt(elapsed)}
        </Text>
      </YStack>
    );
  };

  return (
    <YStack gap={16}>
      <Card title="WOD（Workout of the Day）" accent="warning">
        <YStack gap={12}>
          <SegmentedControl
            options={WOD_MODES}
            value={wod.mode}
            onChange={(k) => patch({ mode: k as WodMode })}
          />

          <YStack gap={4}>
            <Text fontSize={11} color={colors.textMuted}>计时方式</Text>
            <SegmentedControl
              options={TIMER_MODES}
              value={wod.timerMode}
              onChange={(k) => patch({ timerMode: k as TimerMode })}
            />
          </YStack>

          {renderTimer()}

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

          {wod.mode === 'AMRAP' && (
            <YStack gap={8}>
              <XStack gap={8}>
                <YStack flex={1} gap={4}>
                  <Text fontSize={11} color={colors.textMuted}>时间上限(分钟)</Text>
                  <Input
                    keyboardType="numeric"
                    placeholder="20"
                    value={wod.timeCapMin}
                    onChangeText={(v) => patch({ timeCapMin: v })}
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                    editable={!started}
                  />
                </YStack>
                <YStack flex={1} gap={4}>
                  <Text fontSize={11} color={colors.textMuted}>完成轮数</Text>
                  <Input
                    keyboardType="numeric"
                    placeholder="5"
                    value={wod.rounds}
                    onChangeText={(v) => patch({ rounds: v })}
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                    editable={!started}
                  />
                </YStack>
                <YStack flex={1} gap={4}>
                  <Text fontSize={11} color={colors.textMuted}>额外次数</Text>
                  <Input
                    keyboardType="numeric"
                    placeholder="12"
                    value={wod.extraReps}
                    onChangeText={(v) => patch({ extraReps: v })}
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                    editable={!started}
                  />
                </YStack>
              </XStack>
              <Text fontSize={11} color={colors.textMuted}>限定时间内完成尽量多的循环（轮数 + 额外次数）</Text>
            </YStack>
          )}

          {wod.mode === 'EMOM' && (
            <YStack gap={8}>
              <YStack gap={4}>
                <Text fontSize={11} color={colors.textMuted}>总时长(分钟)</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="20"
                  value={wod.totalMin}
                  onChangeText={(v) => patch({ totalMin: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                  editable={!started}
                />
              </YStack>
              <Text fontSize={11} color={colors.textMuted}>每分钟完成规定动作，剩余时间休息</Text>
            </YStack>
          )}

          {wod.mode === 'Chipper' && (
            <YStack gap={8}>
              <YStack gap={4}>
                <Input
                  keyboardType="numeric"
                  placeholder="目标时间(秒)，如 900"
                  value={wod.totalTimeSec}
                  onChangeText={(v) => patch({ totalTimeSec: v })}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                  editable={!started}
                />
              </YStack>
              <Text fontSize={11} color={colors.textMuted}>一次性完成规定次数的多个动作，实际完成时间由训练计时自动记录</Text>
            </YStack>
          )}

          <YStack gap={8}>
            <Text fontSize={13} fontWeight="600" color={colors.text}>动作明细</Text>
            {wod.movements.length > 0 && (
              <YStack gap={6}>
                {wod.movements.map((m) => (
                  <YStack
                    key={m.id}
                    backgroundColor={colors.surfaceLight}
                    borderRadius={radius.sm}
                    padding={10}
                    gap={6}
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <XStack alignItems="center" gap={6} flex={1}>
                        <Text fontSize={14}>{m.source === 'public' ? '' : ''}</Text>
                        <Text fontSize={13} fontWeight="600" color={colors.text} flex={1} numberOfLines={1}>
                          {m.name}
                        </Text>
                      </XStack>
                      {!started && (
                        <Button size="$2" theme="red" onPress={() => removeMovement(m.id)}>
                          <Text fontSize={12} color={colors.danger}>删除</Text>
                        </Button>
                      )}
                    </XStack>
                    {!!m.description && (
                      <Text fontSize={11} color={colors.textSecondary}>{m.description}</Text>
                    )}
                    <XStack gap={6} alignItems="center">
                      <Text fontSize={11} color={colors.textMuted}>重量kg</Text>
                      <Input
                        flex={1}
                        keyboardType="numeric"
                        value={m.weight_kg || ''}
                        onChangeText={(v) => updateMovement(m.id, { weight_kg: v })}
                        placeholder="如 50"
                        backgroundColor={colors.surface}
                        borderRadius={radius.sm}
                        color={colors.text}
                        editable={!started}
                        height={32}
                      />
                      <Text fontSize={11} color={colors.textMuted}>次数</Text>
                      <Input
                        flex={1}
                        keyboardType="numeric"
                        value={m.reps}
                        onChangeText={(v) => updateMovement(m.id, { reps: v })}
                        placeholder="如 10"
                        backgroundColor={colors.surface}
                        borderRadius={radius.sm}
                        color={colors.text}
                        editable={!started}
                        height={32}
                      />
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            )}

            {!started && (
              <YStack gap={8}>
                <SegmentedControl
                  options={ADD_SOURCES}
                  value={addSource}
                  onChange={(k) => setAddSource(k as 'library' | 'manual')}
                />
                {addSource === 'library' ? (
                  <YStack gap={6}>
                    {!!navigation && (
                      <Button
                        backgroundColor={colors.surfaceLight}
                        borderRadius={radius.md}
                        borderWidth={1}
                        borderColor={colors.primary}
                        onPress={() => navigation.navigate('ExerciseLibrary')}
                      >
                        <Text color={colors.primary} fontWeight="600">打开动作库浏览</Text>
                      </Button>
                    )}
                    <Input
                      value={libQuery}
                      onChangeText={setLibQuery}
                      placeholder="或直接搜索动作（中文/英文，如 卧推 / bench press）"
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                    {libLoading && <Text fontSize={11} color={colors.textMuted}>搜索中…</Text>}
                    {libResults.length > 0 && (
                      <ScrollView style={{ maxHeight: 200 }}>
                        <YStack gap={4}>
                          {libResults.map((ex: any) => (
                            <XStack
                              key={ex.exercise_id}
                              justifyContent="space-between"
                              alignItems="center"
                              backgroundColor={colors.surface}
                              borderRadius={radius.sm}
                              paddingHorizontal={10}
                              paddingVertical={8}
                              onPress={() => addFromLibrary(ex)}
                            >
                              <YStack flex={1}>
                                <Text fontSize={13} color={colors.text} numberOfLines={1}>
                                  {ex.name_zh || ex.name}
                                </Text>
                                {ex.name_zh && ex.name !== ex.name_zh && (
                                  <Text fontSize={10} color={colors.textMuted} numberOfLines={1}>
                                    {ex.name}
                                  </Text>
                                )}
                              </YStack>
                              <Text fontSize={12} color={colors.primary} fontWeight="600">＋ 加入</Text>
                            </XStack>
                          ))}
                        </YStack>
                      </ScrollView>
                    )}
                    {libQuery.trim() && !libLoading && libResults.length === 0 && (
                      <Text fontSize={11} color={colors.textMuted}>未找到动作，换个关键词试试</Text>
                    )}
                  </YStack>
                ) : (
                  <YStack gap={6}>
                    <XStack gap={6}>
                      <Input
                        flex={1}
                        value={mName}
                        onChangeText={setMName}
                        placeholder="动作名（必填）"
                        backgroundColor={colors.surface}
                        borderRadius={radius.md}
                        color={colors.text}
                      />
                      <Input
                        width={80}
                        keyboardType="numeric"
                        value={mReps}
                        onChangeText={setMReps}
                        placeholder="次数"
                        backgroundColor={colors.surface}
                        borderRadius={radius.md}
                        color={colors.text}
                      />
                    </XStack>
                    <Input
                      value={mDesc}
                      onChangeText={setMDesc}
                      placeholder="动作描述（可选，如动作要领 / 变式）"
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                    <Button
                      backgroundColor={colors.primary}
                      borderRadius={radius.md}
                      onPress={addManual}
                      disabled={!mName.trim() || mSaving}
                    >
                      {mSaving ? <Spinner color="white" /> : <Text color="#fff" fontWeight="600">添加并加入我的动作库</Text>}
                    </Button>
                  </YStack>
                )}
              </YStack>
            )}

            {/* 开始 / 结束 WOD 训练（替代被隐藏的全局"开始训练"模块） */}
            {!started ? (
              <Button
                backgroundColor={colors.primary}
                borderRadius={radius.md}
                size="$4"
                width="100%"
                onPress={start}
              >
                <Text color="#fff" fontWeight="700" fontSize={16}>▶ 开始 WOD 训练</Text>
              </Button>
            ) : (
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
            )}
          </YStack>
        </YStack>
      </Card>
    </YStack>
  );
}

export default CrossFitRecorder;
