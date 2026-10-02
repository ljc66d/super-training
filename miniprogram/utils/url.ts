/**
 * 云端资源处理
 *
 * 两部分能力：
 * 1. 静态资源地址解析：后端返回的是相对路径（如 /uploads/avatars/xx.jpg），
 *    小程序 <image> 无法直接加载，渲染层会把它拼到当前页面基址上
 *    （开发者工具里变成 http://127.0.0.1:xxx/__pageframe__/uploads/...），
 *    必须统一拼成完整 https 地址。
 * 2. GIF 等云端文件下载：通过云托管 callContainer 通道把文件拉到本地临时文件，
 *    避免走公网 wx.downloadFile（无需配置 downloadFile 合法域名）。
 */
import { CLOUD_ENV, CLOUD_SERVICE, STATIC_BASE_URL } from './config';

/* ============ 一、静态资源地址解析 ============ */

/** 已是可直接加载的地址（网络图、云存储、本地临时文件、base64 等） */
const ABSOLUTE_RE = /^(https?:|cloud:|wxfile:|data:)/i;

/** 相对路径拼上静态资源域名，供 <image> 直接加载；空值返回空串 */
export function assetUrl(path?: string | null): string {
  if (!path) return '';
  if (ABSOLUTE_RE.test(path)) return path;
  return `${STATIC_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** 头像统一转成绝对地址；后续其他图片字段需要时可在此一并处理 */
export function normalizeUser<T>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const u: any = { ...(user as any) };
  if (u.avatar_url) u.avatar_url = assetUrl(u.avatar_url);
  return u as T;
}

/* ============ 二、云端文件下载与缓存 ============ */

const fs = wx.getFileSystemManager();

/** url → 本地文件路径 */
const fileCache = new Map<string, string>();
/** url → 进行中的下载 Promise（避免同一文件并发重复下载） */
const pending = new Map<string, Promise<string>>();

/** 由 url 推导本地缓存文件名（只保留安全字符） */
function localPathFor(url: string): string {
  const name = url.split('/').pop() || url;
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${wx.env.USER_DATA_PATH}/cloud_${safe}`;
}

export function getCachedFile(url?: string | null): string {
  if (!url) return '';
  const cached = fileCache.get(url);
  if (cached) {
    try {
      fs.accessSync(cached);
      return cached;
    } catch {
      fileCache.delete(url);
    }
  }
  // 内存缓存丢失（如页面重建）但本地文件仍在，直接复用
  const p = localPathFor(url);
  try {
    fs.accessSync(p);
    fileCache.set(url, p);
    return p;
  } catch {
    return '';
  }
}

/**
 * 上传本地文件到云开发存储，返回 fileID（cloud://...）
 *
 * 走云存储而非容器磁盘：云托管容器无状态，重启/扩缩容会丢文件；云存储可持久化且带 CDN。
 * fileID 可直接用于 <image src>，也能直接存进 avatar_url 字段。
 */
export function uploadToCloud(filePath: string, cloudPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      wx.showToast({ title: '微信版本过低，请更新微信', icon: 'none' });
      reject(new Error('WX_CLOUD_UNAVAILABLE'));
      return;
    }
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res: any) => {
        if (res && res.fileID) resolve(res.fileID);
        else reject(new Error('UPLOAD_NO_FILEID'));
      },
      fail: (err: any) => {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        reject(new Error((err && err.errMsg) || 'UPLOAD_FAIL'));
      },
    });
  });
}

/** fileID（cloud://...）换 10 分钟有效的临时 https 链接，供后端直接拉取文件 */
export function getCloudFileUrl(fileID: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('WX_CLOUD_UNAVAILABLE'));
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res: any) => {
        const f = res && res.fileList && res.fileList[0];
        if (f && f.tempFileURL) resolve(f.tempFileURL);
        else reject(new Error('TEMP_URL_FAIL'));
      },
      fail: (err: any) => reject(new Error((err && err.errMsg) || 'TEMP_URL_FAIL')),
    });
  });
}

/** 经云托管通道下载云端文件到本地临时文件，同一 url 重复调用不重复下载 */
export function loadCloudFile(url: string): Promise<string> {
  if (!url) return Promise.reject(new Error('EMPTY_URL'));

  const cached = getCachedFile(url);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const filePath = localPathFor(url);
  const path = url.startsWith('/') ? url : `/${url}`;

  const task = new Promise<string>((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('WX_CLOUD_UNAVAILABLE'));
      return;
    }
    wx.cloud.callContainer({
      config: { env: CLOUD_ENV },
      service: CLOUD_SERVICE,
      path,
      method: 'GET',
      responseType: 'arraybuffer',
      header: { 'X-WX-SERVICE': CLOUD_SERVICE },
      timeout: 60000,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
          try {
            fs.writeFileSync(filePath, res.data, 'binary');
            fileCache.set(url, filePath);
            resolve(filePath);
          } catch (e) {
            reject(new Error('FILE_WRITE_ERROR'));
          }
        } else {
          reject(new Error(`FILE_DOWNLOAD_FAIL_${res.statusCode}`));
        }
      },
      fail: (err: any) => {
        reject(new Error((err && err.errMsg) || 'FILE_DOWNLOAD_FAIL'));
      },
      complete: () => {
        pending.delete(url);
      },
    } as any);
  });

  pending.set(url, task);
  return task;
}
