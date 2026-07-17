Page({
  data: {
    constellations: ['', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'],
    constellationIdx: 0,
    name: '',
    mood: '',
    loading: false,
    result: null,
    errMsg: '',
    userInfo: null   // 登录态：null 表示未登录
  },

  // 每次进入首页，从本地缓存读登录态（和「我的」页共享同一个 key）
  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) this.setData({ userInfo })
  },

  // 微信授权登录（拿头像 + 昵称）
  async login() {
    try {
      const { userInfo } = await wx.getUserProfile({ desc: '登录后才能生成今日人设' })
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
    } catch (e) {
      wx.showToast({ title: '已取消', icon: 'none' })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onMoodInput(e) { this.setData({ mood: e.detail.value }) },
  onConstellationChange(e) { this.setData({ constellationIdx: e.detail.value }) },

  async generate() {
    // 登录拦截：未登录直接拦住
    if (!this.data.userInfo) {
      this.setData({ errMsg: '请先点上方"微信登录"' })
      return
    }

    const name = (this.data.name || '').trim()
    if (!name) { this.setData({ errMsg: '请先输入名字' }); return }

    const constellation = this.data.constellations[this.data.constellationIdx]
    this.setData({ loading: true, errMsg: '', result: null })

    try {
      const res = await wx.cloud.callFunction({
        name: 'generatePersona',
        data: { name, constellation, mood: this.data.mood }
      })
      const r = res.result
      if (r.code === 'DUP_TODAY') {
        // 今天已生成过：提示 + 展示之前的结果
        this.setData({ errMsg: r.msg, result: r.data })
      } else if (r.code !== 'OK') {
        this.setData({ errMsg: r.msg || '生成失败，请重试' })
      } else {
        this.setData({ result: r.data })
      }
    } catch (e) {
      this.setData({ errMsg: '调用失败：' + (e.errMsg || e.message) })
    } finally {
      this.setData({ loading: false })
    }
  }
})
