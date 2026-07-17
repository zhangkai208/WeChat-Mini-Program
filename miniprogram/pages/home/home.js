Page({
  data: {
    constellations: ['', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'],
    constellationIdx: 0,
    name: '',
    mood: '',
    loading: false,
    result: null,
    errMsg: ''
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onMoodInput(e) { this.setData({ mood: e.detail.value }) },
  onConstellationChange(e) { this.setData({ constellationIdx: e.detail.value }) },

  async generate() {
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
      if (r.code !== 'OK') {
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
