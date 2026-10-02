const TABS = [
  { pagePath: '/pages/home/home', text: '首页', icon: 'home' },
  { pagePath: '/pages/training/training', text: '训练', icon: 'training' },
  { pagePath: '/pages/diet/diet', text: '饮食', icon: 'diet' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: 'profile' },
];

Component({
  data: {
    selected: 0,
    list: TABS.map((t, i) => ({
      ...t,
      index: i,
      iconPath: `/assets/tab/${t.icon}.png`,
      selectedIconPath: `/assets/tab/${t.icon}-active.png`,
    })),
  },

  methods: {
    switchTab(this: any, e: any) {
      const { index, path } = e.currentTarget.dataset;
      if (this.data.selected === index) return;
      wx.switchTab({ url: path });
    },
  },
});
