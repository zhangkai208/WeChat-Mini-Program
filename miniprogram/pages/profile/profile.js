Page({
  data: { userInfo: null },

  onShow() {
    const cached = wx.getStorageSync('userInfo')
    if (cached) this.setData({ userInfo: cached })
  },

  async login() {
    try {
      const { userInfo } = await wx.getUserProfile({ desc: '展示头像和昵称' })
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
    } catch (e) {
      wx.showToast({ title: '已取消', icon: 'none' })
    }
  },

  logout() {
    wx.removeStorageSync('userInfo')
    this.setData({ userInfo: null })
  }
})
