// React Navigation 7 根导航 ref —— 用于跨 Stack/Tab 跳转
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef: any = createNavigationContainerRef();

// 通过 Root Stack 进行跳转（避免 Tab 内 navigate 找不到 Stack Screen）
export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

// 通过 Root Stack 返回上一页
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
