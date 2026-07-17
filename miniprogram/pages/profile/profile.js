Page({
  data: { userInfo: null },

  // 每次进入"我的"页，读最新登录态（首页登录后这里能同步显示）
  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({ userInfo: userInfo || null })
  },

  // 退出登录：清缓存
  logout() {
    wx.removeStorageSync('userInfo')
    this.setData({ userInfo: null })
    wx.showToast({ title: '已退出', icon: 'none' })
  }
})
