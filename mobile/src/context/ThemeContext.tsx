// 全局配色：主色/强调色/背景色可选预设或自定义，支持深浅色切换
// 切换时直接改写 theme/tokens 的 colors 单例，触发全局重渲染
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { colors } from '../theme/tokens';
import {
  THEMES, NEUTRAL_COLORS, LIGHT_NEUTRAL, LIGHT_SURFACES,
  LIGHT_BACKGROUND_PALETTE,
  DEFAULT_THEME_KEY, THEME_STORAGE_KEY,
} from '../theme/themes';

export interface CustomColors {
  primary: string;
  accent: string;
  background: string;
}

interface ThemeContextValue {
  themeKey: string;             // 预设 key（自定义时为 'custom'）
  themes: typeof THEMES;
  custom: CustomColors;         // 自定义的三块颜色
  darkMode: boolean;            // 深色/浅色模式
  setTheme: (key: string) => void;
  setCustomColor: (part: keyof CustomColors, color: string) => void;
  setDarkMode: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_STORAGE_KEY = 'super-training-mode';

// 简单颜色加深（用于衍生 primaryDark/soft）
function darken(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * ratio));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * ratio));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * ratio));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// 混合两个颜色：ratio 为 hex2 的权重（0~1）
function mix(hex1: string, hex2: string, ratio: number): string {
  const a = hex1.replace('#', '');
  const b = hex2.replace('#', '');
  if (a.length !== 6 || b.length !== 6) return hex1;
  const ch = (i: number) => {
    const v = Math.round(parseInt(a.slice(i, i + 2), 16)
      + (parseInt(b.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)) * ratio);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

// 判断颜色是否偏深（用于浅色模式下自动规避深色背景）
function isDarkColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const lum = (parseInt(h.slice(0, 2), 16) * 299
    + parseInt(h.slice(2, 4), 16) * 587
    + parseInt(h.slice(4, 6), 16) * 114) / 1000;
  return lum < 140;
}

// 把配色应用到 colors 单例对象
function applyToColors(base: { [k: string]: string }) {
  Object.keys(base).forEach((k) => {
    (colors as any)[k] = base[k];
  });
}

// 浅色模式功能色（在浅背景上可读的深色变体）
const LIGHT_FUNC = {
  success: '#16A34A', successSoft: '#166534',
  warning: '#D97706', warningSoft: '#92400E',
  danger: '#DC2626', dangerSoft: '#991B1B',
};

function buildFromPreset(key: string, dark: boolean): { [k: string]: string } {
  const palette = THEMES.find((t) => t.key === key) || THEMES[0];
  if (dark) return { ...NEUTRAL_COLORS, ...palette };
  return {
    ...LIGHT_NEUTRAL,
    ...LIGHT_SURFACES,
    primary: palette.primary,
    accent: palette.accent,
    primaryDark: darken(palette.primary, 0.7),
    primarySoft: darken(palette.primary, 0.55),
    accentSoft: darken(palette.accent, 0.55),
    ...LIGHT_FUNC,
  };
}

function buildFromCustom(c: CustomColors, dark: boolean): { [k: string]: string } {
  if (!dark) {
    // 浅色模式：背景色由用户选择的 c.background 派生（surface 偏向白、边框偏灰）
    const bg = c.background;
    return {
      ...LIGHT_NEUTRAL,
      background: bg,
      surface: mix(bg, '#FFFFFF', 0.85),
      surfaceLight: mix(bg, '#FFFFFF', 0.5),
      surfaceHover: mix(bg, '#FFFFFF', 0.3),
      border: mix(bg, '#94A3B8', 0.5),
      primary: c.primary,
      accent: c.accent,
      primaryDark: darken(c.primary, 0.7),
      primarySoft: darken(c.primary, 0.55),
      accentSoft: darken(c.accent, 0.55),
      ...LIGHT_FUNC,
    };
  }
  return {
    ...NEUTRAL_COLORS,
    primary: c.primary,
    accent: c.accent,
    background: c.background,
    primaryDark: darken(c.primary, 0.65),
    primarySoft: darken(c.primary, 0.35),
    accentSoft: darken(c.accent, 0.35),
    success: '#22C55E', successSoft: '#14532D',
    warning: '#F59E0B', warningSoft: '#713F12',
    danger: '#EF4444', dangerSoft: '#7F1D1D',
    surface: darken(c.background, 1.6),
    surfaceLight: darken(c.background, 2.4),
    surfaceHover: darken(c.background, 3.2),
    border: darken(c.background, 3.2),
  };
}

// 读取存储：{mode:'preset'|'custom', key?, custom?}
function loadStored(): { mode: 'preset' | 'custom'; key: string; custom: CustomColors } {
  const def: CustomColors = { primary: THEMES[0].primary, accent: THEMES[0].accent, background: THEMES[0].background };
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.mode === 'custom' && data.custom?.primary && data.custom?.accent && data.custom?.background) {
          return { mode: 'custom', key: 'custom', custom: data.custom };
        }
        if (data.mode === 'preset' && THEMES.some((t) => t.key === data.key)) {
          const p = THEMES.find((t) => t.key === data.key)!;
          return { mode: 'preset', key: p.key, custom: { primary: p.primary, accent: p.accent, background: p.background } };
        }
      }
    } catch (e) { /* ignore */ }
  }
  return { mode: 'preset', key: DEFAULT_THEME_KEY, custom: def };
}

