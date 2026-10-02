// 全局训练状态 Context —— 训练跨页面持续（计时不中断、数据不清零）
// 组件卸载/切Tab不影响训练；组间休息倒计时也在全局层运行，供浮窗展示
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

import { api } from '../api/client';
import { emitDataEvent, DATA_EVENTS } from '../utils/events';
import { SPORT_NAME_TO_GROUP } from '../utils/constants';

// 一组训练
export interface WorkoutSet {
  id: string;
  reps: string;
  weight_kg: string;
  rpe: string;   // 主观强度 CR-10（0~10），每组一次
  done: boolean;
}
// 一个动作（含多组）
export interface WorkoutExercise {
  id: string;
  exercise_name: string;
  exercise_id?: string;
  sets: WorkoutSet[];
}

export interface SavedResult {
  session: any;
  durationMin: number;
  groupCount: number;
}

// CrossFit WOD 记录结构
export type WodMode = 'AMRAP' | 'EMOM' | 'Chipper';
export type TimerMode = 'count-up' | 'count-down';

export interface WodMovement {
  id: string;
  name: string;
  reps: string;
  weight_kg?: string;        // 重量(kg)
  description?: string;       // 动作描述/备注
  exerciseId?: string;        // 关联的库动作 id（公有 exercises_public 或私有 exercises_private）
  source?: 'public' | 'private';  // 来源：公有库 / 私有库（手动添加自动入私有库）
}

export interface WodData {
  mode: WodMode;
  timerMode: TimerMode;       // 正计时 / 倒计时
  timeCapMin: string;   // AMRAP：时间上限(分钟)
  rounds: string;       // AMRAP：完成轮数
  extraReps: string;    // AMRAP：额外次数
  totalMin: string;     // EMOM：总时长(分钟)
  totalTimeSec: string; // Chipper：总完成时间(秒)
  movements: WodMovement[];
}

export function emptyWod(): WodData {
  return {
    mode: 'AMRAP',
    timerMode: 'count-up',
    timeCapMin: '',
    rounds: '',
    extraReps: '',
    totalMin: '',
    totalTimeSec: '',
    movements: [],
  };
}

// Hyrox 记录结构 —— 固定 16 段赛程（8 段跑步 + 8 个功能站），每站可配动作 + 次数/距离 + 描述
export interface HyroxStation {
  id: string;
  name: string;           // 站点名（预设，用户可改）
  metric: string;         // 次数/距离（预设，用户可改）
  weight_kg?: string;     // 重量(kg)
  description?: string;   // 动作描述（手动输入）
  exerciseId?: string;    // 关联的库动作 id
  source?: 'public' | 'private';
  done: boolean;          // 训练中勾选完成
}

const HYROX_PRESETS: [string, string][] = [
  ['跑步', '1公里'],
  ['滑雪机 SkiErg', '1000米'],
  ['跑步', '1公里'],
  ['雪橇推 Sled Push', '50米'],
  ['跑步', '1公里'],
  ['雪橇拉 Sled Pull', '50米'],
  ['跑步', '1公里'],
  ['波比跳远 Burpee Broad Jumps', '80米'],
  ['跑步', '1公里'],
  ['划船 Rowing', '1000米'],
  ['跑步', '1公里'],
  ['农夫行走 Farmer\'s Carry', '200米'],
  ['跑步', '1公里'],
  ['沙袋箭步蹲 Sandbag Lunges', '100米'],
  ['跑步', '1公里'],
  ['投药球 Wall Balls', '100次'],
];

export function presetHyroxStations(): HyroxStation[] {
  return HYROX_PRESETS.map(([name, metric], i) => ({
    id: `h${i + 1}`,
    name,
    metric,
    description: undefined,
    exerciseId: undefined,
    source: undefined,
    done: false,
  }));
}

// 跑步记录结构 —— 长跑（手动输入距离/时间/心率）或自定义分组（每组距离+成绩+组间歇）
export type RunMode = 'long' | 'custom';

