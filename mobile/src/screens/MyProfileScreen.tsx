// 我的资料页 —— 编辑/查看个人资料（头像/身高/体重/生日/所在地/健身房/目标/活动强度 + 生日隐私开关）
// 资料会推进社交：完善所在地/健身房后，粉丝/朋友/帖子作者可看公开主页，便于线下找搭子
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Button, Image, Input, ScrollView, Spinner, Text, View, XStack, YStack } from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { api } from '../api/client';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { ChipSelect } from '../components/ChipSelect';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/tokens';
import { fullUrl } from '../utils/url';

const GOAL_OPTIONS = [
  { key: 'muscle_gain', label: '增肌' },
  { key: 'fat_loss', label: '减脂' },
  { key: 'strength', label: '力量' },
  { key: 'endurance', label: '耐力' },
  { key: 'fitness', label: '塑形' },
  { key: 'maintain', label: '维持' },
];
const GENDER_OPTIONS = [
  { key: 'male', label: '男' },
  { key: 'female', label: '女' },
];
const ACTIVITY_OPTIONS = [
  { key: '1.2', label: '久坐' },
  { key: '1.375', label: '轻度' },
  { key: '1.55', label: '中度' },
  { key: '1.725', label: '高度' },
  { key: '1.9', label: '极高' },
];

