// 全局常量定义

// 运动大类（训练选择页用 8 项；与后端 sport_templates.category 的映射见 SPORT_NAME_TO_GROUP）
export const SPORT_CATEGORIES = [
  { key: '力量训练', label: '力量训练' },
  { key: 'CrossFit', label: 'CrossFit' },
  { key: 'Hyrox', label: 'Hyrox' },
  { key: '跑步', label: '跑步' },
  { key: '骑行', label: '骑行' },
  { key: '游泳', label: '游泳' },
  { key: '徒步', label: '徒步' },
  { key: '自定义', label: '自定义' },
];

// 选中项（sport_name）→ 后端 category（旧分类，保证模板/历史数据兼容）
export const SPORT_NAME_TO_GROUP: Record<string, string> = {
  '力量训练': '力量健美',
  'CrossFit': '功能训练',
  'Hyrox': '功能训练',
  '跑步': '田径耐力',
  '骑行': '田径耐力',
  '游泳': '田径耐力',
  '徒步': '田径耐力',
  '篮球': '球类运动',
  '羽毛球': '球类运动',
  '格斗': '格斗对抗',
  '搏击': '格斗对抗',
  '瑜伽': '休闲身心',
  '普拉提': '休闲身心',
  '自定义': '自定义',
};

// 餐次枚举
export const MEAL_TYPES = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
];

// 训练目标
export const TRAINING_GOALS = [
  { key: 'muscle_gain', label: '增肌' },
  { key: 'fat_loss', label: '减脂' },
  { key: 'strength', label: '力量提升' },
  { key: 'endurance', label: '耐力提升' },
  { key: 'maintain', label: '保持健康' },
];

// 内置运动模板（阶段一核心：力量/跑步/CrossFit）
export const BUILTIN_TEMPLATES = [
  {
    template_id: 'strength_workout',
    category: '力量健美',
    sport_name: '力量训练',
    fields_schema: {
      type: 'exercise_sets',  // 动作-组数-重量-次数
      fields: [
        { key: 'exercise_name', label: '动作', type: 'exercise_picker' },
        { key: 'sets', label: '组数', type: 'number' },
        { key: 'reps', label: '次数', type: 'number' },
        { key: 'weight_kg', label: '重量(kg)', type: 'number' },
      ],
    },
  },
  {
    template_id: 'run_workout',
    category: '田径耐力',
    sport_name: '跑步',
    fields_schema: {
      type: 'run',
      fields: [
        { key: 'distance_m', label: '距离(km)', type: 'number' },
        { key: 'duration_sec', label: '时长(min)', type: 'number' },
        { key: 'pace', label: '配速(min/km)', type: 'number' },
      ],
    },
  },
  {
    template_id: 'crossfit_wod',
    category: '功能训练',
    sport_name: 'CrossFit WOD',
    fields_schema: {
      type: 'wod',
      fields: [
        { key: 'wod_mode', label: '模式(AMRAP/For Time)', type: 'text' },
        { key: 'rounds', label: '完成轮数', type: 'number' },
        { key: 'duration_sec', label: '完成时长(min)', type: 'number' },
        { key: 'exercises', label: '动作列表', type: 'exercise_list' },
      ],
    },
  },
];
