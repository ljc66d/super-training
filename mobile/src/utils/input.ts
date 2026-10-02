// 数字输入过滤器 —— 统一限制所有数字录入字段只能填写数字
// 用法：onChangeText={(v) => setX(sanitizeNumber(v))}

/** 只保留数字 0-9 与一个小数点，其余字符丢弃 */
export function sanitizeNumber(value: string): string {
  if (!value) return '';
  let result = '';
  let hasDot = false;
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      result += ch;
    }
    // 其它字符直接丢弃（含 -、e、+、空格等）
  }
  return result;
}

/** 去小数点取整（组数/次数等必须整数的字段） */
export function sanitizeInteger(value: string): string {
  return sanitizeNumber(value).replace('.', '');
}

/** 解析为数字，无效返回 null */
export function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
