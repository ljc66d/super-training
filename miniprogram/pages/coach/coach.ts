import { api } from '../../utils/api';
import { updateUser } from '../../utils/auth';
import { formatDate } from '../../utils/format';

Page({
  data: {
    user: null as any,
    isCoach: false,
    tab: 'students' as 'students' | 'summary',
    students: [] as any[],
    loading: true,
    showAdd: false,
    studentId: '',
    studentNote: '',
    adding: false,
    summary: null as any,
    summaryLoading: false,
  },

  onShow() {
    const app = getApp<any>();
    const user = (app.globalData && app.globalData.user) || null;
    this.setData({ user, isCoach: !!(user && user.is_coach) });
    if (user && user.is_coach) {
      this.loadStudents();
    }
  },

  async onBecomeCoach() {
    wx.showModal({
      title: '成为教练',
      content: '成为教练后可以添加学员、分发训练计划并查看学员数据复盘。确认申请？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const user: any = await api.becomeCoach();
          updateUser(user);
          this.setData({ user, isCoach: true });
          wx.showToast({ title: '已开通教练身份', icon: 'success' });
          this.loadStudents();
        } catch (e: any) {}
      },
    });
  },

  async loadStudents() {
    this.setData({ loading: true });
    try {
      const students = await api.getStudents();
      this.setData({ students: students || [] });
    } catch (e: any) {
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelectTab(e: any) {
    const { key } = e.currentTarget.dataset;
    this.setData({ tab: key, summary: null });
  },

  onOpenAdd() {
    this.setData({ showAdd: true, studentId: '', studentNote: '' });
  },

  onCloseAdd() {
    this.setData({ showAdd: false });
  },

  /** 阻止弹窗内点击冒泡到 mask */
  noop() {},

  onStudentIdInput(e: any) {
    this.setData({ studentId: e.detail.value });
  },

  onStudentNoteInput(e: any) {
    this.setData({ studentNote: e.detail.value });
  },

  async onAddStudent() {
    const { studentId, studentNote } = this.data;
    if (!studentId.trim()) {
      wx.showToast({ title: '请输入学员ID', icon: 'none' });
      return;
    }
    this.setData({ adding: true });
    try {
      await api.addStudent(studentId.trim(), studentNote.trim() || undefined);
      wx.showToast({ title: '已添加学员', icon: 'success' });
      this.setData({ showAdd: false });
      this.loadStudents();
    } catch (e: any) {
    } finally {
      this.setData({ adding: false });
    }
  },

  async onViewSummary(e: any) {
    const { id, name } = e.currentTarget.dataset;
    wx.showLoading({ title: '加载学员数据...' });
    this.setData({ summaryLoading: true });
    try {
      const summary: any = await api.getStudentSummary(id);
      const decorated = {
        ...summary,
        student_name: name,
        last_active: formatDate(summary.last_active),
        level_text: summary.level ? `Lv.${summary.level}` : '',
      };
      this.setData({ summary: decorated, tab: 'summary' });
      wx.hideLoading();
    } catch (e: any) {
      wx.hideLoading();
    } finally {
      this.setData({ summaryLoading: false });
    }
  },

  onBackToList() {
    this.setData({ tab: 'students', summary: null });
  },
});
