// 设计系统 Token —— 统一配色/间距/圆角/阴影
// 供 Tamagui 主题与页面使用，保证全站视觉一致
// 视觉方向：训练工具质感 —— 近黑底、单一橙红强调色、1px 边框体系、克制圆角

export const colors: Record<string, string> & {
  primary: string; primaryDark: string; primarySoft: string;
  accent: string; accentSoft: string;
  success: string; successSoft: string; warning: string; warningSoft: string;
  danger: string; dangerSoft: string;
  background: string; surface: string; surfaceLight: string; surfaceHover: string; border: string;
  text: string; textSecondary: string; textMuted: string;
  bronze: string; silver: string; gold: string; platinum: string;
} = {
  // 品牌强调色（单一橙红，力量/器械感）
  primary: '#FF4D2E',
  primaryDark: '#D93A1E',
  primarySoft: '#7A2B1C',
  accent: '#FF8A5C',
  accentSoft: '#5C2A1E',

  // 功能色（低饱和，克制）
  success: '#3ECF8E',
  successSoft: '#123B2B',
  warning: '#E8A33D',
  warningSoft: '#3D2E12',
  danger: '#E5484D',
  dangerSoft: '#3D1618',

  // 中性色（近黑深色主题）
  background: '#0D0E10',
  surface: '#14161A',
  surfaceLight: '#1A1D22',
  surfaceHover: '#21252C',
  border: '#262A31',

  // 文字
  text: '#F2F4F5',
  textSecondary: '#9BA3AD',
  textMuted: '#5C6570',

  // 徽章等级色
  bronze: '#B0753C',
  silver: '#A8AFB8',
  gold: '#E0B24D',
  platinum: '#C9D2DC',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
};
