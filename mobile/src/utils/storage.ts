// 本地存储封装 —— 基于 expo-sqlite 实现离线优先、云端增量同步
// 训练记录、饮食记录在弱网环境先存本地，联网后静默同步到后端
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('super_training.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS pending_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,          -- 'training' | 'diet' | 'body'
        payload TEXT NOT NULL,       -- JSON
        is_synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

/** 本地保存待同步记录 */
export function savePending(type: string, payload: any) {
  getDb().runSync(
    'INSERT INTO pending_records (type, payload) VALUES (?, ?)',
    [type, JSON.stringify(payload)]
  );
}

/** 获取未同步记录 */
export function getPending(): any[] {
  const rows = getDb().getAllSync('SELECT * FROM pending_records WHERE is_synced = 0') as any[];
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}

/** 标记已同步 */
export function markSynced(id: number) {
  getDb().runSync('UPDATE pending_records SET is_synced = 1 WHERE id = ?', [id]);
}

/** 删除记录 */
export function removeRecord(id: number) {
  getDb().runSync('DELETE FROM pending_records WHERE id = ?', [id]);
}