function num(v: string) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function MyProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [height, setHeight] = useState(String(user?.height_cm ?? ''));
  const [weight, setWeight] = useState(String(user?.weight_kg ?? ''));
  const [bodyFat, setBodyFat] = useState(String(user?.body_fat_pct ?? ''));
  const [location, setLocation] = useState(user?.location || '');
  const [gym, setGym] = useState(user?.gym || '');
  const [goal, setGoal] = useState(user?.goal || '');
  const [activity, setActivity] = useState(String(user?.activity_factor ?? 1.4));
  const [showBirthday, setShowBirthday] = useState(!!user?.show_birthday);
  const [showLocation, setShowLocation] = useState(user?.show_location !== false);
  const [showGym, setShowGym] = useState(user?.show_gym !== false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ---- 更换头像 ----
  const pickAvatar = async (source: 'camera' | 'library') => {
    if (Platform.OS === 'web' && source === 'camera') {
      // web 端相机能力不稳定，统一走相册/文件选择
      pickAvatar('library');
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setMsg({ type: 'err', text: '需要相机权限' }); return; }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { setMsg({ type: 'err', text: '需要相册权限' }); return; }
      }
      const opt: any = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(opt)
        : await ImagePicker.launchImageLibraryAsync(opt);
      if (result.canceled || !result.assets?.length) return;
      let finalUri = result.assets[0].uri;
      try {
        const r = await ImageManipulator.manipulateAsync(
          finalUri, [{ resize: { width: 512 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        finalUri = r.uri;
      } catch { /* 原图上传 */ }
      const form = new FormData();
      const name = `avatar_${Date.now()}.jpg`;
      if (Platform.OS === 'web') {
        const res = await fetch(finalUri);
        const blob = await res.blob();
        form.append('file', new File([blob], name, { type: 'image/jpeg' }));
      } else {
        form.append('file', { uri: finalUri, name, type: 'image/jpeg' } as any);
      }
      const up = await api.uploadAvatar(form);
      if (up?.avatar_url) {
        await updateProfile({ avatar_url: up.avatar_url });
        setMsg({ type: 'ok', text: '✓ 头像已更新' });
        setTimeout(() => setMsg(null), 2000);
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: `头像上传失败：${e?.message || '请重试'}` });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const w = num(weight);
      const bf = num(bodyFat);
      await updateProfile({
        nickname: nickname.trim() || undefined,
        gender: gender || undefined,
        birthday: birthday || undefined,
        height_cm: num(height),
        weight_kg: w,
        body_fat_pct: bf,
        location: location.trim() || undefined,
        gym: gym.trim() || undefined,
        goal: goal || undefined,
        activity_factor: num(activity),
        show_birthday: showBirthday,
        show_location: showLocation,
        show_gym: showGym,
      });
      // 体重/体脂有填写时，写入身体数据历史（带填写时刻，用于复盘趋势）
      if (w != null || bf != null) {
        await api.createBodyMetric({
          record_date: new Date().toISOString().slice(0, 10),
          weight_kg: w,
          body_fat_pct: bf,
          recorded_at: new Date().toISOString(),
        });
      }
      setMsg({ type: 'ok', text: '✓ 已保存' });
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const copyId = async () => {
    const uid = user?.uid || user?.user_id;
    if (!uid) return;
    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(uid);
        } else {
          // HTTP 非安全上下文：降级到 execCommand
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
        setMsg({ type: 'ok', text: '请长按复制 ID' });
        return;
      }
      setMsg({ type: 'ok', text: '✓ ID 已复制' });
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg({ type: 'err', text: '复制失败' });
    }
  };

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="我的资料" subtitle="完善资料，便于找到搭子" onBack={() => navigation?.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* 头像卡片 */}
        <Card>
          <XStack gap={12} alignItems="center">
            <View
              width={64} height={64} borderRadius={32} backgroundColor={colors.primary}
              alignItems="center" justifyContent="center" overflow="hidden"
            >
              {user?.avatar_url ? (
                <Image src={fullUrl(user.avatar_url)} width="100%" height="100%" resizeMode="cover" />
              ) : (
                <Text fontSize={26} color="#fff" fontWeight="bold">{user?.nickname?.[0]?.toUpperCase() || 'U'}</Text>
              )}
            </View>
            <YStack gap={2} flex={1}>
              <Text fontSize={17} fontWeight="bold" color={colors.text}>{user?.nickname || user?.username}</Text>
              <XStack gap={8} alignItems="center">
                <Text fontSize={11} color={colors.textMuted}>ID: {user?.uid || '—'}</Text>
                <Button
                  {...({ type: 'button' } as any)}
                  height={22}
                  paddingHorizontal={8}
                  borderRadius={radius.pill}
                  backgroundColor={colors.surfaceLight}
                  borderWidth={1}
                  borderColor={colors.primary}
                  onPress={copyId}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text fontSize={10} color={colors.primary}>复制</Text>
                </Button>
              </XStack>
              <XStack gap={6} marginTop={4}>
                <Button
                  {...({ type: 'button' } as any)}
                  height={26}
                  paddingHorizontal={10}
                  borderRadius={radius.pill}
                  backgroundColor={colors.surfaceLight}
                  borderWidth={1}
                  borderColor={colors.border}
                  onPress={() => pickAvatar('camera')}
                  disabled={uploading}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text fontSize={11} color={colors.textSecondary}>拍照</Text>
                </Button>
                <Button
                  {...({ type: 'button' } as any)}
                  height={26}
                  paddingHorizontal={10}
                  borderRadius={radius.pill}
                  backgroundColor={colors.surfaceLight}
                  borderWidth={1}
                  borderColor={colors.border}
                  onPress={() => pickAvatar('library')}
                  disabled={uploading}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text fontSize={11} color={colors.textSecondary}>更换</Text>
                </Button>
              </XStack>
            </YStack>
          </XStack>
          {uploading && (
            <XStack gap={6} alignItems="center" marginTop={8}>
              <Spinner size="small" color={colors.primary} />
              <Text fontSize={12} color={colors.textMuted}>头像上传中…</Text>
            </XStack>
          )}
        </Card>

        {msg && (
          <View backgroundColor={msg.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'} borderRadius={radius.sm} padding={10}>
            <Text fontSize={12} color={msg.type === 'ok' ? colors.success : colors.danger}>{msg.text}</Text>
          </View>
        )}

        {/* 基础资料 */}
        <Card title="基础资料">
          <YStack gap={10}>
            <Field label="昵称" hint="公开显示的名字">
              <Input
                value={nickname}
                onChangeText={setNickname}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md}
                placeholder="昵称" color={colors.text}
              />
            </Field>
            <Field label="性别">
              <ChipSelect options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </Field>
            <Field label="生日" hint={showBirthday ? '将公开给关注你的人' : '仅自己可见'}>
              <Input
                value={birthday}
                onChangeText={setBirthday}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md}
                placeholder="YYYY-MM-DD" color={colors.text}
              />
            </Field>
            <XStack gap={8} alignItems="center" marginTop={4}>
              <input type="checkbox" checked={showBirthday} onChange={(e: any) => setShowBirthday(!!e.target.checked)} style={{ width: 16, height: 16 }} />
              <Text fontSize={12} color={colors.textSecondary}>公开生日（他人可在主页看到）</Text>
            </XStack>
          </YStack>
        </Card>

        {/* 身体数据 */}
        <Card title="身体数据">
          <XStack gap={10}>
            <YStack flex={1} gap={4}>
              <Text fontSize={12} color={colors.textMuted}>身高 (cm)</Text>
              <Input
                keyboardType="numeric"
                value={height}
                onChangeText={(v) => setHeight(v.replace(/[^\d.]/g, ''))}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md} color={colors.text}
              />
            </YStack>
            <YStack flex={1} gap={4}>
              <Text fontSize={12} color={colors.textMuted}>体重 (kg)</Text>
              <Input
                keyboardType="numeric"
                value={weight}
                onChangeText={(v) => setWeight(v.replace(/[^\d.]/g, ''))}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md} color={colors.text}
              />
            </YStack>
            <YStack flex={1} gap={4}>
              <Text fontSize={12} color={colors.textMuted}>体脂率 (%) 可选</Text>
              <Input
                keyboardType="numeric"
                value={bodyFat}
                onChangeText={(v) => setBodyFat(v.replace(/[^\d.]/g, ''))}
                placeholder="不填可留空"
                backgroundColor={colors.surfaceLight} borderRadius={radius.md} color={colors.text}
              />
            </YStack>
          </XStack>
          {height && weight && (
            <Text fontSize={11} color={colors.textMuted} marginTop={6}>
              BMI: {(Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1)}
            </Text>
          )}
        </Card>

        {/* 社交信息（推进社交） */}
        <Card title="社交信息" accent="primary">
          <YStack gap={10}>
            <Field label="所在地" hint="同城伙伴/教练可按位置推荐">
              <Input
                value={location}
                onChangeText={setLocation}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md}
                placeholder="如：上海·浦东" color={colors.text}
              />
            </Field>
            <ToggleRow checked={showLocation} onChange={setShowLocation} label="公开所在地" hint="关闭后他人看不到，也不参与同城推荐" />
            <Field label="常去健身房" hint="线下约练/找搭子">
              <Input
                value={gym}
                onChangeText={setGym}
                backgroundColor={colors.surfaceLight} borderRadius={radius.md}
                placeholder="如：SuperFit 静安店" color={colors.text}
              />
            </Field>
            <ToggleRow checked={showGym} onChange={setShowGym} label="公开健身房" hint="关闭后他人看不到" />
          </YStack>
        </Card>

        {/* 目标与活动强度 */}
        <Card title="目标与活动强度">
          <Field label="训练目标">
            <ChipSelect options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
          </Field>
          <YStack gap={4} marginTop={10}>
            <Field label="活动强度" hint="TDEE = BMR × 系数 + 训练消耗">
              <ChipSelect options={ACTIVITY_OPTIONS} value={String(activity)} onChange={setActivity} />
            </Field>
          </YStack>
        </Card>

        <Button
          {...({ type: 'button' } as any)}
          backgroundColor={colors.primary}
          borderRadius={radius.md}
          onPress={handleSave}
          disabled={saving}
          pressStyle={{ opacity: 0.85 }}
        >
          {saving ? <Spinner color="white" /> : <Text color="#fff" fontWeight="700">保存资料</Text>}
        </Button>
        <View height={20} />
      </ScrollView>
    </YStack>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <YStack gap={4}>
      <Text fontSize={12} color={colors.textMuted}>{label}</Text>
      {children}
      {hint && <Text fontSize={10} color={colors.textMuted}>{hint}</Text>}
    </YStack>
  );
}

function ToggleRow({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <YStack gap={2} marginTop={2}>
      <XStack gap={8} alignItems="center">
        <input type="checkbox" checked={checked} onChange={(e: any) => onChange(!!e.target.checked)} style={{ width: 16, height: 16 }} />
        <Text fontSize={13} color={colors.text}>{label}</Text>
        <Text fontSize={11} color={checked ? colors.success : colors.textMuted} fontWeight="600">
          {checked ? '公开' : '仅自己'}
        </Text>
      </XStack>
      {hint && <Text fontSize={10} color={colors.textMuted} marginLeft={24}>{hint}</Text>}
    </YStack>
  );
}

export default MyProfileScreen;
