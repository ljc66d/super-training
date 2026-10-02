// 通用月历组件 —— 支持月份切换、标记有数据的日期、点击选择日期
import React from 'react';
import { Text, XStack, YStack, View } from 'tamagui';
import { colors, radius } from '../theme/tokens';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export interface MonthCalendarProps {
  /** 当前选中的日期，格式 YYYY-MM-DD */
  selectedDate: string;
  /** 有数据的日期集合，格式 YYYY-MM-DD，用于高亮标记 */
  markedDates?: string[];
  onSelect: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pad2(n: number) {
  return `${n}`.padStart(2, '0');
}

export function MonthCalendar({ selectedDate, markedDates = [], onSelect, onMonthChange }: MonthCalendarProps) {
  const [viewYear, setViewYear] = React.useState<number>(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = React.useState<number>(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return d.getMonth() + 1;
  });

  const markedSet = React.useMemo(() => new Set(markedDates), [markedDates]);

  const changeMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y);
    setViewMonth(m);
    onMonthChange?.(y, m);
  };

  // 计算当月网格：当月1号前的占位 + 当月所有天数
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const todayStr = formatDate(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${pad2(viewMonth)}-${pad2(d)}`);
  }

  return (
    <View backgroundColor={colors.surface} borderRadius={radius.lg} padding={12} borderWidth={1} borderColor={colors.border}>
      {/* 月份切换 */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom={10}>
        <View padding={8} borderRadius={radius.md} backgroundColor={colors.surfaceLight} onPress={() => changeMonth(-1)} accessibilityRole="button">
          <Text color={colors.text}>‹</Text>
        </View>
        <Text fontSize={16} fontWeight="bold" color={colors.text}>{viewYear}年{viewMonth}月</Text>
        <View padding={8} borderRadius={radius.md} backgroundColor={colors.surfaceLight} onPress={() => changeMonth(1)} accessibilityRole="button">
          <Text color={colors.text}>›</Text>
        </View>
      </XStack>

      {/* 星期表头 */}
      <XStack>
        {WEEKDAYS.map((w) => (
          <View key={w} flex={1} alignItems="center" paddingVertical={4}>
            <Text fontSize={11} color={colors.textMuted}>{w}</Text>
          </View>
        ))}
      </XStack>

      {/* 日期网格 */}
      <XStack flexWrap="wrap">
        {cells.map((date, idx) => {
          if (!date) {
            return <View key={`empty-${idx}`} width="14.28%" aspectRatio={1} padding={2} />;
          }
          const day = parseInt(date.slice(8, 10), 10);
          const isSelected = date === selectedDate;
          const isMarked = markedSet.has(date);
          const isToday = date === todayStr;
          const isFuture = date > todayStr;

          return (
            <View key={date} width="14.28%" aspectRatio={1} padding={2}>
              <View
                flex={1}
                alignItems="center"
                justifyContent="center"
                borderRadius={radius.md}
                backgroundColor={isSelected ? colors.primary : 'transparent'}
                borderWidth={isToday && !isSelected ? 1 : 0}
                borderColor={colors.primary}
                onPress={isFuture ? undefined : () => onSelect(date)}
                opacity={isFuture ? 0.3 : 1}
                accessibilityRole={isFuture ? undefined : 'button'}
              >
                <Text
                  fontSize={13}
                  fontWeight={isSelected ? 'bold' : '600'}
                  color={isSelected ? '#fff' : colors.text}
                >
                  {day}
                </Text>
                {/* 有数据的标记点 */}
                <View
                  width={5}
                  height={5}
                  borderRadius={3}
                  marginTop={2}
                  backgroundColor={isSelected ? '#fff' : isMarked ? colors.accent : 'transparent'}
                />
              </View>
            </View>
          );
        })}
      </XStack>
    </View>
  );
}

export default MonthCalendar;
