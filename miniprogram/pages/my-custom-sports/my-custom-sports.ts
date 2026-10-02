import { api } from '../../utils/api';

Page({
  data: {
    list: [] as any[],
    newName: '',
  },

  onShow() {
    this.load();
  },

  load() {
    api.getCustomSports().then((d: any) => {
      this.setData({ list: d || [] });
    }).catch(() => {});
  },

  onNewInput(e: any) {
    this.setData({ newName: e.detail.value });
  },

  onAdd() {
    const name = (this.data.newName || '').trim();
    if (!name) return;
    api.addCustomSport(name).then(() => {
      this.setData({ newName: '' });
      this.load();
    }).catch((err: any) => {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    });
  },

  onDelete(e: any) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除运动',
      content: `确定删除「${name}」吗？`,
      success: (res) => {
        if (res.confirm) {
          api.deleteCustomSport(id).then(() => this.load())
            .catch((err: any) => {
              wx.showToast({ title: err.message || '删除失败', icon: 'none' });
            });
        }
      },
    });
  },
});
