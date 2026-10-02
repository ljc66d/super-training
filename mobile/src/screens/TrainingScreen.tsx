// 训练记录：实时计时 + 一组一组记录
// 计时/休息状态在全局 TrainingContext，切页不中断；休息倒计时由全局浮窗 RestTimerFloating 展示
import React, { useEffect, useState } from 'react';
import { Button, Input, Text, XStack, YStack, ScrollView, Spinner, View } from 'tamagui';

import { api } from '../api/client';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { ExercisePicker } from '../components/ExercisePicker';
import { CrossFitRecorder } from '../components/CrossFitRecorder';
import { HyroxRecorder } from '../components/HyroxRecorder';
import { RunRecorder } from '../components/RunRecorder';
import { useTraining } from '../context/TrainingContext';
import { colors, radius } from '../theme/tokens';
import { SPORT_CATEGORIES } from '../utils/constants';
import { sanitizeNumber, sanitizeInteger } from '../utils/input';

type RecordMode = 'library' | 'manual' | 'nlp';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

export function TrainingScreen({ navigation, route }: any) {
  const {
    started, elapsed, exercises, activeExId, restRemaining, saving, saved, category, setCategory,
    customSportName, setCustomSportName,
    wod, setWod,
    hyroxStations, setHyroxStations, hyroxEditingId, setHyroxEditingId,
    runMode, setRunMode, longRun, setLongRun, runGroups, setRunGroups, completeRunGroup,
    metconAvgHr, metconMaxHr, overallRpe, setOverallRpe,
    start, stop, addExercises, removeExercise, completeSet, addNextSet, setSetField, resetAfterSave,
  } = useTraining();

  const isCrossFit = category === 'CrossFit';
  const isHyrox = category === 'Hyrox';
  const isRun = category === '跑步' || category === '骑行' || category === '游泳' || category === '徒步';

  const [recordMode, setRecordMode] = useState<RecordMode>('library');
  const [nlpText, setNlpText] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [manualName, setManualName] = useState('');

  const [customSports, setCustomSports] = useState<any[]>([]);
  const [newSportName, setNewSportName] = useState('');

  const loadCustomSports = () => {
    api.getCustomSports().then((d) => setCustomSports(d || [])).catch(() => {});
  };

  useEffect(() => {
    loadCustomSports();
    const unsub = navigation?.addListener?.('focus', loadCustomSports);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const handleSaveSport = async () => {
    const name = newSportName.trim();
    if (!name) return;
    try {
      await api.addCustomSport(name);
      setNewSportName('');
      loadCustomSports();
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  // 从动作库页面选中的动作（支持单选 picked 或多选 pickedList）
  // 用 focus 事件读取，确保从动作库返回时一定能消费到参数
  // CrossFit 模式下加到 WOD 动作明细；其余运动加到技能/力量动作记录
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      const pickedList = route?.params?.pickedList;
      const picked = route?.params?.picked;
      const items = Array.isArray(pickedList) && pickedList.length > 0
        ? pickedList
        : (picked?.name ? [picked] : []);
      if (items.length > 0) {
        if (isCrossFit) {
          setWod((prev) => ({
            ...prev,
            movements: [
              ...prev.movements,
              ...items.map((it: any) => ({
                id: Math.random().toString(36).slice(2),
                name: it.name,
                reps: '',
                exerciseId: it.exercise_id,
                source: 'public' as const,
              })),
            ],
          }));
        } else if (isHyrox) {
          // 填入当前正在编辑的站点
          const first = items[0];
          setHyroxStations((prev) =>
            prev.map((s) =>
              s.id === hyroxEditingId
                ? { ...s, name: first.name, exerciseId: first.exercise_id, source: 'public' as const }
                : s
            )
          );
          setHyroxEditingId(null);
        } else {
          addExercises(items);
        }
        navigation?.setParams({ pickedList: undefined, picked: undefined });
      }
    });
    return unsubscribe;
  }, [navigation, route?.params, addExercises, isCrossFit, isHyrox, hyroxEditingId]);

  // 自然语言解析动作
  const handleNlp = async () => {
    if (!nlpText.trim()) return;
    setNlpLoading(true);
    try {
      const res = await api.createSessionNlp(nlpText, new Date().toISOString());
      const session = res?.session;
      const exs: any[] = session?.detail_json?.exercises || [];
      const items = exs
        .filter((e: any) => e.exercise_name)
        .map((e: any) => ({ name: e.exercise_name, exercise_id: e.exercise_id }));
      if (items.length > 0) {
        addExercises(items);
      } else {
        addExercises([{ name: nlpText.trim() }]);
      }
      setNlpText('');
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setNlpLoading(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    addExercises([{ name: manualName.trim() }]);
    setManualName('');
  };

  const totalSets = exercises.reduce((s, ex) => s + ex.sets.filter((x) => x.done).length, 0);
  const totalVolume = exercises.reduce((s, ex) => {
    return s + ex.sets.filter((x) => x.done).reduce((ss, x) => {
      const w = x.weight_kg ? parseFloat(x.weight_kg) : 0;
      const r = x.reps ? parseInt(x.reps, 10) : 0;
      return ss + w * r;
    }, 0);
  }, 0);

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <ScreenHeader title="开始训练" subtitle={started ? '训练进行中' : '记录每一次突破'} />

      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>
          {/* 运动大类（训练开始前可选）—— 3 列网格卡片 */}
          <Card title="选择运动大类">
            <XStack flexWrap="wrap" marginHorizontal={-4}>
              {SPORT_CATEGORIES.map((c, idx) => {
                const isSelected = category === c.key;
                // 末项单行时（13 % 3 = 1）让它居中显示
                const isLoneOnLastRow =
                  idx === SPORT_CATEGORIES.length - 1 && SPORT_CATEGORIES.length % 3 === 1;
                return (
                  <View
                    key={c.key}
                    width="33.3333%"
                    padding={4}
                    style={isLoneOnLastRow ? { marginLeft: '33.3333%' } : undefined}
                  >
                    <YStack
                      backgroundColor={isSelected ? colors.primary : colors.surfaceLight}
                      borderRadius={radius.md}
                      paddingVertical={16}
                      paddingHorizontal={8}
                      alignItems="center"
                      justifyContent="center"
                      borderWidth={isSelected ? 0 : 1}
                      borderColor={colors.border}
                      onPress={() => !started && setCategory(c.key)}
                    >
                      <Text
                        fontSize={14}
                        fontWeight="700"
                        color={isSelected ? '#fff' : colors.text}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                    </YStack>
                  </View>
                );
              })}
            </XStack>
            {category === '自定义' && (
              <YStack gap={10} marginTop={12}>
                {/* 已保存的自定义运动：点选即用 */}
                {customSports.length > 0 && (
                  <XStack gap={8} flexWrap="wrap">
                    {customSports.map((s) => {
                      const active = customSportName === s.sport_name;
                      return (
                        <View
                          key={s.custom_sport_id}
                          backgroundColor={active ? colors.primary : colors.surfaceLight}
                          borderRadius={radius.md}
                          paddingHorizontal={12}
                          paddingVertical={8}
                          borderWidth={active ? 0 : 1}
                          borderColor={colors.border}
                          onPress={() => !started && setCustomSportName(s.sport_name)}
                        >
                          <Text fontSize={13} fontWeight="600" color={active ? '#fff' : colors.text}>
                            {s.sport_name}
                          </Text>
                        </View>
                      );
                    })}
                  </XStack>
                )}
                {/* 输入并保存为新运动种类 */}
                <XStack gap={8}>
                  <Input
                    flex={1}
                    value={newSportName}
                    onChangeText={setNewSportName}
                    placeholder="新增运动名称，如 攀岩"
                    backgroundColor={colors.surface}
                    borderRadius={radius.md}
                    color={colors.text}
                    editable={!started}
                  />
                  <Button
                    backgroundColor={colors.surfaceLight}
                    borderRadius={radius.md}
                    borderWidth={1}
                    borderColor={colors.primary}
                    onPress={handleSaveSport}
                    disabled={!newSportName.trim() || started}
                  >
                    <Text color={colors.primary} fontWeight="600">保存</Text>
                  </Button>
                </XStack>
                <Input
                  value={customSportName}
                  onChangeText={setCustomSportName}
                  placeholder="当前运动名称（可直接填写，无需保存）"
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                  editable={!started}
                />
              </YStack>
            )}
          </Card>

          {/* 计时区：总训练时长（CrossFit/Hyrox/跑步 下隐藏，用各自专属开始按钮+计时） */}
          {!isCrossFit && !isHyrox && !isRun && (
          <Card title={started ? '⏱ 总训练时长' : '开始训练'} accent={started ? 'success' : 'primary'}>
            <YStack alignItems="center" paddingVertical={12} gap={10}>
              <Text fontSize={52} fontWeight="bold" color={started ? colors.success : colors.text} fontVariant={['tabular-nums']}>
                {formatDuration(elapsed)}
              </Text>
              {started && (
                <Text fontSize={11} color={colors.textMuted}>总时长 = 开始训练至今（切页面/选动作/休息均持续计时）</Text>
              )}
              {!started ? (
                <Button backgroundColor={colors.primary} borderRadius={radius.md} size="$4" width="100%" onPress={start}>
                  <Text color="#fff" fontWeight="700" fontSize={16}>▶ 开始训练</Text>
                </Button>
              ) : (
                <Button backgroundColor={colors.danger} borderRadius={radius.md} size="$4" width="100%" onPress={stop} disabled={saving}>
                  {saving ? <Spinner color="white" /> : <Text color="#fff" fontWeight="700" fontSize={16}>■ 结束训练并保存</Text>}
                </Button>
              )}
            </YStack>
          </Card>
          )}

          {/* 训练统计 */}
          {started && totalSets > 0 && (
            <XStack gap={8}>
              <Badge text={`${exercises.length}个动作`} tone="primary" />
              <Badge text={`${totalSets}组`} tone="warning" />
              <Badge text={`${Math.round(totalVolume)}kg`} tone="success" />
            </XStack>
          )}

          {/* CrossFit 专属：WOD（热身模块已移除） */}
          {isCrossFit && (
            <CrossFitRecorder
              started={started}
              elapsed={elapsed}
              navigation={navigation}
              wod={wod}
              setWod={setWod}
            />
          )}

          {/* Hyrox 专属：自定义分段赛程（动作库/手动 + 次数/距离 + 正计时） */}
          {isHyrox && (
            <HyroxRecorder navigation={navigation} />
          )}

          {/* 跑步专属：长跑（距离/时间/心率）或自定义分组 */}
          {isRun && (
            <RunRecorder />
          )}

          {/* 整节主观强度 RPE（有氧/CrossFit/Hyrox 用 Borg 6-20，力量在每组里记 0-10） */}
          {(isCrossFit || isHyrox || isRun) && started && (
            <Card title="主观强度 RPE" accent="warning">
              <XStack gap={10} alignItems="center">
                <Input
                  flex={1}
                  keyboardType="numeric"
                  placeholder="6-20"
                  value={overallRpe}
                  onChangeText={(v) => setOverallRpe(sanitizeNumber(v))}
                  backgroundColor={colors.surface}
                  borderRadius={radius.md}
                  color={colors.text}
                />
                <Text flex={2} fontSize={11} color={colors.textMuted}>
                  Borg 量表：6=毫不费力，13=有些吃力，17=非常吃力，20=力竭。保存前填写即可
                </Text>
              </XStack>
            </Card>
          )}

          {/* 动作记录（可先选动作再开始训练，训练中可编辑组） */}
          {!isCrossFit && !isHyrox && !isRun && (started || exercises.length > 0) && (
            <Card title="训练动作" accent="warning">
              {!started && (
                <Text fontSize={12} color={colors.textMuted} marginBottom={8}>
                  先添加动作，然后点"开始训练"计时并一组一组记录
                </Text>
              )}
              <SegmentedControl
                options={[
                  { key: 'library', label: '动作库', icon: '' },
                  { key: 'manual', label: '手动创建', icon: '' },
                  { key: 'nlp', label: '自然语言', icon: '' },
                ]}
                value={recordMode}
                onChange={(k) => setRecordMode(k as RecordMode)}
              />
              <YStack gap={12} marginTop={12}>
                {recordMode === 'library' && (
                  <YStack gap={8}>
                    <Text fontSize={12} color={colors.textMuted}>从动作库选择动作，或直接浏览动作库</Text>
                    <Button
                      backgroundColor={colors.surfaceLight}
                      borderRadius={radius.md}
                      borderWidth={1}
                      borderColor={colors.primary}
                      onPress={() => navigation?.navigate('ExerciseLibrary')}
                    >
                      <Text color={colors.primary} fontWeight="600">打开动作库浏览</Text>
                    </Button>
                    <ExercisePicker onSelect={(ex) => {
                      addExercises([{ name: ex.name, exercise_id: ex.exercise_id }]);
                    }} placeholder="搜索动作（如 卧推 / bench press）" />
                  </YStack>
                )}

                {recordMode === 'manual' && (
                  <YStack gap={8}>
                    <Text fontSize={12} color={colors.textMuted}>创建自定义动作（仅本次训练）</Text>
                    <XStack gap={8}>
                      <Input
                        flex={1}
                        value={manualName}
                        onChangeText={setManualName}
                        placeholder="输入动作名称，如 农夫行走"
                        backgroundColor={colors.surface}
                        borderRadius={radius.md}
                        color={colors.text}
                      />
                      <Button backgroundColor={colors.primary} borderRadius={radius.md} onPress={handleManualAdd} disabled={!manualName.trim()}>
                        <Text color="#fff" fontWeight="600">添加</Text>
                      </Button>
                    </XStack>
                  </YStack>
                )}

                {recordMode === 'nlp' && (
                  <YStack gap={8}>
                    <Text fontSize={12} color={colors.textMuted}>一句话描述训练内容，自动解析为动作</Text>
                    <Input
                      multiline
                      height={80}
                      textAlignVertical="top"
                      value={nlpText}
                      onChangeText={setNlpText}
                      placeholder="例：卧推4组每组8次60kg"
                      backgroundColor={colors.surface}
                      borderRadius={radius.md}
                      color={colors.text}
                    />
                    <Button backgroundColor={colors.primary} borderRadius={radius.md} onPress={handleNlp} disabled={nlpLoading || !nlpText.trim()}>
                      {nlpLoading ? <Spinner color="white" /> : <Text color="#fff" fontWeight="600">解析并加入</Text>}
                    </Button>
                  </YStack>
                )}
              </YStack>

              {exercises.length > 0 && (
                <YStack gap={10} marginTop={16}>
                  <Text fontSize={13} fontWeight="600" color={colors.text}>已添加动作（一组一组记录）</Text>
                  {exercises.map((ex) => {
                    const doneSets = ex.sets.filter((s) => s.done).length;
                    const isActive = activeExId === ex.id;
                    return (
                      <View key={ex.id} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} gap={8}
                        borderWidth={isActive ? 1 : 0} borderColor={colors.primary}>
                        {/* 动作头 */}
                        <XStack justifyContent="space-between" alignItems="center">
                          <XStack alignItems="center" gap={6}>
                            <Text fontSize={14} fontWeight="700" color={colors.text}>{ex.exercise_name}</Text>
                            {doneSets > 0 && <Badge text={`已完成 ${doneSets}组`} tone="success" />}
                          </XStack>
                          <Button size="$2" theme="red" onPress={() => removeExercise(ex.id)}>
                            <Text fontSize={12} color={colors.danger}>删除</Text>
                          </Button>
                        </XStack>

                        {/* 已完成组列表 */}
                        {ex.sets.filter((s) => s.done).length > 0 && (
                          <YStack gap={4}>
                            {ex.sets.filter((s) => s.done).map((s, i) => (
                              <XStack key={s.id} justifyContent="space-between" alignItems="center" backgroundColor={colors.surface} borderRadius={radius.sm} paddingHorizontal={10} paddingVertical={6}>
                                <Text fontSize={12} color={colors.textMuted}>第{i + 1}组</Text>
                                <Text fontSize={12} color={colors.text}>{s.reps || '—'}次 × {s.weight_kg || '—'}kg{s.rpe ? ` · RPE ${s.rpe}` : ''}</Text>
                                <Text fontSize={12} color={colors.success}>✓</Text>
                              </XStack>
                            ))}
                          </YStack>
                        )}

                        {/* 当前组输入（开始训练后可用） */}
                        {!started && (
                          <Text fontSize={12} color={colors.textMuted}>▶ 点"开始训练"后可一组一组记录</Text>
                        )}
                        {started && ex.sets.some((s) => !s.done) ? (
                          ex.sets.filter((s) => !s.done).map((s) => (
                            <XStack key={s.id} gap={8} alignItems="flex-end">
                              <YStack flex={1} gap={4}>
                                <Text fontSize={11} color={colors.textMuted}>次数</Text>
                                <Input keyboardType="numeric" placeholder="10" value={s.reps}
                                  onChangeText={(v) => setSetField(ex.id, s.id, 'reps', sanitizeInteger(v))}
                                  backgroundColor={colors.surface} borderRadius={radius.md} color={colors.text} />
                              </YStack>
                              <YStack flex={1} gap={4}>
                                <Text fontSize={11} color={colors.textMuted}>重量(kg)</Text>
                                <Input keyboardType="numeric" placeholder="60" value={s.weight_kg}
                                  onChangeText={(v) => setSetField(ex.id, s.id, 'weight_kg', sanitizeNumber(v))}
                                  backgroundColor={colors.surface} borderRadius={radius.md} color={colors.text} />
                              </YStack>
                              <YStack flex={1} gap={4}>
                                <Text fontSize={11} color={colors.textMuted}>RPE</Text>
                                <Input keyboardType="numeric" placeholder="0-10" value={s.rpe}
                                  onChangeText={(v) => setSetField(ex.id, s.id, 'rpe', sanitizeNumber(v))}
                                  backgroundColor={colors.surface} borderRadius={radius.md} color={colors.text} />
                              </YStack>
                              <Button
                                height={44}
                                backgroundColor={colors.primary}
                                borderRadius={radius.md}
                                paddingHorizontal={16}
                                disabled={!s.reps && !s.weight_kg}
                                onPress={() => completeSet(ex.id, s.id)}
                              >
                                <Text color="#fff" fontWeight="700" fontSize={13}>✓ 完成本组</Text>
                              </Button>
                            </XStack>
                          ))
                        ) : started ? (
                          <Button backgroundColor={colors.surface} borderRadius={radius.md} onPress={() => addNextSet(ex.id)}>
                            <Text color={colors.primary} fontWeight="600">+ 继续下一组</Text>
                          </Button>
                        ) : null}
                      </View>
                    );
                  })}
                </YStack>
              )}
            </Card>
          )}

          {started && restRemaining > 0 && (
            <Text fontSize={12} color={colors.warning} textAlign="center">
              组间休息倒计时进行中（浮窗可拖动/缩放，切到其他页面也可见）
            </Text>
          )}

          {saved?.session && (
            <Card title="训练已保存" accent="success">
              <YStack gap={8}>
                <XStack gap={8} flexWrap="wrap">
                  <Badge text={`⏱ 时长 ${saved.durationMin} 分钟`} tone="primary" />
                  <Badge text={`${saved.groupCount} 组`} tone="warning" />
                  <Badge text={`${saved.session.calories_burned} kcal`} tone="warning" />
                  <Badge text={saved.session.sport_name} tone="neutral" />
                </XStack>
                <Text fontSize={12} color={colors.textMuted} marginTop={4}>
                  消耗基于你的体重与本次训练的真实时长、强度（容量）估算，空训练为0消耗
                </Text>
                <Button backgroundColor={colors.primary} borderRadius={radius.md} onPress={resetAfterSave}>
                  <Text color="#fff" fontWeight="600">再练一次</Text>
                </Button>
              </YStack>
            </Card>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export default TrainingScreen;
