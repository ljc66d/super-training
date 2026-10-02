// 动作库选择器 —— 从公有/私有动作库搜索选择动作
import React, { useEffect, useState } from 'react';
import { Input, Text, View, YStack, XStack, ScrollView, Spinner } from 'tamagui';
import { api } from '../api/client';
import { colors, radius } from '../theme/tokens';

interface Props {
  onSelect: (exercise: { name: string; exercise_id?: string }) => void;
  placeholder?: string;
}

export function ExercisePicker({ onSelect, placeholder }: Props) {
  const [kw, setKw] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.getExercises(kw.trim());
        setResults((data || []).slice(0, 8));
      } catch (e: any) {
        console.warn(e.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [kw]);

  return (
    <YStack gap={6}>
      <Input
        value={kw}
        onChangeText={setKw}
        placeholder={placeholder || '搜索动作（中文/英文）'}
        backgroundColor={colors.surface}
        borderRadius={radius.md}
        color={colors.text}
      />
      {loading && <Spinner size="small" color={colors.primary} />}
      {results.length > 0 && (
        <View backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={4}>
          {results.map((ex) => {
            const display = ex.name_zh || ex.name;
            const selected = picked === ex.exercise_id;
            return (
              <View
                key={ex.exercise_id}
                paddingVertical={8}
                paddingHorizontal={10}
                borderRadius={radius.sm}
                backgroundColor={selected ? colors.primary : 'transparent'}
                onPress={() => {
                  setPicked(ex.exercise_id);
                  onSelect({ name: display, exercise_id: ex.exercise_id });
                }}
              >
                <Text fontSize={13} color={selected ? '#fff' : colors.text}>{display}</Text>
                {ex.name_zh && ex.name !== ex.name_zh && (
                  <Text fontSize={11} color={selected ? 'rgba(255,255,255,0.8)' : colors.textMuted}>{ex.name}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
      {kw.trim() && results.length === 0 && !loading && (
        <Text fontSize={12} color={colors.textMuted}>未找到，可手动输入或创建动作</Text>
      )}
    </YStack>
  );
}

export default ExercisePicker;
