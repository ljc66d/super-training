// 配色主题设置页面 —— 三块区域自由选色（主色/强调色/背景色）+ 预设搭配
import React from 'react';
import { Text, YStack, XStack, View } from 'tamagui';

import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import { colors, radius } from '../theme/tokens';
import { PRIMARY_PALETTE, ACCENT_PALETTE, BACKGROUND_PALETTE, LIGHT_BACKGROUND_PALETTE } from '../theme/themes';

export function ThemeSettingsScreen({ navigation }: any) {
  const { themeKey, themes, custom, darkMode, setTheme, setCustomColor, setDarkMode } = useTheme();

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="配色主题" subtitle="自由搭配你的专属配色" onBack={() => navigation.goBack()} />

      <YStack padding={16} gap={16}>
        {/* 外观模式：深色 / 浅色 */}
        <Card title="外观模式" accent="success">
          <XStack gap={8}>
            {[
              { v: true, label: '深色模式', color: '#0B1220' },
              { v: false, label: '浅色模式', color: '#F1F5F9' },
            ].map((m) => {
              const active = darkMode === m.v;
              return (
                <View
                  key={String(m.v)}
                  flex={1}
                  paddingVertical={12}
                  borderRadius={radius.md}
                  alignItems="center"
                  backgroundColor={active ? colors.primary : colors.surfaceLight}
                  borderWidth={1}
                  borderColor={active ? colors.primary : colors.border}
                  onPress={() => setDarkMode(m.v)}
                >
                  <XStack gap={6} alignItems="center">
                    <View width={14} height={14} borderRadius={7} backgroundColor={m.color} borderWidth={1} borderColor="rgba(128,128,128,0.5)" />
                    <Text fontSize={13} fontWeight={active ? '700' : '500'} color={active ? '#fff' : colors.textSecondary}>
                      {m.label}
                    </Text>
                  </XStack>
                </View>
              );
            })}
          </XStack>
          <Text fontSize={11} color={colors.textMuted} marginTop={8}>
            切换后全站配色即时生效，主色/强调色/背景色仍可自由调整
          </Text>
        </Card>

        <Card title="自由选色" accent="primary">
          <YStack gap={14}>
            <Text fontSize={12} color={colors.textMuted}>
              三块区域可分别选择颜色（色板点选或自定义取色器），组合成你的专属配色
            </Text>

            <ColorPickerRow label="主色" current={custom.primary} palette={PRIMARY_PALETTE} onPick={(c) => setCustomColor('primary', c)} />
            <ColorPickerRow label="强调色" current={custom.accent} palette={ACCENT_PALETTE} onPick={(c) => setCustomColor('accent', c)} />
            <ColorPickerRow
              label={darkMode ? '背景色（深色系）' : '背景色（浅色系）'}
              current={custom.background}
              palette={darkMode ? BACKGROUND_PALETTE : LIGHT_BACKGROUND_PALETTE}
              onPick={(c) => setCustomColor('background', c)}
            />
          </YStack>
        </Card>

        <Card title="预设搭配" accent="warning">
          <YStack gap={10}>
            <Text fontSize={12} color={colors.textMuted}>应用整套配色</Text>
            <XStack gap={8} flexWrap="wrap">
              {themes.map((t) => {
                const active = themeKey === t.key;
                return (
                  <View
                    key={t.key}
                    paddingHorizontal={10}
                    paddingVertical={6}
                    borderRadius={radius.pill}
                    backgroundColor={active ? t.primary : colors.surfaceLight}
                    borderWidth={active ? 0 : 1}
                    borderColor={colors.border}
                    onPress={() => setTheme(t.key)}
                  >
                    <XStack gap={5} alignItems="center">
                      <View width={12} height={12} borderRadius={6} backgroundColor={t.primary} borderWidth={1} borderColor="rgba(255,255,255,0.4)" />
                      <View width={12} height={12} borderRadius={6} backgroundColor={t.accent} borderWidth={1} borderColor="rgba(255,255,255,0.4)" />
                      <Text fontSize={11} fontWeight={active ? '700' : '500'} color={active ? '#fff' : colors.textSecondary}>
                        {t.name}
                      </Text>
                    </XStack>
                  </View>
                );
              })}
            </XStack>
          </YStack>
        </Card>
      </YStack>
    </YStack>
  );
}

// 单块区域的自由选色行：色板圆点 + 自定义取色器
function ColorPickerRow({ label, current, palette, onPick }: {
  label: string;
  current: string;
  palette: string[];
  onPick: (color: string) => void;
}) {
  return (
    <YStack gap={6}>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={12} color={colors.textMuted}>{label}</Text>
        {/* 自定义取色器（原生 color picker） */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="color"
            value={current}
            onChange={(e) => onPick(e.target.value)}
            style={{ width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          />
          <Text fontSize={11} color={colors.textSecondary}>{current}</Text>
        </label>
      </XStack>
      <XStack gap={8} flexWrap="wrap">
        {palette.map((c) => {
          const active = current.toLowerCase() === c.toLowerCase();
          return (
            <View
              key={c}
              width={28}
              height={28}
              borderRadius={14}
              backgroundColor={c}
              borderWidth={active ? 2 : 1}
              borderColor={active ? colors.text : 'rgba(255,255,255,0.25)'}
              onPress={() => onPick(c)}
            />
          );
        })}
      </XStack>
    </YStack>
  );
}

export default ThemeSettingsScreen;
