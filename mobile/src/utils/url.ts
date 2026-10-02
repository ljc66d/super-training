// 相对 URL（/uploads/xx）→ 完整可访问地址（web 同源直接用相对路径）
import { API_BASE_URL } from '../api/client';

export function fullUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  return u.startsWith('http') ? u : `${API_BASE_URL.replace(/\/api\/v1$/, '')}${u}`;
}
