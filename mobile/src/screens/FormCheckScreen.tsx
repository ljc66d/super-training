// 动作纠错页面 —— 选择动作 + 上传1~3个多角度视频/照片，AI 高精度纠错
import React, { useEffect, useState, useCallback } from 'react';
import { Button, Text, YStack, XStack, ScrollView, View, Spinner } from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { colors, radius } from '../theme/tokens';

// 6 种经典力量训练动作
const ACTIONS = [
  { code: 'squat',          name: '深蹲',     angle: '侧面' },
  { code: 'pushup',         name: '俯卧撑',   angle: '侧面' },
  { code: 'bench_press',    name: '卧推',     angle: '侧面' },
  { code: 'deadlift',       name: '硬拉',     angle: '侧面' },
  { code: 'overhead_press', name: '实力推', angle: '侧面/正面' },
  { code: 'pullup',         name: '引体向上', angle: '侧面' },
];

// 多角度标签
const ANGLE_LABELS = ['正面', '侧面', '背面'];

type PickedAsset = {
  uri: string;
  isVideo: boolean;
  name: string;
  angle: string; // 正面/侧面/背面
};

export function FormCheckScreen({ navigation }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [videoResult, setVideoResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [pickedAssets, setPickedAssets] = useState<PickedAsset[]>([]);

  const loadRecords = useCallback(() => {
    api.getFormCheckRecords().then(setRecords).catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const pickMedia = async (mode: 'camera' | 'library') => {
    if (!selectedAction) {
      Alert.alert('请先选择动作', '请先选择要纠错的动作类型');
      return;
    }
    if (pickedAssets.length >= 3) {
      Alert.alert('已达上限', '最多上传3个视频（正面/侧面/背面）');
      return;
    }
    try {
      const perm = mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('权限不足', mode === 'camera' ? '需要相机权限才能录制' : '需要相册权限才能选择');
        return;
      }
      const pick = mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'] as any, videoMaxDuration: 20, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'] as any, allowsMultipleSelection: false });
      if (pick.canceled || !pick.assets?.length) return;
      const asset = pick.assets[0];
      const isVideo = !!asset.duration || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(asset.fileName || asset.uri || '');
      const angle = ANGLE_LABELS[pickedAssets.length] || '补充角度';
      setPickedAssets(prev => [...prev, {
        uri: asset.uri,
        isVideo,
        name: asset.fileName || `pose_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        angle,
      }]);
    } catch (e: any) {
      Alert.alert('选择失败', e?.message || '请重试');
    }
  };

  const removeAsset = (idx: number) => {
    setPickedAssets(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // 重新分配角度标签
      return next.map((a, i) => ({ ...a, angle: ANGLE_LABELS[i] || '补充角度' }));
    });
  };

  const startAssess = async () => {
    if (!selectedAction) {
      Alert.alert('请先选择动作');
      return;
    }
    if (pickedAssets.length === 0) {
      Alert.alert('请上传视频', '请至少上传1个视频或照片');
      return;
    }
    setLoading(true);
    setVideoResult(null);
    try {
      const form = new FormData();
      form.append('action', selectedAction);
      for (const a of pickedAssets) {
        if (Platform.OS === 'web') {
          const res = await fetch(a.uri);
          const blob = await res.blob();
          form.append('files', new File([blob], a.name || 'pose', {
            type: a.isVideo ? 'video/mp4' : blob.type || 'image/jpeg'
          }));
        } else {
          form.append('files', {
            uri: a.uri,
            name: a.name,
            type: a.isVideo ? 'video/mp4' : 'image/jpeg',
          } as any);
        }
      }
      const res = await api.formCheckVideo(form);
      if (res) {
        setVideoResult(res);
        loadRecords(); // 评估成功后刷新历史记录
      } else {
        Alert.alert('识别失败', '未能检测到人体，请确保全身在画面内');
      }
    } catch (e: any) {
      console.warn(e);
      Alert.alert('评估失败', e?.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setVideoResult(null);
    setPickedAssets([]);
  };

  const severityTone = (s: string) => {
    if (s === 'critical') return 'danger' as const;
    if (s === 'major') return 'warning' as const;
    return 'neutral' as const;
  };

  const gradeColor = (grade: string) => {
    if (grade === '优秀') return colors.success;
    if (grade === '良好') return colors.primary;
    if (grade === '及格') return colors.warning;
    return colors.danger;
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader
        title="经典力量训练动作纠错"
        subtitle="俯卧撑/深蹲/卧推/硬拉/实力推/引体向上"
        onBack={() => navigation.goBack()}
      />
      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>

          {/* 步骤1：选择动作 */}
          <Card title="1. 选择要纠错的动作" accent="primary">
            <YStack gap={10}>
              <XStack flexWrap="wrap" gap={8}>
                {ACTIONS.map(a => {
                  const active = selectedAction === a.code;
                  return (
                    <Button
                      key={a.code}
                      {...({ type: 'button' } as any)}
                      height={44}
                      paddingHorizontal={14}
                      backgroundColor={active ? colors.primary : colors.surfaceLight}
                      borderWidth={1}
                      borderColor={active ? colors.primary : colors.border}
                      borderRadius={radius.md}
                      pressStyle={{ opacity: 0.8 }}
                      onPress={() => { setSelectedAction(a.code); setVideoResult(null); }}
                    >
                      <Text fontSize={13} fontWeight={active ? '700' : '500'}
                            color={active ? '#fff' : colors.text}>
                        {a.name}
                      </Text>
                    </Button>
                  );
                })}
              </XStack>
              {selectedAction && (
                <Text fontSize={11} color={colors.textMuted}>
                  建议拍摄角度：{ACTIONS.find(a => a.code === selectedAction)?.angle}（多拍几个角度更准确）
                </Text>
              )}
            </YStack>
          </Card>

          {/* 步骤2：上传视频 */}
          {selectedAction && (
            <Card title={`2. 上传视频（${pickedAssets.length}/3）`} accent="primary">
              <Text fontSize={11} color={colors.textMuted} marginBottom={10}>
                建议上传 1~3 个视频：正面、侧面、背面。每个视频 5~15 秒即可。
              </Text>

              {/* 已选文件列表 */}
              {pickedAssets.length > 0 && (
                <YStack gap={6} marginBottom={10}>
                  {pickedAssets.map((a, i) => (
                    <XStack key={i} alignItems="center" gap={8}
                            backgroundColor={colors.surfaceLight}
                            borderRadius={radius.md} padding={8}>
                      <Text fontSize={16}>{a.isVideo ? '[视频]' : '[图片]'}</Text>
                      <YStack flex={1}>
                        <Text fontSize={12} fontWeight="600" color={colors.text}>
                          {a.angle}视角
                        </Text>
                        <Text fontSize={10} color={colors.textMuted} numberOfLines={1}>
                          {a.name || (a.isVideo ? '视频文件' : '图片文件')}
                        </Text>
                      </YStack>
                      <Button
                        {...({ type: 'button' } as any)}
                        size="$2"
                        chromeless
                        onPress={() => removeAsset(i)}
                      >
                        <Text fontSize={16} color={colors.danger}>x</Text>
                      </Button>
                    </XStack>
                  ))}
                </YStack>
              )}

              {pickedAssets.length < 3 && !videoResult && (
                <XStack gap={8}>
                  <Button
                    {...({ type: 'button' } as any)}
                    flex={1}
                    height={40}
                    backgroundColor={colors.primary}
                    borderRadius={radius.md}
                    onPress={() => pickMedia('camera')}
                    disabled={loading}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <Text color="#fff" fontSize={13} fontWeight="600">录制{ANGLE_LABELS[pickedAssets.length] || ''}</Text>
                  </Button>
                  <Button
                    {...({ type: 'button' } as any)}
                    flex={1}
                    height={40}
                    backgroundColor={colors.surfaceLight}
                    borderWidth={1}
                    borderColor={colors.border}
                    borderRadius={radius.md}
                    onPress={() => pickMedia('library')}
                    disabled={loading}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <Text color={colors.textSecondary} fontSize={13} fontWeight="600">相册选择</Text>
                  </Button>
                </XStack>
              )}

              {/* 开始评估按钮 */}
              {pickedAssets.length > 0 && !videoResult && (
                <Button
                  {...({ type: 'button' } as any)}
                  marginTop={10}
                  height={44}
                  backgroundColor={colors.success}
                  borderRadius={radius.md}
                  onPress={startAssess}
                  disabled={loading}
                  pressStyle={{ opacity: 0.8 }}
                >
                  {loading ? (
                    <XStack gap={8} alignItems="center">
                      <Spinner color="#fff" />
                      <Text color="#fff" fontSize={14} fontWeight="600">HRNet 评估中...</Text>
                    </XStack>
                  ) : (
                    <Text color="#fff" fontSize={14} fontWeight="700">
                      开始纠错评估
                    </Text>
                  )}
                </Button>
              )}
            </Card>
          )}

          {/* 评估结果 */}
          {videoResult && videoResult.error && !videoResult.score ? (
            <Card title="评估失败" accent="danger">
              <YStack gap={8}>
                <Text fontSize={13} fontWeight="600" color={colors.danger}>{videoResult.error}</Text>
                {(videoResult.corrections || []).map((c: any, i: number) => (
                  <Text key={i} fontSize={12} color={colors.textSecondary}>· {c.text}</Text>
                ))}
                <Button
                  {...({ type: 'button' } as any)}
                  marginTop={6}
                  height={36}
                  backgroundColor={colors.primary}
                  borderRadius={radius.md}
                  onPress={resetAll}
                >
                  <Text color="#fff" fontSize={12} fontWeight="600">重新上传</Text>
                </Button>
              </YStack>
            </Card>
          ) : videoResult && (
            <Card title={`${videoResult.action_name} 评估结果`} accent="success">
              <YStack gap={10}>
                <XStack alignItems="center" gap={12}>
                  <View width={56} height={56} borderRadius={radius.lg}
                        backgroundColor={colors.surfaceLight}
                        alignItems="center" justifyContent="center">
                    <Text fontSize={24} fontWeight="bold" color={gradeColor(videoResult.grade)}>
                      {Math.round(videoResult.score)}
                    </Text>
                  </View>
                  <YStack flex={1} gap={2}>
                    <Text fontSize={14} fontWeight="600" color={colors.text}>
                      {videoResult.action_name} · {videoResult.grade}
                    </Text>
                    <Text fontSize={11} color={colors.textMuted}>
                      {videoResult.grade_message}
                      {videoResult.file_count > 1 && ` · ${videoResult.file_count}个角度`}
                      （{videoResult.frame_count} 帧 · {videoResult.engine === 'hrnet' ? 'HRNet高精度' : '快速检测'}）
                    </Text>
                  </YStack>
                </XStack>

                {videoResult.errors?.length > 0 ? (
                  <YStack gap={6}>
                    {videoResult.errors.map((e: any, i: number) => (
                      <View key={i} backgroundColor={colors.surfaceLight}
                            borderRadius={radius.md} padding={10}>
                        <XStack justifyContent="space-between" alignItems="center" marginBottom={4}>
                          <Text fontSize={12} fontWeight="600" color={colors.text}>{e.name}</Text>
                          <Badge text={e.severity === 'critical' ? '严重' : e.severity === 'major' ? '重要' : '提示'}
                                 tone={severityTone(e.severity)} />
                        </XStack>
                        <Text fontSize={11} color={colors.primary}>建议：{e.advice}</Text>
                      </View>
                    ))}
                  </YStack>
                ) : (
                  <Text fontSize={13} color={colors.success}>动作标准，继续保持！</Text>
                )}

                {videoResult.suggestions?.length > 0 && (
                  <YStack gap={4} backgroundColor="rgba(125, 211, 252, 0.10)"
                          borderRadius={radius.md} padding={10}>
                    <Text fontSize={11} fontWeight="700" color="#7DD3FC">AI 训练建议</Text>
                    {videoResult.suggestions.map((s: any, i: number) => (
                      <Text key={i} fontSize={11} color="#BAE6FD">
                        · {typeof s === 'string' ? s : s.text || JSON.stringify(s)}
                      </Text>
                    ))}
                  </YStack>
                )}

                <Text fontSize={10} color={colors.textMuted}>{videoResult.disclaimer}</Text>

                <Button
                  {...({ type: 'button' } as any)}
                  height={38}
                  backgroundColor={colors.surfaceLight}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius={radius.md}
                  onPress={resetAll}
                >
                  <Text fontSize={12} fontWeight="600" color={colors.textSecondary}>评估其他动作</Text>
                </Button>
              </YStack>
            </Card>
          )}

          {/* 历史记录 */}
          {records.length > 0 && (
            <Card title="历史纠错记录">
              <YStack gap={8}>
                {records.slice(0, 8).map((r: any) => {
                  const fb = r.feedback_json || {};
                  return (
                    <XStack key={r.check_id} justifyContent="space-between" alignItems="center"
                            paddingVertical={6} borderBottomWidth={1} borderBottomColor={colors.border}>
                      <YStack flex={1}>
                        <Text fontSize={13} color={colors.text}>{fb.action_name || '动作'}</Text>
                        <Text fontSize={11} color={colors.textMuted}>
                          {r.created_at?.slice(0, 16).replace('T', ' ')}
                        </Text>
                      </YStack>
                      <Badge
                        text={r.score != null ? `${Math.round(r.score)}分 ${fb.grade || ''}` : (fb.grade || '已记录')}
                        tone={fb.grade === '优秀' ? 'success' : fb.grade === '不及格' ? 'danger' : 'primary'}
                      />
                    </XStack>
                  );
                })}
              </YStack>
            </Card>
          )}

        </YStack>
      </ScrollView>
    </YStack>
  );
}

export default FormCheckScreen;