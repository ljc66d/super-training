import { createFont, createTamagui, createTokens } from 'tamagui';

// 品牌色 token（训练工具：近黑底 + 单一橙红强调）
const tokens = createTokens({
  color: {
    primary: '#FF4D2E',
    primaryDark: '#D93A1E',
    accent: '#FF8A5C',
    success: '#3ECF8E',
    warning: '#E8A33D',
    danger: '#E5484D',
    background: '#0D0E10',
    surface: '#14161A',
    surfaceLight: '#1A1D22',
    text: '#F2F4F5',
    textMuted: '#5C6570',
    border: '#262A31',
    // Tamagui 组件依赖的标准变量
    color: '#F2F4F5',
    placeholderColor: '#5C6570',
    borderColor: '#262A31',
    backgroundColor: '#0D0E10',
    shadowColor: '#000000',
  },
  space: {
    true: 8,
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40,
  },
  size: {
    true: 16,
    1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6: 24, 8: 32, 10: 40,
  },
  radius: {
    1: 4, 2: 6, 3: 8, 4: 10, 5: 12, 6: 12,
  },
  zIndex: { 1: 100, 2: 200, 3: 300 },
});

const bodyFont = createFont({
  family: 'System',
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 30 },
  weight: { light: '300', normal: '400', medium: '500', semibold: '600', bold: '700' },
  letterSpacing: { body: 0, display: -0.3 },
});

const darkTheme = {
  primary: '#FF4D2E',
  primaryDark: '#D93A1E',
  accent: '#FF8A5C',
  success: '#3ECF8E',
  warning: '#E8A33D',
  danger: '#E5484D',
  background: '#0D0E10',
  surface: '#14161A',
  surfaceLight: '#1A1D22',
  text: '#F2F4F5',
  textMuted: '#5C6570',
  border: '#262A31',
  color: '#F2F4F5',
  placeholderColor: '#5C6570',
  borderColor: '#262A31',
  backgroundColor: '#0D0E10',
  shadowColor: '#000000',
};

const lightTheme = {
  primary: '#D93A1E',
  primaryDark: '#B82E12',
  accent: '#C2410C',
  success: '#1A9E5F',
  warning: '#B9791A',
  danger: '#C23A3F',
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceLight: '#EEEEEA',
  text: '#1A1C1E',
  textMuted: '#6B7075',
  border: '#E2E3DF',
  color: '#1A1C1E',
  placeholderColor: '#9BA0A5',
  borderColor: '#E2E3DF',
  backgroundColor: '#F7F7F5',
  shadowColor: '#000000',
};

const config = createTamagui({
  defaultTheme: 'dark',
  fonts: {
    body: bodyFont,
    heading: bodyFont,
  },
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
});

export default config;
export type AppConfig = typeof config;
