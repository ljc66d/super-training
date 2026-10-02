// 后端 API 客户端（对接 FastAPI，支持JWT鉴权）
import { Platform } from 'react-native';

// 后端地址配置
// - Android APK：指向公网服务器地址（任何人安装后可用，无需同 WiFi）
// - Web：同源相对路径（生产模式由后端托管前端页面，请求 /api/v1 走同源）
export const API_BASE_URL =
  Platform.select({
    android: 'http://175.27.146.230:8000',  // APK：公网服务器（超会练云服务器）
    ios: 'http://127.0.0.1:8000',
    default: '',  // Web：同源相对路径（后端托管）
  }) + '/api/v1';

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  // FormData 上传时不手动设 Content-Type（浏览器自动加 boundary）
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`API错误 ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

function get<T = any>(path: string) {
  return request<T>(path);
}
function post<T = any>(path: string, body?: any) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}
function put<T = any>(path: string, body?: any) {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}
function patch<T = any>(path: string, body?: any) {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}
function del<T = any>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export const api = {
  setToken,

  // 认证
  register: (username: string, password: string, nickname?: string) =>
    post('/auth/register', { username, password, nickname }),
  login: (username: string, password: string) =>
    post('/auth/login', { username, password }),
  getMe: () => get('/auth/me'),
  updateMe: (data: any) => put('/auth/me', data),
  uploadAvatar: (form: FormData) => request('/auth/avatar', { method: 'POST', body: form }),
  getPublicProfile: (userId: string) => get(`/auth/users/${userId}/public-profile`),

  // 身体数据
  createBodyMetric: (data: {
    record_date: string; weight_kg?: number; body_fat_pct?: number;
    resting_heart_rate?: number; recorded_at?: string;
  }) => post('/body/metrics', data),
  listBodyMetrics: () => get('/body/metrics'),

  // 综合数据
  getEnergyNeeds: () => get('/energy-needs'),
  getToday: () => get('/today'),
  getStatsTrend: (days: number = 30) => get(`/stats/trend?days=${days}`),
  getFatigue: () => get('/stats/fatigue'),
  getExerciseHistory: (name: string, limit: number = 50) =>
    get(`/stats/exercise-history?name=${encodeURIComponent(name)}&limit=${limit}`),
  getRecommendFoods: (limit: number = 6) =>
    get(`/stats/recommend-foods?limit=${limit}`),

  // 训练
  getTemplates: () => get('/templates'),
  getExercises: (keyword?: string, category?: string, limit?: number, group?: string) => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    if (group) params.set('group', group);
    const qs = params.toString();
    return get(`/exercises${qs ? `?${qs}` : ''}`);
  },
  getExerciseGroups: () => get('/exercises/groups'),
  createSession: (payload: any) => post('/sessions', payload),
  createSessionNlp: (text: string, startTime: string) =>
    post('/sessions/nlp', { text, start_time: startTime }),
  getSessionStats: () => get('/sessions/stats'),
  getSessions: () => get('/sessions'),
  getCustomSports: () => get('/custom-sports'),
  addCustomSport: (sportName: string) => post('/custom-sports', { sport_name: sportName }),
  deleteCustomSport: (customSportId: string) => del(`/custom-sports/${customSportId}`),

  // 饮食
  getFoods: (keyword?: string) =>
    get(`/diet/foods${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  recognizeDietPhoto: (form: FormData) => request('/diet/photo/recognize', { method: 'POST', body: form }),
  recordDietPhoto: (hint: string, mealType: string, itemsJson?: string) =>
    post('/diet/photo/record', itemsJson
      ? { hint, meal_type: mealType, items_json: itemsJson }
      : { hint, meal_type: mealType }),
  classifyDietPhoto: (form: FormData) => request('/diet/photo/classify', { method: 'POST', body: form }),
  customRecordFood: (form: FormData) => request('/diet/photo/custom-record', { method: 'POST', body: form }),
  createDietRecord: (payload: any) => post('/diet/records', payload),
  createDietRecordNlp: (text: string, recordDate: string) =>
    post('/diet/records/nlp', { text, record_date: recordDate }),
  getDietStats: (recordDate: string) => get(`/diet/stats?record_date=${recordDate}`),
  assessDiet: (recordDate: string) => post(`/diet/assess?record_date=${recordDate}`),
  getDietRecords: (recordDate?: string) =>
    get(`/diet/records${recordDate ? `?record_date=${recordDate}` : ''}`),
  deleteDietRecord: (recordId: string) => del(`/diet/records/${recordId}`),
  getDietRecordDates: () => get(`/diet/record-dates`),

  // 拍照识别
  recognizeFood: (hint: string) =>
    request('/diet/photo/recognize', {
      method: 'POST',
      body: new URLSearchParams({ hint }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),

  // 动作纠错
  getFormCheckActions: () => get('/form-check/actions'),
  formCheck: (payload: any) => post('/form-check/assess', payload),
  formCheckSave: (payload: any) => post('/form-check/save', payload),
  getFormCheckRecords: () => get('/form-check/records'),
  formCheckVideo: (form: FormData) => request('/form-check/video-assess', { method: 'POST', body: form }),

  // 计划
  aiGeneratePlan: (payload: any) => post('/plans/ai-generate', payload),
  getOfficialPlans: () => get('/plans/official'),
  createCustomPlan: (payload: any) => post('/plans', payload),
  getMyPlans: () => get('/plans'),
  getSpecialtyPlans: () => get('/plans/specialty/list'),
  adoptSpecialtyPlan: (planId: string) => post('/plans/specialty/adopt', { plan_id: planId }),

  // 成就
  getAchievements: () => get('/achievements'),
  refreshAchievements: () => post('/achievements/refresh'),
  getAllAchievements: () => get('/achievements/all'),

  // 社区
  createShare: (payload: any) => post('/community/share', payload),
  shareTrainingCard: () => post('/community/share/training-card'),
  createPost: (payload: any) => post('/community/posts', payload),
  getPosts: () => get('/community/posts'),
  getMyPosts: () => get('/community/posts/mine'),
  deletePost: (postId: string) => del(`/community/posts/${postId}`),
  updatePostVisibility: (postId: string, isPublic: boolean) =>
    patch(`/community/posts/${postId}/visibility`, { is_public: isPublic }),
  likePost: (postId: string) => post(`/community/posts/${postId}/like`),
  uploadPostImage: (form: FormData) => request('/community/upload', { method: 'POST', body: form }),
  createComment: (postId: string, content: string) =>
    post(`/community/posts/${postId}/comments`, { content }),
  getComments: (postId: string) => get(`/community/posts/${postId}/comments`),
  // 关注
  followUser: (userId: string) => post(`/community/users/${userId}/follow`),
  unfollowUser: (userId: string) => del(`/community/users/${userId}/follow`),
  searchUser: (q: string) => get(`/community/users/search?q=${encodeURIComponent(q)}`),
  getUserRelations: (userId: string) => get(`/community/users/${userId}/relations`),
  getFollowers: (userId: string) => get(`/community/users/${userId}/followers`),
  getFollowing: (userId: string) => get(`/community/users/${userId}/following`),
  getNearbyUsers: (limit: number = 30) => get(`/community/nearby-users?limit=${limit}`),
  // 私信
  sendMessage: (receiverId: string, content: string) =>
    post('/community/messages', { receiver_id: receiverId, content }),
  getConversations: () => get('/community/conversations'),
  getMessages: (userId: string) => get(`/community/conversations/${userId}/messages`),
  getUnreadCount: () => get('/community/unread-count'),

  // 教练端
  becomeCoach: (specialty?: string) => post('/coach/become-coach', { specialty }),
  addStudent: (studentId: string, note?: string) =>
    post('/coach/students', { student_id: studentId, note }),
  getStudents: () => get('/coach/students'),
  assignPlan: (payload: any) => post('/coach/assign-plan', payload),
  getStudentSummary: (studentId: string) => get(`/coach/student/${studentId}/summary`),

  // 私有库
  createPrivateExercise: (payload: any) => post('/exercises/private', payload),
  createRecipe: (payload: any) => post('/recipes', payload),
  getMyRecipes: () => get('/recipes/mine'),
};