export interface LongRunData {
  distance: string;   // 距离(km)
  timeMin: string;    // 时间(分钟)
  avgHr: string;      // 平均心率(bpm)
  maxHr: string;      // 最高心率(bpm)
  climb: string;      // 累计爬升(米)，跑步/骑行/徒步用
}

export interface RunGroup {
  id: string;
  distance: string;   // 每组距离(米)
  timeSec: string;    // 成绩(秒)
  restSec: string;    // 组间歇(秒)
  done: boolean;      // 是否完成（完成后触发组间歇倒计时）
}

export function emptyLongRun(): LongRunData {
  return { distance: '', timeMin: '', avgHr: '', maxHr: '', climb: '' };
}

interface TrainingContextValue {
  started: boolean;
  elapsed: number;
  exercises: WorkoutExercise[];
  activeExId: string | null;
  restRemaining: number;
  restSeconds: number;
  saving: boolean;
  saved: SavedResult | null;
  category: string;
  setCategory: (c: string) => void;
  customSportName: string;
  setCustomSportName: (v: string) => void;
  wod: WodData;
  setWod: React.Dispatch<React.SetStateAction<WodData>>;
  hyroxStations: HyroxStation[];
  setHyroxStations: React.Dispatch<React.SetStateAction<HyroxStation[]>>;
  hyroxEditingId: string | null;
  setHyroxEditingId: (id: string | null) => void;
  metconAvgHr: string;
  setMetconAvgHr: (v: string) => void;
  metconMaxHr: string;
  setMetconMaxHr: (v: string) => void;
  overallRpe: string;         // 整节主观强度 Borg 6-20（有氧/CrossFit/Hyrox）
  setOverallRpe: (v: string) => void;
  runGroupAvgHr: string;
  setRunGroupAvgHr: (v: string) => void;
  runGroupMaxHr: string;
  setRunGroupMaxHr: (v: string) => void;
  runMode: RunMode;
  setRunMode: (m: RunMode) => void;
  longRun: LongRunData;
  setLongRun: React.Dispatch<React.SetStateAction<LongRunData>>;
  runGroups: RunGroup[];
  setRunGroups: React.Dispatch<React.SetStateAction<RunGroup[]>>;
  completeRunGroup: (id: string) => void;
  start: () => void;
  stop: () => Promise<void>;
  addExercises: (items: { name: string; exercise_id?: string }[]) => void;
  removeExercise: (exId: string) => void;
  completeSet: (exId: string, setId: string) => void;
  addNextSet: (exId: string) => void;
  setSetField: (exId: string, setId: string, key: 'reps' | 'weight_kg' | 'rpe', value: string) => void;
  setRestSeconds: (v: number) => void;
  skipRest: () => void;
  resetAfterSave: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [activeExId, setActiveExId] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restSeconds, setRestSeconds] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [category, setCategory] = useState('力量训练');
  const [customSportName, setCustomSportName] = useState('');
  const [wod, setWod] = useState<WodData>(emptyWod());
  const [hyroxStations, setHyroxStations] = useState<HyroxStation[]>([]);
  const [hyroxEditingId, setHyroxEditingId] = useState<string | null>(null);
  const [runMode, setRunMode] = useState<RunMode>('long');
  const [longRun, setLongRun] = useState<LongRunData>(emptyLongRun());
  const [runGroups, setRunGroups] = useState<RunGroup[]>([]);
  const [metconAvgHr, setMetconAvgHr] = useState('');
  const [metconMaxHr, setMetconMaxHr] = useState('');
  const [overallRpe, setOverallRpe] = useState('');
  const [runGroupAvgHr, setRunGroupAvgHr] = useState('');
  const [runGroupMaxHr, setRunGroupMaxHr] = useState('');

  const startRef = useRef<Date | null>(null);
  const timerRef = useRef<any>(null);
  const restTimerRef = useRef<any>(null);

  const stopRestTimer = useCallback(() => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    setRestRemaining(0);
  }, []);

  // 启动组间休息倒计时（全局层，跨页面继续）
  const startRest = useCallback((seconds: number) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setRestRemaining(Math.max(1, seconds));
    restTimerRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          if (restTimerRef.current) clearInterval(restTimerRef.current);
          restTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 全局清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    setSaved(null);
    stopRestTimer();
    startRef.current = new Date();
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (startRef.current) {
        // 基于绝对时间差计算，确保总时长持续累计（跨页面/选动作/休息均不重置）
        setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000));
      }
    }, 1000);
  }, [stopRestTimer]);

  const stop = useCallback(async () => {
    if (!startRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopRestTimer();
    const durationMin = Math.max(0, Math.round((Date.now() - startRef.current.getTime()) / 60000));
    // 每个完成的组 = 一条 exercise 记录（sets=1），保证容量计算正确
    const exList: any[] = [];
    exercises.forEach((ex) => {
      ex.sets
        .filter((s) => s.done && (s.reps || s.weight_kg))
        .forEach((s) => {
          exList.push({
            exercise_name: ex.exercise_name,
            exercise_id: ex.exercise_id,
            sets: 1,
            reps: s.reps ? parseInt(s.reps, 10) : 0,
            weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : 0,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
          });
        });
    });

    setSaving(true);
    try {
      const group = SPORT_NAME_TO_GROUP[category] || category;
      const sportName = category === '自定义'
        ? (customSportName.trim() || '自定义')
        : category;
      const payload: any = {
        category: group,
        sport_name: sportName,
        start_time: startRef.current.toISOString(),
        duration: durationMin,
        exercises: exList,
        notes: exList.length === 0 ? '空训练（未记录动作）' : undefined,
      };
      // CrossFit：附加 WOD 结构 + 心率
      if (category === 'CrossFit') {
        payload.detail = {
          wod: { ...wod, movements: wod.movements.filter((m) => m.name.trim()) },
          avg_hr: metconAvgHr.trim(),
          max_hr: metconMaxHr.trim(),
        };
      }
      // Hyrox：附加固定赛程站点列表 + 心率
      if (category === 'Hyrox') {
        payload.detail = {
          hyrox: {
            stations: hyroxStations.map((s) => ({
              ...s,
              name: s.name.trim(),
              metric: s.metric.trim(),
              description: s.description?.trim() || undefined,
            })),
          },
          avg_hr: metconAvgHr.trim(),
          max_hr: metconMaxHr.trim(),
        };
      }
      // 跑步/骑行/游泳/徒步：单次长距离或自定义分组
      if (category === '跑步' || category === '骑行' || category === '游泳' || category === '徒步') {
        if (runMode === 'long') {
          const tm = parseFloat(longRun.timeMin);
          if (tm > 0) payload.duration = Math.round(tm);
          payload.detail = {
            run: {
              mode: 'long',
              distance: longRun.distance.trim(),
              time_min: longRun.timeMin.trim(),
              avg_hr: longRun.avgHr.trim(),
              max_hr: longRun.maxHr.trim(),
              climb: longRun.climb.trim(),
            },
          };
        } else {
          const groups = runGroups
            .filter((g) => g.distance.trim() || g.timeSec.trim())
            .map((g) => ({ distance: g.distance.trim(), time_sec: g.timeSec.trim(), rest_sec: g.restSec.trim() }));
          const totalSec = runGroups.reduce(
            (s, g) => s + (parseFloat(g.timeSec) || 0) + (parseFloat(g.restSec) || 0),
            0
          );
          if (totalSec > 0) payload.duration = Math.round(totalSec / 60);
          payload.detail = {
            run: {
              mode: 'custom',
              groups,
              avg_hr: runGroupAvgHr.trim(),
              max_hr: runGroupMaxHr.trim(),
            },
          };
        }
      }
      // 整体主观疲劳 RPE（有氧/CrossFit/Hyrox，Borg 6-20）；力量走每组 CR-10
      if (
        (category === '跑步' || category === '骑行' || category === '游泳' || category === '徒步'
          || category === 'CrossFit' || category === 'Hyrox')
        && overallRpe && parseFloat(overallRpe) > 0
      ) {
        payload.rpe = parseFloat(overallRpe);
      }
      const res = await api.createSession(payload);
      setSaved({ session: res, durationMin, groupCount: exList.length });
      // 保存成功即结束本次训练（数据保留在 saved 供展示，下次开始清空）
      setStarted(false);
      startRef.current = null;
      setElapsed(0);
      // 广播事件，通知首页刷新训练数据
      emitDataEvent(DATA_EVENTS.TRAINING_UPDATED);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setSaving(false);
    }
  }, [category, customSportName, wod, hyroxStations, runMode, longRun, runGroups, runGroupAvgHr, runGroupMaxHr, metconAvgHr, metconMaxHr, overallRpe, exercises, stopRestTimer]);

  const addExercises = useCallback((items: { name: string; exercise_id?: string }[]) => {
    if (!items?.length) return;
    const newExs: WorkoutExercise[] = items.map((p) => ({
      id: Math.random().toString(36).slice(2),
      exercise_name: p.name,
      exercise_id: p.exercise_id,
      sets: [{ id: Math.random().toString(36).slice(2), reps: '', weight_kg: '', rpe: '', done: false }],
    }));
    setExercises((prev) => [...prev, ...newExs]);
    setActiveExId(newExs[0].id);
  }, []);

  const removeExercise = useCallback((exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
    setActiveExId((cur) => (cur === exId ? null : cur));
  }, []);

  const completeSet = useCallback((exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, done: true } : s)) }
          : ex
      )
    );
    // 完成一组即按配置时长进入组间休息
    startRest(restSeconds);
  }, [stopRestTimer, restSeconds]);

  const addNextSet = useCallback((exId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? { ...ex, sets: [...ex.sets, { id: Math.random().toString(36).slice(2), reps: '', weight_kg: '', rpe: '', done: false }] }
          : ex
      )
    );
  }, []);

  // 完成一组跑步分组：标记 done，用该组组间歇启动休息倒计时
  const completeRunGroup = useCallback((groupId: string) => {
    setRunGroups((prev) => {
      const target = prev.find((g) => g.id === groupId);
      const restSec = target ? (parseFloat(target.restSec) || restSeconds) : restSeconds;
      startRest(restSec);
      return prev.map((g) => (g.id === groupId ? { ...g, done: true } : g));
    });
  }, [restSeconds, startRest]);

  const setSetField = useCallback((exId: string, setId: string, key: 'reps' | 'weight_kg' | 'rpe', value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, [key]: value } : s)) }
          : ex
      )
    );
  }, []);

  const setRestSecondsCb = useCallback((v: number) => {
    setRestSeconds(v);
    // 若正在休息，用新时长重置倒计时
    if (restTimerRef.current) {
      startRest(v);
    }
  }, [startRest]);

  const skipRest = useCallback(() => {
    stopRestTimer();
  }, [stopRestTimer]);

  const resetAfterSave = useCallback(() => {
    setSaved(null);
    setExercises([]);
    setActiveExId(null);
    setStarted(false);
    startRef.current = null;
    setElapsed(0);
    setWod(emptyWod());
    setHyroxStations([]);
    setHyroxEditingId(null);
    setMetconAvgHr('');
    setMetconMaxHr('');
    setOverallRpe('');
    setRunGroupAvgHr('');
    setRunGroupMaxHr('');
    setRunMode('long');
    setLongRun(emptyLongRun());
    setRunGroups([]);
  }, []);

  const value: TrainingContextValue = {
    started, elapsed, exercises, activeExId, restRemaining, restSeconds,
    saving, saved, category, setCategory, customSportName, setCustomSportName,
    wod, setWod,
    hyroxStations, setHyroxStations, hyroxEditingId, setHyroxEditingId,
    metconAvgHr, setMetconAvgHr, metconMaxHr, setMetconMaxHr,
    overallRpe, setOverallRpe,
    runGroupAvgHr, setRunGroupAvgHr, runGroupMaxHr, setRunGroupMaxHr,
    runMode, setRunMode, longRun, setLongRun, runGroups, setRunGroups, completeRunGroup,
    start, stop, addExercises, removeExercise, completeSet, addNextSet,
    setSetField, setRestSeconds: setRestSecondsCb, skipRest, resetAfterSave,
  };

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining must be used within TrainingProvider');
  return ctx;
}

export default TrainingProvider;
