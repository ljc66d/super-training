/**
 * API 层：对齐 mobile/src/api/client.ts 全部接口（FastAPI + JWT）
 * 后端统一响应 { code: 0, data }，本层直接返回 data。
 */
import { http, uploadFile } from './request';
import { uploadToCloud, getCloudFileUrl } from './url';

/**
 * 大文件传输约定：callContainer 请求包上限 100KB，图片/视频不能走请求体。
 * 统一先 wx.cloud.uploadFile 传云存储，再用临时链接调后端 URL 接口拉取。
 * 传完即删云文件（后端拉取只发生在调用瞬间，删除不影响）。
 */
async function uploadAndGetUrl(filePath: string, dir: string): Promise<{ url: string; fileID: string }> {
  const ext = (filePath.split('.').pop() || 'bin').toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  const fileID = await uploadToCloud(filePath, `temp/${dir}/${Date.now()}-${rand}.${ext}`);
  const url = await getCloudFileUrl(fileID);
  return { url, fileID };
}

function deleteCloudFile(fileID: string) {
  try {
    wx.cloud.deleteFile({ fileList: [fileID] });
  } catch (e) { /* 清理失败无妨 */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const api = {
  // ---------- 认证 ----------
  register: (username: string, password: string, nickname?: string) =>
    http.post('/auth/register', { username, password, nickname }),
  login: (username: string, password: string) =>
    http.post('/auth/login', { username, password }),
  /** 微信小程序登录：code → openid → 查/建账号 → JWT */
  wxLogin: (code: string, nickname?: string) =>
    http.post('/auth/wx-login', { code, nickname }),
  getMe: () => http.get('/auth/me'),
  updateMe: (data: any) => http.put('/auth/me', data),
  uploadAvatar: (filePath: string) => uploadFile('/auth/avatar', filePath),
  getPublicProfile: (userId: string) => http.get(`/auth/users/${userId}/public-profile`),

  // ---------- 综合数据 ----------
  getEnergyNeeds: () => http.get('/energy-needs'),
  getToday: () => http.get('/today'),
  getStatsTrend: (days: number = 30) => http.get(`/stats/trend?days=${days}`),
  getFatigue: () => http.get('/stats/fatigue'),
  getExerciseHistory: (name: string, limit: number = 50) =>
    http.get(`/stats/exercise-history?name=${encodeURIComponent(name)}&limit=${limit}`),
  getRecommendFoods: (limit: number = 6) =>
    http.get(`/stats/recommend-foods?limit=${limit}`),

  // ---------- 训练 ----------
  getTemplates: () => http.get('/templates'),
  getExercises: (keyword?: string, category?: string, limit?: number, group?: string) => {
    const params: string[] = [];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (limit) params.push(`limit=${limit}`);
    if (group) params.push(`group=${encodeURIComponent(group)}`);
    const qs = params.join('&');
    return http.get(`/exercises${qs ? `?${qs}` : ''}`);
  },
  getExerciseGroups: () => http.get('/exercises/groups'),
  createSession: (payload: any) => http.post('/sessions', payload),
  createSessionNlp: (text: string, startTime: string) =>
    http.post('/sessions/nlp', { text, start_time: startTime }),
  getSessionStats: () => http.get('/sessions/stats'),
  getSessions: () => http.get('/sessions'),
  // 自定义运动种类
  getCustomSports: () => http.get('/custom-sports'),
  addCustomSport: (sportName: string) => http.post('/custom-sports', { sport_name: sportName }),
  deleteCustomSport: (customSportId: string) => http.del(`/custom-sports/${customSportId}`),

  // ---------- 饮食 ----------
  getFoodGroups: () => http.get('/diet/food-groups'),
  getFoods: (keyword?: string, group?: string) => {
    const params: string[] = [];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (group) params.push(`group=${group}`);
    return http.get(`/diet/foods${params.length ? `?${params.join('&')}` : ''}`);
  },
  recognizeDietPhoto: async (filePath: string, hint?: string) => {
    const { url, fileID } = await uploadAndGetUrl(filePath, 'diet');
    try {
      return await http.post('/diet/photo/recognize-url', { url, hint });
    } finally {
      deleteCloudFile(fileID);
    }
  },
  recordDietPhoto: (hint: string, mealType: string, itemsJson?: string) =>
    http.post('/diet/photo/record', itemsJson
      ? { hint, meal_type: mealType, items_json: itemsJson }
      : { hint, meal_type: mealType }),
  classifyDietPhoto: async (filePath: string) => {
    const { url, fileID } = await uploadAndGetUrl(filePath, 'diet');
    try {
      return await http.post('/diet/photo/classify-url', { url });
    } finally {
      deleteCloudFile(fileID);
    }
  },
  customRecordFood: (filePath: string, hint?: string) =>
    uploadFile('/diet/photo/custom-record', filePath, hint ? { hint } : undefined),
  createDietRecord: (payload: any) => http.post('/diet/records', payload),
  createDietRecordNlp: (text: string, recordDate: string) =>
    http.post('/diet/records/nlp', { text, record_date: recordDate }),
  getDietStats: (recordDate: string) => http.get(`/diet/stats?record_date=${recordDate}`),
  assessDiet: (recordDate: string) => http.post(`/diet/assess?record_date=${recordDate}`),
  getDietRecords: (recordDate?: string) =>
    http.get(`/diet/records${recordDate ? `?record_date=${recordDate}` : ''}`),
  deleteDietRecord: (recordId: string) => http.del(`/diet/records/${recordId}`),
  getDietRecordDates: () => http.get('/diet/record-dates'),

  // ---------- 身体 ----------
  createBodyMetric: (payload: any) => http.post('/body/metrics', payload),
  getBodyMetrics: () => http.get('/body/metrics'),

  // ---------- 动作纠错 ----------
  getFormCheckActions: () => http.get('/form-check/actions'),
  formCheck: (payload: any) => http.post('/form-check/assess', payload),
  formCheckSave: (payload: any) => http.post('/form-check/save', payload),
  getFormCheckRecords: () => http.get('/form-check/records'),
  // 视频/照片姿态分析：异步任务 + 轮询（分析 20~60s，超过 callContainer 15s 单次上限）
  formCheckVideo: async (filePath: string, action?: string) => {
    const { url, fileID } = await uploadAndGetUrl(filePath, 'formcheck');
    try {
      const task: any = await http.post('/form-check/video-assess-urls', { urls: [url], action });
      const taskId = task?.task_id;
      if (!taskId) throw new Error('任务创建失败');
      for (let i = 0; i < 80; i++) {
        await sleep(1500);
        const r: any = await http.get(`/form-check/video-assess-result?task_id=${taskId}`,
          { showError: false, noRedirect: true });
        if (r?.status === 'done') return r.report;
        if (r?.status === 'failed') throw new Error(r.message || '分析失败');
      }
      throw new Error('分析超时，请重试');
    } finally {
      deleteCloudFile(fileID);
    }
  },

  // ---------- 计划 ----------
  aiGeneratePlan: (payload: any) => http.post('/plans/ai-generate', payload),
  getOfficialPlans: () => http.get('/plans/official'),
  createCustomPlan: (payload: any) => http.post('/plans', payload),
  getMyPlans: () => http.get('/plans'),
  getSpecialtyPlans: () => http.get('/plans/specialty/list'),
  adoptSpecialtyPlan: (planId: string) => http.post('/plans/specialty/adopt', { plan_id: planId }),

  // ---------- 成就 ----------
  getAchievements: () => http.get('/achievements'),
  refreshAchievements: () => http.post('/achievements/refresh'),
  getAllAchievements: () => http.get('/achievements/all'),

  // ---------- 教练端 ----------
  becomeCoach: (specialty?: string) => http.post('/coach/become-coach', { specialty }),
  addStudent: (studentId: string, note?: string) =>
    http.post('/coach/students', { student_id: studentId, note }),
  getStudents: () => http.get('/coach/students'),
  assignPlan: (payload: any) => http.post('/coach/assign-plan', payload),
  getStudentSummary: (studentId: string) =>
    http.get(`/coach/student/${studentId}/summary`),

  // ---------- 私有库 ----------
  createPrivateExercise: (payload: any) => http.post('/exercises/private', payload),
  createRecipe: (payload: any) => http.post('/recipes', payload),
  getMyRecipes: () => http.get('/recipes/mine'),
};
