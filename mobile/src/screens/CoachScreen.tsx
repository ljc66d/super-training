// 教练端页面 —— 成为教练/学员管理/学员数据复盘
import React, { useEffect, useState } from 'react';
import { Button, Text, YStack, XStack, ScrollView, View, Input, Spinner } from 'tamagui';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { colors, radius } from '../theme/tokens';

export function CoachScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const [isCoach, setIsCoach] = useState(user?.is_coach ?? false);
  const [specialty, setSpecialty] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [addStudentId, setAddStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSummary, setStudentSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsCoach(user?.is_coach ?? false);
  }, [user]);

  useEffect(() => {
    if (isCoach) loadStudents();
  }, [isCoach]);

  const loadStudents = async () => {
    try {
      const s = await api.getStudents();
      setStudents(s);
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  const handleBecomeCoach = async () => {
    setLoading(true);
    try {
      const res = await api.becomeCoach(specialty);
      setIsCoach(true);
      await updateProfile({ is_coach: true, specialty });
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!addStudentId.trim()) return;
    try {
      await api.addStudent(addStudentId.trim());
      setAddStudentId('');
      loadStudents();
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  const handleStudentSelect = async (sid: string) => {
    setSelectedStudent(sid);
    try {
      const s = await api.getStudentSummary(sid);
      setStudentSummary(s);
    } catch (e: any) {
      console.warn(e.message);
    }
  };

  // 非教练状态
  if (!isCoach) {
    return (
      <YStack flex={1} backgroundColor={colors.background}>
        <BackHeader title="教练端" subtitle="教练专属功能" onBack={() => navigation.goBack()} />
        <ScrollView padding={16}>
          <Card accent="primary">
            <YStack alignItems="center" gap={12} paddingVertical={16}>
              <Text fontSize={48}>‍</Text>
              <Text fontSize={18} fontWeight="bold" color={colors.text}>成为教练</Text>
              <Text fontSize={13} color={colors.textMuted} textAlign="center">
                管理学员、分发训练计划、查看学员数据复盘
              </Text>
              <Input
                width="100%"
                placeholder="教练专长（如：力量训练）"
                value={specialty}
                onChangeText={setSpecialty}
                backgroundColor={colors.surfaceLight}
                borderRadius={radius.md}
                color={colors.text}
              />
              <Button backgroundColor={colors.primary} borderRadius={radius.md} width="100%" onPress={handleBecomeCoach} disabled={loading}>
                {loading ? <Spinner color="white" /> : <Text color="#fff" fontWeight="600">成为教练</Text>}
              </Button>
            </YStack>
          </Card>
        </ScrollView>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      <BackHeader title="教练工作台" subtitle={`专长：${user?.specialty || '未设置'}`} onBack={() => navigation.goBack()} />
      <ScrollView padding={16} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <YStack gap={16}>
          {/* 添加学员 */}
          <Card title="添加学员" accent="success">
            <XStack gap={8}>
              <Input
                flex={1}
                placeholder="输入学员ID"
                value={addStudentId}
                onChangeText={setAddStudentId}
                backgroundColor={colors.surfaceLight}
                borderRadius={radius.md}
                color={colors.text}
              />
              <Button backgroundColor={colors.primary} onPress={handleAddStudent}>
                <Text color="#fff" fontWeight="600">添加</Text>
              </Button>
            </XStack>
          </Card>

          {/* 学员列表 */}
          <Card title={`我的学员（${students.length}）`}>
            {students.length === 0 ? (
              <EmptyState icon="" title="还没有学员" description="输入学员ID添加第一个学员" />
            ) : (
              <YStack gap={8}>
                {students.map((s) => (
                  <View
                    key={s.student_id}
                    backgroundColor={selectedStudent === s.student_id ? colors.primarySoft : colors.surfaceLight}
                    borderRadius={radius.md}
                    padding={12}
                    onPress={() => handleStudentSelect(s.student_id)}
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack gap={2}>
                        <Text fontSize={14} fontWeight="600" color={colors.text}>{s.nickname}</Text>
                        <Text fontSize={11} color={colors.textMuted}>{s.student_id.slice(0, 8)}</Text>
                      </YStack>
                      {s.goal && <Badge text={s.goal} tone="primary" />}
                    </XStack>
                  </View>
                ))}
              </YStack>
            )}
          </Card>

          {/* 学员复盘 */}
          {selectedStudent && studentSummary && (
            <Card title="学员数据复盘" accent="warning">
              <XStack gap={8} flexWrap="wrap">
                <View flex={1} minWidth={80} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} alignItems="center">
                  <Text fontSize={20} fontWeight="bold" color={colors.primary}>{studentSummary.total_sessions}</Text>
                  <Text fontSize={11} color={colors.textMuted}>总训练次数</Text>
                </View>
                <View flex={1} minWidth={80} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} alignItems="center">
                  <Text fontSize={20} fontWeight="bold" color={colors.accent}>{Math.round(studentSummary.total_training_calories)}</Text>
                  <Text fontSize={11} color={colors.textMuted}>消耗(kcal)</Text>
                </View>
                <View flex={1} minWidth={80} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} alignItems="center">
                  <Text fontSize={20} fontWeight="bold" color={colors.warning}>{studentSummary.week_sessions_count}</Text>
                  <Text fontSize={11} color={colors.textMuted}>本周训练</Text>
                </View>
                <View flex={1} minWidth={80} backgroundColor={colors.surfaceLight} borderRadius={radius.md} padding={12} alignItems="center">
                  <Text fontSize={20} fontWeight="bold" color={colors.success}>{Math.round(studentSummary.today_food_calories)}</Text>
                  <Text fontSize={11} color={colors.textMuted}>今日摄入</Text>
                </View>
              </XStack>
              {studentSummary.latest_body?.weight_kg && (
                <Text fontSize={12} color={colors.textMuted} marginTop={12}>
                  最新体重：{studentSummary.latest_body.weight_kg}kg · {studentSummary.latest_body.record_date}
                </Text>
              )}
            </Card>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export default CoachScreen;
