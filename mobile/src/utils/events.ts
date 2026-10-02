// 全局数据刷新事件 —— 饮食/训练记录后通知相关页面刷新
// 避免依赖导航 focus（某些场景 focus 不触发）

type Listener = () => void;

const listeners: Record<string, Set<Listener>> = {};

export function onDataEvent(event: string, fn: Listener) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(fn);
  return () => {
    listeners[event]?.delete(fn);
  };
}

export function emitDataEvent(event: string) {
  listeners[event]?.forEach((fn) => {
    try { fn(); } catch (e) { console.warn(e); }
  });
}

export const DATA_EVENTS = {
  DIET_UPDATED: 'diet-updated',
  TRAINING_UPDATED: 'training-updated',
};
