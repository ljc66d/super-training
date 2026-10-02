import { wxLogin, saveAuth } from '../../utils/auth';
import { api } from '../../utils/api';
import { uploadToCloud } from '../../utils/url';

// ==================== 协议文本 ====================
const USER_AGREEMENT = `用户服务协议

欢迎使用「超会练」。在使用本小程序前，请仔细阅读以下条款：

一、服务说明
超会练提供训练记录、饮食管理、动作库、AI 计划等服务，仅供健身运动参考，不构成医疗建议。请结合自身身体状况量力而行。

二、账号与安全
1. 您需通过微信授权或账号密码完成注册登录；
2. 请妥善保管账号信息，因个人原因导致的账号安全问题由您自行承担；
3. 我们有权对违反法律法规或本协议的行为采取相应措施。

三、用户行为规范
您承诺不发布违法违规、侵犯他人权益、涉及色情赌博等不良信息。

四、免责声明
因不可抗力、网络故障、第三方服务等原因导致的服务中断或数据异常，我们将尽力修复，但不承担由此产生的间接损失。

五、协议更新
我们可能适时更新本协议，更新后将在小程序内公示。继续使用即视为接受更新后的协议。`;

const PRIVACY_POLICY = `隐私政策

「超会练」非常重视您的个人信息保护。本政策说明我们如何收集、使用和保护您的信息。

一、我们收集的信息
1. 账号信息：通过微信登录时获取微信 OpenID（用于识别账号）；您主动填写的用户名、密码（加密存储）。
2. 身体数据：您主动填写的性别、生日、身高、体重等，用于计算能量需求与个性化建议。
3. 训练与饮食数据：您记录的每次训练内容、饮食摄入，用于生成统计复盘与个性化计划。
4. 设备与日志：为保障服务稳定，我们可能记录基础访问日志。

二、信息的使用目的
1. 提供并维护训练、饮食、计划等核心功能；
2. 基于您的身体数据与记录生成个性化运动建议；
3. 改进产品体验与服务质量。

三、信息的存储与保护
您的信息存储于安全服务器，我们采取加密传输、访问控制等措施保护数据安全。除法律法规要求或经您授权外，不会向第三方披露。

四、第三方服务
微信登录功能由腾讯提供，相关信息的处理遵循《微信隐私保护指引》。

五、您的权利
您可在「我的-完善画像」中查看、修改您的个人信息，并可联系我们删除账号及相关数据。

六、未成年人保护
我们建议未成年人在监护人指导下使用本产品。

如对本政策有疑问，可通过小程序内反馈渠道联系我们。`;

Page({
  data: {
    mode: 'wechat' as 'wechat' | 'account',
    username: '',
    password: '',
    nickname: '',
    avatarUrl: '',
    isRegister: false,
    loading: false,
    // 隐私协议：默认未同意，需用户主动勾选
    agreed: false,
    showAgreement: false,
    agreementTitle: '',
    agreementContent: '',
  },

  navigateBackAfterLogin() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onShowAgreement(e: any) {
    const { type } = e.currentTarget.dataset;
    if (type === 'privacy') {
      this.setData({ showAgreement: true, agreementTitle: '隐私政策', agreementContent: PRIVACY_POLICY });
    } else {
      this.setData({ showAgreement: true, agreementTitle: '用户服务协议', agreementContent: USER_AGREEMENT });
    }
  },

  onCloseAgreement() {
    this.setData({ showAgreement: false });
  },

  /** 阻止弹窗内点击冒泡到 mask */
  noop() {},

  /** 未勾选协议时拦截登录 */
  ensureAgreed(): boolean {
    if (this.data.agreed) return true;
    wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' });
    return false;
  },

  /** 微信头像选择（button open-type="chooseAvatar"）→ 本地临时文件路径 */
  onChooseAvatar(e: any) {
    const url = e && e.detail && e.detail.avatarUrl;
    if (url) this.setData({ avatarUrl: url });
  },

  /** type="nickname" 的微信昵称键盘回填时 blur 兜底取值 */
  onNicknameBlur(e: any) {
    const v = e && e.detail && e.detail.value;
    if (v) this.setData({ nickname: v });
  },

  async onWechatLogin() {
    if (this.data.loading) return;
    if (!this.ensureAgreed()) return;
    this.setData({ loading: true });
    wx.showLoading({ title: '微信登录中...' });
    try {
      const { token, user } = await wxLogin(this.data.nickname || undefined);
      // 昵称与头像统一走 updateMe 回写：
      // 头像必须先传到云存储（云托管容器无状态，写容器本地磁盘会丢）
      const profile: any = {};
      const nick = (this.data.nickname || '').trim();
      if (nick) profile.nickname = nick;
      if (this.data.avatarUrl) {
        try {
          const m = /\.([a-zA-Z0-9]+)$/.exec(this.data.avatarUrl);
          const ext = m ? m[1].toLowerCase() : 'png';
          profile.avatar_url = await uploadToCloud(
            this.data.avatarUrl,
            `avatars/${user.user_id}_${Date.now()}.${ext}`,
          );
        } catch (e) {
          // 头像上传失败不影响登录本身，用户可在「我的」页重新更换
        }
      }
      if (Object.keys(profile).length > 0) {
        try {
          const updated = await api.updateMe(profile);
          saveAuth(token, updated);
        } catch (e) {
          // 资料回写失败不阻断登录，登录态已由 wxLogin 内部保存
        }
      }
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => this.navigateBackAfterLogin(), 600);
    } catch (e: any) {
      wx.hideLoading();
      const msg = (e && e.message) || '微信登录失败';
      wx.showModal({
        title: '微信登录不可用',
        content: `${msg}。可尝试账号密码登录。`,
        confirmText: '账号登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) this.setData({ mode: 'account' });
        },
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSwitchMode() {
    this.setData({ mode: this.data.mode === 'wechat' ? 'account' : 'wechat' });
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onToggleRegister() {
    this.setData({ isRegister: !this.data.isRegister });
  },

  async onSubmit() {
    const { username, password, nickname, isRegister, loading } = this.data;
    if (loading) return;
    if (!this.ensureAgreed()) return;
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: isRegister ? '注册中...' : '登录中...' });
    try {
      const data = isRegister
        ? await api.register(username, password, nickname || undefined)
        : await api.login(username, password);
      saveAuth(data.token, data.user);
      wx.hideLoading();
      wx.showToast({ title: isRegister ? '注册成功' : '登录成功', icon: 'success' });
      setTimeout(() => this.navigateBackAfterLogin(), 600);
    } catch (e: any) {
      wx.hideLoading();
      const msg = (e && e.message) || '登录失败，请稍后重试';
      wx.showModal({
        title: isRegister ? '注册失败' : '登录失败',
        content: msg,
        showCancel: false,
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
