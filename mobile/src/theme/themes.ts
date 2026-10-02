// 多套配色方案 —— 每组两个主色（primary + accent）+ 一套背景/表面中性色
// 用户可在"我的"页面切换，全站（含背景/卡片等暗色区域）一起变色

export interface ThemePalette {
  key: string;
  name: string;
  emoji: string;
  // 两个主色
  primary: string;
  accent: string;
  // 衍生色
  primaryDark: string;
  primarySoft: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  // 背景/表面中性色（每套主题自带的暗色系）
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceHover: string;
  border: string;
}

// 文字与徽章色（深色模式下所有主题共用，深色背景下用浅色文字）
export const NEUTRAL_COLORS = {
  text: '#F8FAFC',
  textSecondary: '#B8C4D6',
  textMuted: '#7D8CA3',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

// 浅色模式：文字与徽章色（浅色背景下用深色文字）
export const LIGHT_NEUTRAL = {
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  bronze: '#B45309',
  silver: '#64748B',
  gold: '#B45309',
  platinum: '#475569',
};

// 浅色模式：背景/表面中性色
export const LIGHT_SURFACES = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceLight: '#E8EEF5',
  surfaceHover: '#DCE5EF',
  border: '#D8E0EA',
};

export const THEMES: ThemePalette[] = [
  {
    key: 'ocean',
    name: '活力蓝橙',
    emoji: '',
    primary: '#0EA5E9', accent: '#F97316',
    primaryDark: '#0369A1', primarySoft: '#0C4A6E',
    accentSoft: '#7C2D12',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深蓝背景系
    background: '#0B1220', surface: '#151E2E',
    surfaceLight: '#1F2B3F', surfaceHover: '#2A3850', border: '#2A3850',
  },
  {
    key: 'forest',
    name: '森林绿金',
    emoji: '',
    primary: '#10B981', accent: '#F59E0B',
    primaryDark: '#047857', primarySoft: '#064E3B',
    accentSoft: '#713F12',
    success: '#34D399', successSoft: '#14532D',
    warning: '#FBBF24', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深绿背景系
    background: '#0B1512', surface: '#14231E',
    surfaceLight: '#1D312A', surfaceHover: '#274035', border: '#274035',
  },
  {
    key: 'berry',
    name: '莓果粉紫',
    emoji: '',
    primary: '#EC4899', accent: '#8B5CF6',
    primaryDark: '#BE185D', primarySoft: '#831843',
    accentSoft: '#4C1D95',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深紫背景系
    background: '#140B1E', surface: '#1E1530',
    surfaceLight: '#2A1F42', surfaceHover: '#382B58', border: '#382B58',
  },
  {
    key: 'deepsea',
    name: '深海蓝紫',
    emoji: '',
    primary: '#6366F1', accent: '#06B6D4',
    primaryDark: '#4338CA', primarySoft: '#312E81',
    accentSoft: '#164E63',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深靛蓝背景系
    background: '#0C1026', surface: '#161A38',
    surfaceLight: '#20254A', surfaceHover: '#2C3260', border: '#2C3260',
  },
  {
    key: 'lava',
    name: '熔岩红橙',
    emoji: '',
    primary: '#EF4444', accent: '#F97316',
    primaryDark: '#B91C1C', primarySoft: '#7F1D1D',
    accentSoft: '#7C2D12',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深红棕背景系
    background: '#160B0D', surface: '#231417',
    surfaceLight: '#301C20', surfaceHover: '#40262B', border: '#40262B',
  },
  {
    key: 'midnight',
    name: '午夜紫金',
    emoji: '',
    primary: '#A855F7', accent: '#F59E0B',
    primaryDark: '#7E22CE', primarySoft: '#581C87',
    accentSoft: '#713F12',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#FBBF24', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深暗紫背景系
    background: '#0E0B1A', surface: '#181426',
    surfaceLight: '#221C34', surfaceHover: '#2E2646', border: '#2E2646',
  },
  {
    key: 'aurora',
    name: '极光青柠',
    emoji: '',
    primary: '#2DD4BF', accent: '#A3E635',
    primaryDark: '#0F766E', primarySoft: '#134E4A',
    accentSoft: '#3F6212',
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    // 深青背景系
    background: '#0A1518', surface: '#122228',
    surfaceLight: '#1A2F38', surfaceHover: '#233E49', border: '#233E49',
  },
];

// 自由选色色板 —— 三块区域（主色/强调色/背景色）各自可选的颜色
export const PRIMARY_PALETTE = [
  '#0EA5E9', '#06B6D4', '#22C55E', '#10B981', '#84CC16', '#EAB308',
  '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6',
  '#6366F1', '#3B82F6', '#14B8A6', '#2DD4BF', '#E11D48', '#7C3AED',
];

export const ACCENT_PALETTE = [
  '#F97316', '#EF4444', '#EAB308', '#A3E635', '#2DD4BF', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E', '#14B8A6',
  '#E11D48', '#A855F7', '#0EA5E9', '#84CC16', '#F43F5E', '#6366F1',
];

export const BACKGROUND_PALETTE = [
  '#0B1220', '#0B1512', '#140B1E', '#0C1026', '#160B0D', '#0E0B1A',
  '#0A1518', '#111827', '#1C1917', '#1E1B2E', '#0F172A', '#16211F',
  '#1F1B2E', '#201416', '#141C26', '#101B24', '#1A1423', '#0D1B1E',
];

// 浅色模式背景色板（与深色模式同款 18 色，对应浅色系）
export const LIGHT_BACKGROUND_PALETTE = [
  '#F1F5F9', '#FAF9F6', '#FDF6F0', '#F0F7F4', '#F5F0FA', '#EFF6FF',
  '#FEF2F2', '#FEFCE8', '#F0FDFA', '#F5F3FF', '#FAF5F0', '#F8FAFC',
  '#ECFDF5', '#FFF7ED', '#EEF2FF', '#FDF4FF', '#F0FFF4', '#FFF1F2',
];

export const DEFAULT_THEME_KEY = 'ocean';
export const THEME_STORAGE_KEY = 'super-training-theme';