function loadDarkMode(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (v !== null) return v === '1';
    } catch (e) { /* ignore */ }
  }
  return true;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored] = useState(loadStored);
  const [themeKey, setThemeKey] = useState<string>(stored.key);
  const [custom, setCustom] = useState<CustomColors>(stored.custom);
  const [darkMode, setDarkModeState] = useState<boolean>(loadDarkMode);

  // 引用（避免闭包拿到旧值）
  const themeKeyRef = React.useRef(themeKey);
  themeKeyRef.current = themeKey;
  const customRef = React.useRef(custom);
  customRef.current = custom;
  const darkRef = React.useRef(darkMode);
  darkRef.current = darkMode;

  useEffect(() => {
    const dark = darkRef.current;
    if (stored.mode === 'custom') {
      applyToColors(buildFromCustom(stored.custom, dark));
    } else {
      applyToColors(buildFromPreset(stored.key, dark));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((data: any) => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }
  }, []);

  // 重新应用当前配色（切换深浅色时调用）
  const reapply = useCallback((dark: boolean) => {
    if (themeKeyRef.current === 'custom') {
      applyToColors(buildFromCustom(customRef.current, dark));
    } else {
      applyToColors(buildFromPreset(themeKeyRef.current, dark));
    }
  }, []);

  const setTheme = useCallback((key: string) => {
    if (!THEMES.some((t) => t.key === key)) return;
    const p = THEMES.find((t) => t.key === key)!;
    applyToColors(buildFromPreset(key, darkRef.current));
    setThemeKey(key);
    // 浅色模式下背景色用浅色默认，避免预设深色背景带入浅色模式
    const bg = darkRef.current ? p.background : LIGHT_SURFACES.background;
    setCustom({ primary: p.primary, accent: p.accent, background: bg });
    persist({ mode: 'preset', key });
  }, [persist]);

  const setCustomColor = useCallback((part: keyof CustomColors, color: string) => {
    const next = { ...customRef.current, [part]: color };
    customRef.current = next;
    applyToColors(buildFromCustom(next, darkRef.current));
    setCustom(next);
    setThemeKey('custom');
    persist({ mode: 'custom', custom: next });
  }, [persist]);

  const setDarkMode = useCallback((dark: boolean) => {
    darkRef.current = dark;
    setDarkModeState(dark);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(MODE_STORAGE_KEY, dark ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    // 自定义配色切到浅色模式时：若背景色仍为深色，自动换成浅色默认背景
    if (!dark && themeKeyRef.current === 'custom' && isDarkColor(customRef.current.background)) {
      const next = { ...customRef.current, background: LIGHT_BACKGROUND_PALETTE[0] };
      customRef.current = next;
      setCustom(next);
      persist({ mode: 'custom', custom: next });
    }
    reapply(dark);
  }, [reapply, persist]);

  const value: ThemeContextValue = {
    themeKey, themes: THEMES, custom, darkMode,
    setTheme, setCustomColor, setDarkMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeProvider;
