Page({
  data: {
    records: [],
    loading: false,
    errMsg: '',
    page: 0,        // 当前页码（从0开始）
    hasMore: true   // 是否还有更多
  },

  onShow() { this.loadHistory(true) },   // 每次进入刷新

  // reset=true 从头加载；reset=false 加载下一页
  async loadHistory(reset) {
    if (this.data.loading) return
    if (reset) this.setData({ records: [], page: 0, hasMore: true })
    if (!this.data.hasMore && !reset) return

    this.setData({ loading: true, errMsg: '' })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('records')
        .orderBy('createdAt', 'desc')
        .skip(this.data.page * 20)   // 跳过已加载的
        .limit(20)                    // 每次取20条
        .get()
      const list = res.data || []
      this.setData({
        records: this.data.records.concat(list),   // 追加到列表
        page: this.data.page + 1,
        hasMore: list.length === 20                 // 拿满20条，说明可能还有
      })
    } catch (e) {
      this.setData({ errMsg: '加载失败：' + (e.errMsg || e.message) })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 滑到底部自动加载下一页
  onReachBottom() {
    this.loadHistory(false)
  }
})
