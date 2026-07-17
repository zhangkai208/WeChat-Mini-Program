Page({
  data: {
    constellations: ['', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'],
    constellationIdx: 0,
    name: '',
    mood: '',
    loading: false,
    result: null,
    errMsg: '',
    userInfo: null,   // 已登录：{ avatarUrl, nickName }
    avatarUrl: '',    // 登录表单中选的头像（临时路径）
    nickName: ''      // 登录表单中填的昵称
  },

  // 每次进入首页，从本地缓存读登录态
  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) this.setData({ userInfo })
  },

  // 选头像（button open-type="chooseAvatar" 触发）
  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  // 填昵称（input type="nickname"）
  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  // 点"进入"完成登录：校验 + 保存登录态到本地缓存
  // 头像用临时路径直接存本地；微信换头像后"退出重登"即可刷新，避免云端存旧的不一致
  confirmLogin() {
    if (!this.data.avatarUrl) {
      wx.showToast({ title: '请先选头像', icon: 'none' })
      return
    }
    if (!this.data.nickName.trim()) {
      wx.showToast({ title: '请填昵称', icon: 'none' })
      return
    }
    const userInfo = {
      avatarUrl: this.data.avatarUrl,   // chooseAvatar 返回的临时路径
      nickName: this.data.nickName.trim()
    }
    this.setData({ userInfo })
    wx.setStorageSync('userInfo', userInfo)
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onMoodInput(e) { this.setData({ mood: e.detail.value }) },
  onConstellationChange(e) { this.setData({ constellationIdx: e.detail.value }) },

  async generate() {
    // 登录拦截
    if (!this.data.userInfo) {
      this.setData({ errMsg: '请先完成上方登录' })
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
