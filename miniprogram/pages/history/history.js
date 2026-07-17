Page({
  data: { records: [], loading: true, errMsg: '' },

  onShow() { this.loadHistory() },   // 每次进入刷新

  async loadHistory() {
    this.setData({ loading: true, errMsg: '' })
    try {
      const db = wx.cloud.database()
      // 仅创建者可读写 + 按 _openid 自动过滤当前用户
      const res = await db.collection('records')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()
      this.setData({ records: res.data })
    } catch (e) {
      this.setData({ errMsg: '加载失败：' + (e.errMsg || e.message) })
    } finally {
      this.setData({ loading: false })
    }
  }
})
