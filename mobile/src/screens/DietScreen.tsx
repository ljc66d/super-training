// 饮食管理页面 —— 营养汇总/四维评估/自然语言录入/拍照识别
import React, { useEffect, useState } from 'react';
import { Button, Input, Text, YStack, XStack, ScrollView, Spinner, View, Image } from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Modal, Platform } from 'react-native';

import { api } from '../api/client';
import { NutritionCard } from '../components/NutritionCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { ChipSelect } from '../components/ChipSelect';
import { colors, radius } from '../theme/tokens';
import { MEAL_TYPES } from '../utils/constants';
import { emitDataEvent, DATA_EVENTS } from '../utils/events';

const MEAL_LABELS: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };

// 拍照识别失败时的"快捷补录"常用食物（零依赖，点选即识别）
const COMMON_FOOD_CHIPS = [
  '米饭', '鸡胸肉', '鸡蛋', '牛肉', '猪肉', '鱼', '虾', '西兰花',
  '青菜', '西红柿', '土豆', '苹果', '香蕉', '牛奶', '酸奶', '面包',
];

export function DietScreen() {
  // 用本地日期（避免 toISOString 的 UTC 偏差导致跨时区写入昨天）
  const now = new Date();
  const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
  const [mode, setMode] = useState<'summary' | 'nlp'>('summary');
  const [nlpText, setNlpText] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [stats, setStats] = useState<any>(null);
  const [assess, setAssess] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('photo.jpg');
  const [recognized, setRecognized] = useState<any>(null);   // {items, source, note, unmatched}
  const [photoLoading, setPhotoLoading] = useState(false);
  // 编辑态：识别结果可改名/改重量/增删
  const [editItems, setEditItems] = useState<any[]>([]);
  const [newFoodName, setNewFoodName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.getDietStats(today),
        api.getDietRecords(today).catch(() => []),
      ]);
      setStats(s);
      setRecords(r || []);
      const a = await api.assessDiet(today).catch(() => null);
      setAssess(a);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNlp = async () => {
    if (!nlpText.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.createDietRecordNlp(nlpText, today);
      const rec = res?.record || res;
      setNlpText('');
      await load();
      const cal = Math.round(stats?.total_calories ?? rec?.total_calories ?? 0);
      const protein = Math.round(stats?.total_protein ?? 0);
      const carbs = Math.round(stats?.total_carbs ?? 0);
      const fat = Math.round(stats?.total_fat ?? 0);
      const mealName = MEAL_LABELS[rec?.meal_type] || '饮食';
      setMsg({
        type: 'ok',
        text: `已记录${mealName}！今日累计 ${cal} kcal · 蛋白 ${protein}g · 碳水 ${carbs}g · 脂肪 ${fat}g`,
      });
      // 广播事件，通知首页刷新
      emitDataEvent(DATA_EVENTS.DIET_UPDATED);
      setMode('summary');
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `记录失败：${e?.message || '请重试'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!recordId) return;
    setLoading(true);
    setMsg(null);
    try {
      await api.deleteDietRecord(recordId);
      await load();
      setMsg({ type: 'ok', text: '已删除该条饮食记录' });
      emitDataEvent(DATA_EVENTS.DIET_UPDATED);
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `删除失败：${e?.message || '请重试'}` });
    } finally {
      setLoading(false);
    }
  };

  // ---- 拍照识别 ----
  // 上传前压缩：省流量、识别更快
  // 最长边缩到 1280px + JPEG 质量 0.6，通常 3-5MB 原图 → 200-400KB
  const compressImage = async (uri: string): Promise<{ uri: string; name: string }> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],  // 只给宽度，保持宽高比
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      const raw = (result.uri || '').split('/').pop() || 'photo.jpg';
      const name = /\.(jpe?g|png|webp)$/i.test(raw) ? raw : `${raw}.jpg`;
      return { uri: result.uri, name };
    } catch (e) {
      console.warn('compress failed, fallback original', e);
      return { uri, name: 'photo.jpg' };
    }
  };

  const pickAndRecognize = async (mode: 'camera' | 'library') => {
    setMsg(null);
    try {
      const perm = mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMsg({ type: 'err', text: mode === 'camera' ? '需要相机权限才能拍照' : '需要相册权限才能选图' });
        return;
      }
      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      // 压缩后再上传（保留原图引用，识别不理想时自动用原图重试）
      const originalName = asset.fileName
        || (mode === 'camera' ? 'photo.jpg' : (asset.uri.split('/').pop() || 'photo.jpg'));
      const compressed = await compressImage(asset.uri);
      setPhotoUri(compressed.uri);
      setPhotoName(compressed.name);
      await uploadPhoto(compressed.uri, compressed.name, { uri: asset.uri, name: originalName });
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `打开${mode === 'camera' ? '相机' : '相册'}失败：${e?.message || '请重试'}` });
    }
  };

  // 压缩图识别不理想（空结果/全部低置信）时自动用原图重试一次
  const uploadPhoto = async (uri: string, name: string, original?: { uri: string; name: string }) => {
    setPhotoLoading(true);
    setRecognized(null);
    try {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append('file', new File([blob], name, { type: blob.type || 'image/jpeg' }));
      } else {
        form.append('file', { uri, name, type: 'image/jpeg' } as any);
      }
      const data = await api.recognizeDietPhoto(form);
      // 识别"不理想"：空结果，或全部置信度 < 0.3（压缩图细节丢失）
      const items = (data?.items || []) as any[];
      const allLowConf = items.length > 0 && items.every((it) => (it.confidence ?? 0) < 0.3);
      if (original && original.uri !== uri && (!items.length || allLowConf)) {
        setMsg({ type: 'info', text: '压缩图识别不理想，自动用原图重试…' });
        await uploadPhoto(original.uri, original.name);   // 不带 original，避免无限重试
        return;
      }
      setRecognized(data);
      // 初始化可编辑副本，供用户确认/修改
      if (items.length) {
        setEditItems(items.map((it: any) => ({
          food_name: it.matched_keyword || it.food_name,
          weight_g: it.weight_g ?? 100,
          cooking_factor: it.cooking_factor || 1.0,
          cooking_method: it.cooking_method || null,
        })));
      } else {
        setEditItems([]);
      }
      if (!items.length) {
        setMsg({ type: 'err', text: '未识别出食物，可补充文字描述改用自然语言记录' });
      }
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `识别失败：${e?.message || '请重试'}` });
    } finally {
      setPhotoLoading(false);
    }
  };

  // ---- 单菜识别（本地分类模型，ChineseFoodNet 208 类）----
  const [classifyResult, setClassifyResult] = useState<any>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  // 拍照模式选择弹窗（整餐·外部AI / 单菜·本地推理）
  const [showPickMode, setShowPickMode] = useState(false);
  // 自定义填写：人工补录（菜名+原料+做法→热量估算，积累训练数据）
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIngredients, setCustomIngredients] = useState('');
  const [customMethod, setCustomMethod] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customResult, setCustomResult] = useState<any>(null);

  const pickAndClassify = async (mode: 'camera' | 'library') => {
    setMsg(null);
    setClassifyResult(null);
    try {
      const perm = mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMsg({ type: 'err', text: mode === 'camera' ? '需要相机权限才能拍照' : '需要相册权限才能选图' });
        return;
      }
      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const compressed = await compressImage(asset.uri);
      setPhotoUri(compressed.uri);
      setPhotoName(compressed.name);
      setClassifyLoading(true);
      const form = new FormData();
      if (Platform.OS === 'web') {
        const res = await fetch(compressed.uri);
        const blob = await res.blob();
        form.append('file', new File([blob], compressed.name, { type: blob.type || 'image/jpeg' }));
      } else {
        form.append('file', { uri: compressed.uri, name: compressed.name, type: 'image/jpeg' } as any);
      }
      const data = await api.classifyDietPhoto(form);
      setClassifyResult(data);
      if (!data?.available) {
        setMsg({ type: 'err', text: data?.note || '单菜识别暂不可用，可改用拍照识别' });
      }
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `识别失败：${e?.message || '请重试'}` });
    } finally {
      setClassifyLoading(false);
    }
  };

  // 后端按菜名+原料+做法估算热量并入库（含原图，供训练复用）
  const submitCustomFood = async () => {
    if (!customName.trim()) {
      setMsg({ type: 'err', text: '请填写菜品名称' });
      return;
    }
    if (!customIngredients.trim()) {
      setMsg({ type: 'err', text: '请填写制作原料（如：土豆2个，青椒1个，茄子1个）' });
      return;
    }
    setMsg(null);
    setCustomSubmitting(true);
    setCustomResult(null);
    try {
      const form = new FormData();
      form.append('name', customName.trim());
      form.append('ingredients', customIngredients.trim());
      if (customMethod.trim()) form.append('method', customMethod.trim());
      form.append('meal_type', mealType);
      if (photoUri) {
        if (Platform.OS === 'web') {
          const res = await fetch(photoUri);
          const blob = await res.blob();
          form.append('file', new File([blob], photoName || 'custom.jpg', { type: blob.type || 'image/jpeg' }));
        } else {
          form.append('file', { uri: photoUri, name: photoName || 'custom.jpg', type: 'image/jpeg' } as any);
        }
      }
      const data = await api.customRecordFood(form);
      setCustomResult(data);
      setMsg({ type: 'ok', text: data?.note || '已记录并计入数据积累' });
      setShowCustomForm(false);
      load();
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `提交失败：${e?.message || '请重试'}` });
    } finally {
      setCustomSubmitting(false);
    }
  };

  // 点选食物走关键词识别（无需图片）；用于快捷补录与单菜候选
  const quickPickFood = async (name: string) => {
    setPhotoLoading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('hint', name);
      const data = await api.recognizeDietPhoto(form);
      setRecognized(data);
      if (data?.items?.length) {
        setEditItems((data.items as any[]).map((it: any) => ({
          food_name: it.matched_keyword || it.food_name,
          weight_g: it.weight_g ?? 100,
          cooking_factor: it.cooking_factor || 1.0,
          cooking_method: it.cooking_method || null,
        })));
      } else {
        setEditItems([]);
      }
      if (!data?.items?.length) {
        setMsg({ type: 'err', text: `未匹配到「${name}」，可换一个或改用自然语言记录` });
      }
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `识别失败：${e?.message || '请重试'}` });
    } finally {
      setPhotoLoading(false);
    }
  };

  const updateEditItem = (i: number, patch: Partial<any>) => {
    setEditItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeEditItem = (i: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addEditItem = () => {
    const name = newFoodName.trim();
    if (!name) return;
    setEditItems((prev) => [...prev, { food_name: name, weight_g: 100, cooking_factor: 1.0, cooking_method: null }]);
    setNewFoodName('');
  };

  const confirmPhotoRecord = async () => {
    if (!editItems.length) return;
    setPhotoLoading(true);
    setMsg(null);
    try {
      // 明细直接入库，后端按明细匹配食材库并重算营养
      const itemsJson = JSON.stringify(editItems.map((it: any) => ({
        food_name: it.food_name,
        weight_g: Number(it.weight_g) || 100,
        cooking_factor: it.cooking_factor || 1.0,
        cooking_method: it.cooking_method || null,
      })));
      const res = await api.recordDietPhoto('', mealType, itemsJson);
      setPhotoUri(null);
      setRecognized(null);
      setEditItems([]);
      await load();
      const cal = Math.round(res?.total_calories ?? 0);
      setMsg({ type: 'ok', text: `记录成功！${cal} kcal · 已加入${MEAL_LABELS[mealType] || '饮食'}` });
      emitDataEvent(DATA_EVENTS.DIET_UPDATED);
    } catch (e: any) {
      console.warn(e.message);
      setMsg({ type: 'err', text: `记录失败：${e?.message || '请重试'}` });
    } finally {
      setPhotoLoading(false);
    }
  };

  const assessItems = assess ? [
    { label: '热量平衡', desc: assess.calories_balance?.detail || '' },
    { label: '宏量配比', desc: assess.macro_ratio?.advice || '' },
    { label: '膳食结构', desc: assess.diet_structure?.advice || '' },
    { label: '餐次时机', desc: assess.meal_timing?.timing_advice || '' },
  ] : [];

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <ScreenHeader title="今日饮食" subtitle="精准营养计算" action={loading ? <Spinner size="small" /> : null} />
      <View paddingHorizontal={16}>
        <SegmentedControl
          options={[{ key: 'summary', label: '营养概览', icon: '' }, { key: 'nlp', label: '记录饮食', icon: '' }]}
          value={mode}
          onChange={(k) => setMode(k as 'summary' | 'nlp')}
        />
      </View>

      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* 记录成功/失败提示（两种模式都显示） */}
        {msg && (
          <View
            backgroundColor={msg.type === 'ok' ? 'rgba(34,197,94,0.12)'
              : msg.type === 'info' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'}
            borderRadius={radius.md}
            padding={10}
            marginBottom={12}
            borderWidth={1}
            borderColor={msg.type === 'ok' ? colors.success
              : msg.type === 'info' ? colors.primary : colors.danger}
          >
            <Text fontSize={12} color={msg.type === 'ok' ? colors.success
              : msg.type === 'info' ? colors.primary : colors.danger} lineHeight={18}>{msg.text}</Text>
          </View>
        )}
        {mode === 'summary' ? (
          <YStack gap={16}>
            {stats && <NutritionCard stats={stats} />}

            <Card title={`今日饮食记录（${records.length}餐）`} accent="primary">
              {records.length === 0 ? (
                <Text fontSize={12} color={colors.textMuted}>今天还没有饮食记录，去"记录饮食"添加吧</Text>
              ) : (
                <YStack gap={8}>
                  {records.map((rec) => {
                    const items: any[] = rec.food_items?.items || [];
                    return (
                      <View key={rec.record_id} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={10} gap={4}>
                        <XStack justifyContent="space-between" alignItems="center">
                          <XStack alignItems="center" gap={6}>
                            <Text fontSize={13} fontWeight="700" color={colors.text}>
                              {MEAL_LABELS[rec.meal_type] || rec.meal_type}
                            </Text>
                            <Badge text={`${Math.round(rec.total_calories || 0)} kcal`} tone="warning" />
                          </XStack>
                          <Button
                            {...({ type: 'button' } as any)}
                            size="$2"
                            height={26}
                            paddingHorizontal={10}
                            backgroundColor="rgba(239,68,68,0.15)"
                            borderRadius={radius.pill}
                            onPress={() => handleDelete(rec.record_id)}
                          >
                            <Text fontSize={11} color={colors.danger}>删除</Text>
                          </Button>
                        </XStack>
                        <XStack gap={6} flexWrap="wrap">
                          <Badge text={`蛋白 ${Math.round(rec.total_protein || 0)}g`} tone="success" />
                          <Badge text={`碳水 ${Math.round(rec.total_carbs || 0)}g`} tone="warning" />
                          <Badge text={`脂肪 ${Math.round(rec.total_fat || 0)}g`} tone="neutral" />
                        </XStack>
                        {items.length > 0 && (
                          <Text fontSize={11} color={colors.textMuted} numberOfLines={2}>
                            {items.map((it) => it.food_name).join('、')}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </YStack>
              )}
            </Card>

            {assess && (
              <Card title="AI饮食评估" accent="warning">
                <YStack gap={10}>
                  {assessItems.map((item) => (
                    <YStack key={item.label} gap={2}>
                      <Text fontSize={13} fontWeight="600" color={colors.primary}>{item.label}</Text>
                      <Text fontSize={12} color={colors.textSecondary} lineHeight={17}>{item.desc || '待完善'}</Text>
                    </YStack>
                  ))}
                  <YStack gap={6} marginTop={4}>
                    <Text fontSize={13} fontWeight="600" color={colors.text}>改进建议</Text>
                    {assess.suggestions?.map((s: string, i: number) => (
                      <Text key={i} fontSize={12} color={colors.textSecondary}>• {s}</Text>
                    ))}
                  </YStack>
                  <Text fontSize={11} color={colors.textMuted} marginTop={4}>{assess.disclaimer}</Text>
                </YStack>
              </Card>
            )}
          </YStack>
        ) : (
          <YStack gap={16}>
          {/* 拍照识别（统一入口 + 模式选择弹窗） */}
          <Card title="拍照识别" accent="warning">
            <Text fontSize={12} color={colors.textMuted} marginBottom={10}>
              拍下餐食自动识别营养。整餐走云端 AI，单菜特写走本地模型（更快、离线可用）
            </Text>
            <ChipSelect label="餐次" options={MEAL_TYPES} value={mealType} onChange={setMealType} />
            <Button
              {...({ type: 'button' } as any)}
              marginTop={10}
              height={44}
              backgroundColor={colors.primary}
              borderRadius={radius.md}
              onPress={() => setShowPickMode(true)}
              disabled={photoLoading || classifyLoading}
              pressStyle={{ opacity: 0.8 }}
            >
              <Text color="#fff" fontSize={14} fontWeight="700">拍照识别</Text>
            </Button>

            {/* 模式选择弹窗 */}
            <Modal
              visible={showPickMode}
              transparent
              animationType="fade"
              onRequestClose={() => setShowPickMode(false)}
            >
              <View
                style={{
                  flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
                  justifyContent: 'center', alignItems: 'center', padding: 24,
                }}
              >
                <YStack
                  backgroundColor={colors.surface}
                  borderRadius={16}
                  padding={18}
                  width="100%"
                  maxWidth={380}
                  gap={12}
                >
                  <Text fontSize={15} fontWeight="700" color={colors.text}>选择识别方式</Text>
                  <Text fontSize={12} color={colors.textMuted}>
                    整餐：拍一桌菜，云端 AI 识别多个食物；单菜：拍单个菜特写，本地模型秒出结果（离线可用）
                  </Text>
                  <XStack gap={8} marginTop={4}>
                    <Button
                      {...({ type: 'button' } as any)}
                      flex={1}
                      height={44}
                      backgroundColor={colors.primary}
                      borderRadius={radius.md}
                      onPress={() => { setShowPickMode(false); pickAndRecognize('camera'); }}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <YStack alignItems="center" gap={2}>
                        <Text color="#fff" fontSize={13} fontWeight="700">整餐 · 拍照</Text>
                        <Text color="rgba(255,255,255,0.75)" fontSize={10}>云端 AI（多菜）</Text>
                      </YStack>
                    </Button>
                    <Button
                      {...({ type: 'button' } as any)}
                      flex={1}
                      height={44}
                      backgroundColor={colors.surfaceLight}
                      borderRadius={radius.md}
                      borderWidth={1}
                      borderColor={colors.border}
                      onPress={() => { setShowPickMode(false); pickAndRecognize('library'); }}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <YStack alignItems="center" gap={2}>
                        <Text color={colors.text} fontSize={13} fontWeight="700">整餐 · 相册</Text>
                        <Text color={colors.textMuted} fontSize={10}>云端 AI（多菜）</Text>
                      </YStack>
                    </Button>
                  </XStack>
                  <XStack gap={8}>
                    <Button
                      {...({ type: 'button' } as any)}
                      flex={1}
                      height={44}
                      backgroundColor="rgba(139,92,246,0.18)"
                      borderRadius={radius.md}
                      onPress={() => { setShowPickMode(false); pickAndClassify('camera'); }}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <YStack alignItems="center" gap={2}>
                        <Text color={colors.primary} fontSize={13} fontWeight="700">单菜 · 拍照</Text>
                        <Text color={colors.primary} fontSize={10}>本地推理（208 类）</Text>
                      </YStack>
                    </Button>
                    <Button
                      {...({ type: 'button' } as any)}
                      flex={1}
                      height={44}
                      backgroundColor="rgba(139,92,246,0.10)"
                      borderRadius={radius.md}
                      borderWidth={1}
                      borderColor="rgba(139,92,246,0.3)"
                      onPress={() => { setShowPickMode(false); pickAndClassify('library'); }}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <YStack alignItems="center" gap={2}>
                        <Text color={colors.primary} fontSize={13} fontWeight="700">单菜 · 相册</Text>
                        <Text color={colors.primary} fontSize={10}>本地推理（208 类）</Text>
                      </YStack>
                    </Button>
                  </XStack>
                  <Button
                    {...({ type: 'button' } as any)}
                    height={34}
                    backgroundColor="transparent"
                    borderRadius={radius.md}
                    onPress={() => setShowPickMode(false)}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <Text color={colors.textMuted} fontSize={12}>取消</Text>
                  </Button>
                </YStack>
              </View>
            </Modal>


            {/* 单菜识别候选（本地分类模型） */}
            {classifyLoading && <YStack alignItems="center" padding={10}><Spinner color={colors.primary} /></YStack>}
            {classifyResult?.available && classifyResult?.candidates?.length > 0 && (
              <YStack marginTop={10} gap={6}>
                <Text fontSize={12} fontWeight="700" color={colors.text}>识别候选（按置信度）</Text>
                {classifyResult.candidates.map((c: any, i: number) => (
                  <XStack key={i} gap={8} alignItems="center"
                         backgroundColor={colors.surfaceLight} borderRadius={radius.sm} padding={8}>
                    <YStack flex={1}>
                      <Text fontSize={13} fontWeight="600" color={colors.text}>{c.name}</Text>
                      <Text fontSize={11} color={colors.textMuted}>
                        置信 {(c.confidence * 100).toFixed(0)}%
                        {c.nutrition && ` · ${Math.round(c.nutrition.calories || 0)} kcal/100g`}
                      </Text>
                    </YStack>
                    <Button
                      {...({ type: 'button' } as any)}
                      height={30}
                      paddingHorizontal={10}
                      borderRadius={radius.pill}
                      backgroundColor={colors.primary}
                      onPress={() => { quickPickFood(c.name); setClassifyResult(null); }}
                      disabled={photoLoading}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <Text fontSize={11} color="#fff" fontWeight="600">记录</Text>
                    </Button>
                  </XStack>
                ))}
              </YStack>
            )}

            {/* 自定义填写（识别失败兜底 + 训练数据积累；拍照后始终可用） */}
            {photoUri && !classifyLoading && (
              <Button
                {...({ type: 'button' } as any)}
                marginTop={10}
                height={32}
                borderRadius={radius.md}
                backgroundColor="rgba(52,211,153,0.12)"
                borderWidth={1}
                borderColor="rgba(52,211,153,0.35)"
                onPress={() => { setShowCustomForm(!showCustomForm); setCustomResult(null); }}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text fontSize={12} color="#34d399" fontWeight="600">
                  {showCustomForm ? '收起填写 ✕' : '都不是？自己填（菜名+原料）'}
                </Text>
              </Button>
            )}

            {/* 自定义填写表单（识别失败兜底 + 训练数据积累） */}
            {showCustomForm && (
              <YStack marginTop={10} gap={8} backgroundColor={colors.surfaceLight}
                     borderRadius={radius.md} padding={12} borderWidth={1} borderColor={colors.border}>
                <Text fontSize={12} fontWeight="700" color={colors.text}>自定义菜品</Text>
                <Text fontSize={11} color={colors.textMuted}>
                  填菜名和原料，系统估算热量并记录；你的照片会匿名参与下次模型训练，让识别越来越准。
                </Text>
                <Input
                  placeholder="菜名，如：老家红烧肉"
                  value={customName}
                  onChangeText={setCustomName}
                  height={38}
                  fontSize={13}
                  backgroundColor={colors.surface}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius={radius.sm}
                  paddingHorizontal={10}
                />
                <Input
                  placeholder="原料，如：土豆2个，青椒1个，五花肉200克"
                  value={customIngredients}
                  onChangeText={setCustomIngredients}
                  height={38}
                  fontSize={13}
                  backgroundColor={colors.surface}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius={radius.sm}
                  paddingHorizontal={10}
                />
                <Input
                  placeholder="做法（选填），如：先煎后炖，少油"
                  value={customMethod}
                  onChangeText={setCustomMethod}
                  height={38}
                  fontSize={13}
                  backgroundColor={colors.surface}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius={radius.sm}
                  paddingHorizontal={10}
                />
                <Button
                  {...({ type: 'button' } as any)}
                  height={36}
                  borderRadius={radius.md}
                  backgroundColor={colors.primary}
                  onPress={submitCustomFood}
                  disabled={customSubmitting}
                  pressStyle={{ opacity: 0.8 }}
                >
                  {customSubmitting
                    ? <Spinner color="#fff" />
                    : <Text fontSize={13} color="#fff" fontWeight="600">估算热量并记录</Text>}
                </Button>
                {customResult?.data && (
                  <YStack gap={4} backgroundColor="rgba(52,211,153,0.08)" borderRadius={radius.sm} padding={8}>
                    <Text fontSize={12} color="#34d399" fontWeight="700">
                      ≈ {Math.round(customResult.data.total_calories || 0)} kcal
                      （蛋白 {Math.round(customResult.data.total_protein || 0)}g / 脂肪 {Math.round(customResult.data.total_fat || 0)}g / 碳水 {Math.round(customResult.data.total_carbs || 0)}g）
                    </Text>
                    <Text fontSize={11} color={colors.textMuted}>{customResult.data.note}</Text>
                  </YStack>
                )}
              </YStack>
            )}

            {photoUri && (
              <View marginTop={10} borderRadius={radius.md} overflow="hidden" borderWidth={1} borderColor={colors.border}>
                <Image src={photoUri} width="100%" height={150} resizeMode="cover" />
              </View>
            )}
            {photoLoading && <YStack alignItems="center" padding={14}><Spinner color={colors.primary} /></YStack>}

            {/* 识别不出？快捷补录（零依赖，点选即识别） */}
            {photoUri && !photoLoading && (!recognized || recognized?.items?.length === 0) && (
              <YStack marginTop={10} gap={6}>
                <Text fontSize={12} color={colors.textMuted}>没识别出来？点选食物快捷补录：</Text>
                <XStack gap={6} flexWrap="wrap">
                  {COMMON_FOOD_CHIPS.map((f) => (
                    <Button
                      {...({ type: 'button' } as any)}
                      key={f}
                      size="$2"
                      paddingHorizontal={10}
                      paddingVertical={4}
                      height={30}
                      borderRadius={radius.pill}
                      backgroundColor={colors.surfaceLight}
                      borderWidth={1}
                      borderColor={colors.border}
                      onPress={() => quickPickFood(f)}
                      pressStyle={{ opacity: 0.7 }}
                    >
                      <Text fontSize={12} color={colors.textSecondary}>{f}</Text>
                    </Button>
                  ))}
                </XStack>
              </YStack>
            )}

            {/* 识别结果（可编辑，为识别结果兜底） */}
            {editItems.length > 0 && (
              <YStack marginTop={10} gap={6}>
                <Text fontSize={13} fontWeight="700" color={colors.text}>
                  识别结果（{recognized?.source === 'vision' ? 'AI 视觉' : '关键词'}）— 可修改
                </Text>
                <Text fontSize={11} color={colors.textMuted}>{recognized?.note}</Text>

                {editItems.map((it: any, i: number) => {
                  const ref = (recognized?.items || [])[i] || {};
                  return (
                    <XStack key={i} gap={6} alignItems="center"
                           backgroundColor={colors.surfaceLight} borderRadius={radius.sm} padding={8}>
                      <Input
                        flex={1}
                        height={34}
                        fontSize={13}
                        paddingHorizontal={8}
                        backgroundColor={colors.surface}
                        borderColor={colors.border}
                        value={it.food_name}
                        onChangeText={(t) => updateEditItem(i, { food_name: t })}
                        placeholder="食物名"
                      />
                      <Input
                        width={70}
                        height={34}
                        fontSize={13}
                        paddingHorizontal={8}
                        backgroundColor={colors.surface}
                        borderColor={colors.border}
                        value={String(it.weight_g ?? '')}
                        onChangeText={(t) => updateEditItem(i, { weight_g: t })}
                        keyboardType="numeric"
                        placeholder="克"
                      />
                      <Button
                        {...({ type: 'button' } as any)}
                        width={28}
                        height={28}
                        padding={0}
                        borderRadius={radius.sm}
                        backgroundColor="rgba(239,68,68,0.15)"
                        onPress={() => removeEditItem(i)}
                        pressStyle={{ opacity: 0.7 }}
                      >
                        <Text fontSize={13} color={colors.danger}>✕</Text>
                      </Button>
                      {it.cooking_method && (
                        <Text fontSize={10} color={colors.warning} width={64} textAlign="right">
                          {it.cooking_method}×{it.cooking_factor || 1}
                        </Text>
                      )}
                      {!it.cooking_method && ref.nutrition && (
                        <Text fontSize={10} color={colors.textMuted} width={64} textAlign="right">
                          {Math.round(ref.nutrition.calories || 0)} kcal
                        </Text>
                      )}
                    </XStack>
                  );
                })}

                {/* 添加食物 */}
                <XStack gap={6} alignItems="center">
                  <Input
                    flex={1}
                    height={34}
                    fontSize={13}
                    paddingHorizontal={8}
                    backgroundColor={colors.surface}
                    borderColor={colors.border}
                    value={newFoodName}
                    onChangeText={setNewFoodName}
                    placeholder="添加食物（如：清蒸鲈鱼 / 炒青菜）"
                    onSubmitEditing={addEditItem}
                  />
                  <Button
                    {...({ type: 'button' } as any)}
                    height={34}
                    paddingHorizontal={12}
                    borderRadius={radius.sm}
                    backgroundColor={colors.surfaceLight}
                    borderWidth={1}
                    borderColor={colors.border}
                    onPress={addEditItem}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <Text fontSize={12} color={colors.textSecondary} fontWeight="600">＋ 添加</Text>
                  </Button>
                </XStack>

                <Button
                  {...({ type: 'button' } as any)}
                  backgroundColor={colors.success}
                  borderRadius={radius.md}
                  onPress={confirmPhotoRecord}
                  disabled={photoLoading || editItems.length === 0}
                >
                  <Text color="#fff" fontWeight="700">确认并记录（{MEAL_LABELS[mealType] || mealType}）</Text>
                </Button>
              </YStack>
            )}
          </Card>

          <Card title="自然语言记录" accent="success">
            <ChipSelect label="餐次" options={MEAL_TYPES} value={mealType} onChange={setMealType} />
            <Input
              multiline
              height={130}
              textAlignVertical="top"
              placeholder="例：中午吃了一碗米饭，一份鸡胸肉，一份炒青菜，一个苹果..."
              value={nlpText}
              onChangeText={setNlpText}
              backgroundColor={colors.surfaceLight}
              borderRadius={radius.md}
              color={colors.text}
              marginTop={12}
              marginBottom={12}
            />
            <Button {...({ type: 'button' } as any)} backgroundColor={colors.primary} borderRadius={radius.md} onPress={handleNlp} disabled={loading || !nlpText.trim()}>
              {loading ? <Spinner color="white" /> : <Text color="#fff" fontWeight="600">记录并计算营养</Text>}
            </Button>
            <Text fontSize={11} color={colors.textMuted} marginTop={8}>支持拍照识别、食材搜索，营养数据基于权威食物成分库</Text>
          </Card>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}

export default DietScreen;
