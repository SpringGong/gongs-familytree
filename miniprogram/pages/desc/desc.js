const LS_DESC = 'gongs_desc';

Page({
  data: { descHtml: '' },
  onLoad() {
    const desc = wx.getStorageSync(LS_DESC) || '';
    this.setData({ descHtml: desc });
  },
});
