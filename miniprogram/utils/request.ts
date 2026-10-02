/**
 * 请求封装：wx.cloud.callContainer（云托管内部通道，无需配置服务器域名）
 *
 * 后端统一返回 { code, data, detail? }：
 * - code === 0 视为成功，返回 data
 * - HTTP 错误或业务错误抛出带 message 的 Error
 */
import { API_BASE_URL, CLOUD_ENV, CLOUD_SERVICE, DEBUG_LOG } from './config';
import { storage } from './storage';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  auth?: boolean;
  showError?: boolean;
  /** 401时不自动跳转登录页（用于游客可浏览的页面） */
  noRedirect?: boolean;
}

let redirecting = false;

function redirectToLogin() {
  if (redirecting) return;
  redirecting = true;
  storage.clearAuth();
  wx.reLaunch({
    url: '/pages/login/login',
    complete: () => {
      setTimeout(() => { redirecting = false; }, 1500);
    },
  });
}

/** callContainer 返回的数据可能是 string 或 object，统一解析 */
function parseResponseBody(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

export function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, auth = true, showError = true, noRedirect = false } = options;
  const token = storage.getToken();

  if (DEBUG_LOG) {
    console.log(`[API] ${method} ${path}`, data || '');
  }

  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      if (showError) wx.showToast({ title: '微信版本过低，请更新微信', icon: 'none' });
      reject(new Error('WX_CLOUD_UNAVAILABLE'));
      return;
    }
    wx.cloud.callContainer({
      config: { env: CLOUD_ENV },
      service: CLOUD_SERVICE,
      path: `${API_BASE_URL}${path}`,
      method,
      data,
      timeout: 60000,
      header: {
        'X-WX-SERVICE': CLOUD_SERVICE,
        'Content-Type': 'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res: any) => {
        const status = res.statusCode;
        if (DEBUG_LOG) {
          console.log(`[API] ${method} ${path} → status=${status}`, res.data);
        }
        if (status === 401) {
          // 有token但过期了 → 清除登录态并跳转登录
          // 没token（游客）→ 不跳转，让页面自行处理游客状态
          if (token && !noRedirect) {
            if (showError) wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
            redirectToLogin();
          }
          reject(new Error('UNAUTHORIZED'));
          return;
        }
        const body = parseResponseBody(res.data);
        if (status >= 200 && status < 300) {
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === 0) {
              resolve(body.data);
            } else {
              const msg = body.detail || body.message || '请求失败';
              if (showError) wx.showToast({ title: msg, icon: 'none' });
              reject(new Error(msg));
            }
          } else {
            resolve(body);
          }
        } else {
          const msg =
            (body && (body.detail || body.message)) ||
            (typeof body === 'string' ? body : null) ||
            `请求失败(${status})`;
          if (showError) wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: (err: any) => {
        const rawMsg = (err && err.errMsg) ? err.errMsg : JSON.stringify(err || {});
        console.error(`[API] ${method} ${path} FAIL`, err);
        let msg = '网络异常，请稍后重试';
        if (rawMsg.includes('timeout')) {
          msg = '请求超时，请检查网络后重试';
        } else if (rawMsg.includes('fail') || rawMsg.includes('FAIL')) {
          const detail = rawMsg.replace(/^.*fail\s*/i, '').trim();
          msg = detail
            ? `连接失败：${detail}`
            : '服务连接失败，请稍后重试';
        }
        if (showError) wx.showToast({ title: msg, icon: 'none', duration: 3000 });
        reject(new Error(msg));
      },
    });
  });
}

export const http = {
  get: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T = any>(path: string, data?: any, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', data }),
  put: <T = any>(path: string, data?: any, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', data }),
  patch: <T = any>(path: string, data?: any, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', data }),
  del: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

function buildMultipart(
  filePath: string,
  fieldName: string,
  formData?: Record<string, string>,
): { buffer: ArrayBuffer; contentType: string } {
  const boundary = '----CloudBoundary' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  if (formData) {
    for (const [key, value] of Object.entries(formData)) {
      parts.push(encoder.encode(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${value}\r\n`
      ));
    }
  }

  const fs = wx.getFileSystemManager();
  const fileBuffer = fs.readFileSync(filePath) as ArrayBuffer;

  const ext = (filePath.split('.').pop() || '').toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime',
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const fileName = `upload_${Date.now()}.${ext}`;

  parts.push(encoder.encode(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`
  ));
  parts.push(new Uint8Array(fileBuffer));
  parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.length;
  }

  return { buffer: merged.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * 文件上传：通过 callContainer 发送 multipart/form-data（无需配置 uploadFile 域名）
 */
export function uploadFile<T = any>(
  path: string,
  filePath: string,
  formData?: Record<string, string>,
): Promise<T> {
  const token = storage.getToken();

  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      wx.showToast({ title: '微信版本过低，请更新微信', icon: 'none' });
      reject(new Error('WX_CLOUD_UNAVAILABLE'));
      return;
    }
    let multipart: { buffer: ArrayBuffer; contentType: string };
    try {
      multipart = buildMultipart(filePath, 'file', formData);
    } catch (e: any) {
      wx.showToast({ title: '文件读取失败', icon: 'none' });
      reject(new Error('FILE_READ_ERROR'));
      return;
    }

    wx.cloud.callContainer({
      config: { env: CLOUD_ENV },
      service: CLOUD_SERVICE,
      path: `${API_BASE_URL}${path}`,
      method: 'POST',
      data: multipart.buffer,
      timeout: 60000,
      header: {
        'X-WX-SERVICE': CLOUD_SERVICE,
        'Content-Type': multipart.contentType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const body = parseResponseBody(res.data);
            if (body && body.code === 0) {
              resolve(body.data);
            } else {
              const msg = (body && (body.detail || body.message)) || '上传失败';
              wx.showToast({ title: msg, icon: 'none' });
              reject(new Error(msg));
            }
          } catch (e) {
            reject(new Error('上传响应解析失败'));
          }
        } else {
          let msg = `上传失败(${res.statusCode})`;
          try {
            const body = parseResponseBody(res.data);
            if (body && (body.detail || body.message)) {
              msg = body.detail || body.message;
            }
          } catch (_) {}
          wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(`UPLOAD_FAIL_${res.statusCode}`));
        }
      },
      fail: (err: any) => {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        reject(new Error(err.errMsg || 'UPLOAD_FAIL'));
      },
    });
  });
}
