// 动态表单引擎 —— 基于运动模板 fields_schema 动态渲染录入界面
// 新增运动项目仅需配置模板，无需重构前端
import React, { useState } from 'react';
import { Button, Input, Label, Text, View, XStack, YStack, ScrollView } from 'tamagui';
import { colors } from '../theme/tokens';
import { sanitizeNumber } from '../utils/input';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'exercise_picker' | 'exercise_list';
}

interface DynamicFormProps {
  title: string;
  fields: Field[];
  onSubmit: (values: Record<string, any>) => void;
  /** 一组可重复的动作字段（力量类） */
  repeatable?: boolean;
}

export function DynamicForm({ title, fields, onSubmit, repeatable = false }: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<Record<string, any>[]>([]);

  const setField = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const setRowField = (rowIdx: number, key: string, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...(next[rowIdx] || {}), [key]: value };
      return next;
    });
  };

  return (
    <ScrollView>
      <YStack padding="$4" gap="$3">
        <Text fontSize="$xl" fontWeight="bold" color="$text">
          {title}
        </Text>

        {repeatable ? (
          // 力量类：动作-组数-重量-次数 重复行
          <YStack gap="$3">
            {rows.map((row, idx) => (
              <View key={idx} padding="$3" backgroundColor={colors.surface} borderRadius="$3" gap="$2">
                {fields.map((f) => (
                  <YStack key={f.key} gap="$1">
                    <Label size="$2" color="$textMuted">{f.label}</Label>
                    <Input
                      size="$3"
                      keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                      placeholder={f.label}
                      value={row[f.key] ?? ''}
                      onChangeText={(v) => setRowField(idx, f.key, f.type === 'number' ? sanitizeNumber(v) : v)}
                    />
                  </YStack>
                ))}
                <Button size="$2" theme="red" onPress={() => setRows(rows.filter((_, i) => i !== idx))}>
                  删除该组
                </Button>
              </View>
            ))}
            <Button size="$3" theme="blue" onPress={() => setRows([...rows, {}])}>
              + 添加一组
            </Button>
          </YStack>
        ) : (
          // 普通字段
          <YStack gap="$3">
            {fields.map((f) => (
              <YStack key={f.key} gap="$1">
                <Label size="$2" color="$textMuted">{f.label}</Label>
                <Input
                  size="$3"
                  keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                  placeholder={f.label}
                  value={values[f.key] ?? ''}
                  onChangeText={(v) => setField(f.key, f.type === 'number' ? sanitizeNumber(v) : v)}
                />
              </YStack>
            ))}
          </YStack>
        )}

        <Button
          marginTop="$2"
          size="$4"
          backgroundColor={colors.primary}
          onPress={() => onSubmit(repeatable ? rows : values)}
        >
          保存记录
        </Button>
      </YStack>
    </ScrollView>
  );
}
