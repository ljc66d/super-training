/**
 * 自定义 tabBar 同步：各 tab 页 onShow 时调用，更新选中态。
 */

const TAB_INDEX: Record<string, number> = {
  '/pages/home/home': 0,
  '/pages/training/training': 1,
  '/pages/diet/diet': 2,
  '/pages/profile/profile': 3,
};

/** tabBar 页面完整路径（唯一来源，避免各处硬编码前缀判断出错） */
export const TAB_PAGES: string[] = Object.keys(TAB_INDEX);

/**
 * 统一页面跳转：tabBar 页用 switchTab，其余用 navigateTo。
 *
 * 不能按 url.startsWith('/pages/diet') 之类的前缀判断——/pages/diet-calendar 会被误判成 tab 页
 * 而走 switchTab，跳到不存在的 tab 没反应。必须精确匹配。
 */
export function navigateTo(url: string) {
  if (!url) return;
  if (TAB_PAGES.indexOf(url) >= 0) {
    wx.switchTab({ url });
  } else {
    wx.navigateTo({ url });
  }
}

export function syncTabBar(page: any, route: string) {
  const idx = TAB_INDEX[route];
  if (idx === undefined) return;
  if (typeof page.getTabBar === 'function') {
    const tabBar = page.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: idx });
    }
  }
}
