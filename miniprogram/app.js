App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库')
      return
    }
    wx.cloud.init({
      // ← 替换为你的云开发环境ID（云开发控制台 → 环境 → 复制环境ID）
      env: 'zk-d2gcfqw9f402f9607',
      traceUser: true
    })
  },
  globalData: {}
})
