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
    nickName: '',     // 登录表单中填的昵称
    posterLoading: false,   // 海报生成中（生图十几秒；命中当天缓存则秒开）
    sharePoster: ''         // 刚生成的海报本地路径，用作分享封面（tempFilePath，会话内有效）
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
  },

  // 转发给好友/群：标题带当前人设，封面用刚生成的海报；落到首页让别人自己生成（不暴露自己的记录）
  onShareAppMessage() {
    const r = this.data.result
    return {
      title: r && r.persona ? `我的今日人设是「${r.persona}」` : '快来生成你的今日人设',
      path: '/pages/home/home',
      imageUrl: this.data.sharePoster || ''
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const r = this.data.result
    return {
      title: r && r.persona ? `我的今日人设是「${r.persona}」` : '快来生成你的今日人设',
      imageUrl: this.data.sharePoster || ''
    }
  },

  // —— 海报功能 ——
  // 点"生成海报"：先探缓存——命中（当天已生成）直接预览；未命中才生图→合成→上传云存储→回写→预览
  async onGenPoster() {
    const r = this.data.result
    if (!r) return
    if (!r._id) { wx.showToast({ title: '记录信息缺失，请重新生成', icon: 'none' }); return }

    this.setData({ posterLoading: true })
    try {
      // ① 探缓存（命中就不生图，省十几秒、图固定）
      const probe = await wx.cloud.callFunction({
        name: 'genPosterImage',
        data: {
          action: 'getToday',
          recordId: r._id,
          constellation: this.data.constellations[this.data.constellationIdx],
          persona: r.persona
        }
      })
      const p = probe.result
      if (p.code === 'CACHED') {
        wx.previewImage({ urls: [p.posterFileID], current: p.posterFileID })
        // 缓存命中：fileID 不能直接当分享封面，转成临时网络 URL 存起来，让分享按钮出现
        wx.cloud.getTempFileURL({ fileList: [p.posterFileID] }).then((res) => {
          const f = res.fileList && res.fileList[0]
          if (f && f.tempFileURL) this.setData({ sharePoster: f.tempFileURL })
        })
        return
      }
      if (p.code !== 'OK') throw new Error(p.msg || '生图失败')

      // ② 下背景图（Canvas 2D 的 createImage 只吃本地路径，不能直接用网络 URL）
      // ⚠️ wx.downloadFile 返回的是 downloadTask（用于 abort/监听进度），不走 promise 化——
      //    不能直接 await，要用 success/fail 回调包一层 Promise 才能拿到 {tempFilePath, statusCode}
      const dl = await new Promise((resolve, reject) => {
        wx.downloadFile({ url: p.url, success: resolve, fail: reject })
      })
      if (dl.statusCode !== 200 || !dl.tempFilePath) {
        throw new Error('下载失败（HTTP ' + dl.statusCode + '）')
      }

      // ③ 离屏 Canvas 合成海报
      const posterPath = await this.drawPoster(dl.tempFilePath)
      this.setData({ sharePoster: posterPath })   // 存本地海报路径，分享时当封面

      // ④ 上传云存储（cloudPath 用 recordId，当天同名覆盖；fileID 永久有效）
      const up = await wx.cloud.uploadFile({
        cloudPath: 'posters/' + r._id + '.png',
        filePath: posterPath
      })

      // ⑤ 回写 fileID 到当天记录（best-effort：失败只 warn 不阻断预览，下次重走生图）
      try {
        await wx.cloud.callFunction({
          name: 'genPosterImage',
          data: { action: 'save', recordId: r._id, fileID: up.fileID }
        })
      } catch (e) {
        console.warn('poster writeback failed', e)
      }

      // ⑥ 预览（wx.previewImage 原生支持 cloud:// fileID，自带"保存到相册"）
      wx.previewImage({ urls: [up.fileID], current: up.fileID })
    } catch (e) {
      wx.showToast({ title: '海报失败：' + (e.errMsg || e.message), icon: 'none' })
    } finally {
      this.setData({ posterLoading: false })
    }
  },

  // 在离屏 Canvas 上画海报：背景图全屏，文字直接画在图上（无黑卡）。
  // 纯白字在浅色背景会糊，所以每行文字先描一圈细的半透明深色边、再填白字——
  // 既保证任何背景都可读，又不会出现"黑膏药"那样的突兀色块。
  drawPoster(bgPath) {
    const W = 720, H = 1280
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#posterCanvas').fields({ node: true }).exec((res) => {
        if (!res[0]) return reject(new Error('画布未找到'))
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        // 背景图必须 onload 后再画（Canvas 2D 的 createImage 是异步）
        const loadImg = (src) => new Promise((res2, rej2) => {
          const i = canvas.createImage()
          i.onload = () => res2(i)
          i.onerror = () => rej2(new Error('图片加载失败'))
          i.src = src
        })
        loadImg(bgPath).then((bg) => {
          // ① 背景图全屏铺底（不再画黑色卡片）
          ctx.drawImage(bg, 0, 0, W, H)

          const r = this.data.result || {}
          const padX = 72
          ctx.textBaseline = 'top'
          ctx.lineJoin = 'round'                 // 描边拐角圆滑，避免尖角毛刺
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'   // 文字细描边色（半透明深色）
          ctx.fillStyle = '#fff'

          // ② 人设（大标题；自适应缩字号保证单行，极长才截断省略）
          const titleW = W - padX * 2            // 标题可用宽度（576px，60px 字号约放 9 个中文字）
          let persona = r.persona || ''
          let tFont = 40
          for (let f = 60; f >= 40; f -= 2) {    // 60→40 找一个能单行放下的最大字号
            ctx.font = `bold ${f}px sans-serif`
            if (ctx.measureText(persona).width <= titleW) { tFont = f; break }
          }
          ctx.font = `bold ${tFont}px sans-serif`
          while (ctx.measureText(persona).width > titleW && persona.length > 1) {
            persona = persona.slice(0, -1)       // 缩到 40px 仍放不下，逐字截断
          }
          if (persona !== (r.persona || '')) persona = persona.slice(0, -1) + '…'
          ctx.lineWidth = 9
          ctx.strokeText(persona, padX, 200)
          ctx.fillText(persona, padX, 200)
          let y = 200 + tFont + 36               // 标题下方 y（行高随实际字号）

          // ③ 运势
          ctx.font = '38px sans-serif'
          ctx.lineWidth = 7
          y = wrapText(ctx, r.fortune || '', padX, y, W - padX * 2, 56, true) + 32

          // ④ 宜 / 忌（标签独占一行，下面每条各占一行）
          const drawList = (label, items, top) => {
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 36px sans-serif'
            ctx.lineWidth = 6
            ctx.strokeText(label, padX, top); ctx.fillText(label, padX, top)
            let yy = top + 52
            ctx.font = '32px sans-serif'
            ctx.lineWidth = 5
            for (const it of items) {
              ctx.strokeText('· ' + it, padX + 28, yy); ctx.fillText('· ' + it, padX + 28, yy)
              yy += 46
            }
            return yy
          }
          y = drawList('宜', r.yi || [], y) + 16
          y = drawList('忌', r.ji || [], y) + 24

          // ⑤ 分数（暖橘大数字，单行描边）
          const score = (r.luckScore != null && r.luckScore !== '') ? r.luckScore : '--'
          const scoreText = '今日运势  ' + score + ' / 100'
          ctx.font = 'bold 52px sans-serif'
          ctx.fillStyle = '#ffd49e'
          ctx.lineWidth = 8
          ctx.strokeText(scoreText, padX, y)
          ctx.fillText(scoreText, padX, y)

          // ⑥ 日期（右下角，描边保证浅色区也清晰）
          const d = new Date()
          const ds = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0')
          ctx.font = '28px sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = 5
          ctx.textAlign = 'right'
          ctx.strokeText(ds, W - padX, H - 120)
          ctx.fillText(ds, W - padX, H - 120)
          ctx.textAlign = 'left'   // 复位，避免影响后续绘制

          // ⑦ 导出海报图（destWidth 用 dpr 放大，导出高清）
          wx.canvasToTempFilePath({
            canvas,
            x: 0, y: 0, width: W, height: H,
            destWidth: W * dpr, destHeight: H * dpr,
            success: (o) => resolve(o.tempFilePath),
            fail: (e) => reject(e)
          })
        }).catch(reject)
      })
    })
  }
})

// Canvas 文字自动换行：逐字测量宽度，超了换行；返回最后一行底部的 y。
// outline=true 时，每行先描边再填字（strokeText 必须在 fillText 之前，描边才会被字心盖住、只留细边）。
// 描边的颜色 / 粗细由调用前设置 ctx.strokeStyle / ctx.lineWidth。
function wrapText(ctx, text, x, y, maxWidth, lineHeight, outline) {
  const drawLine = (s, lx, ly) => {
    if (outline) ctx.strokeText(s, lx, ly)
    ctx.fillText(s, lx, ly)
  }
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const test = line + text[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      drawLine(line, x, y)
      line = text[i]
      y += lineHeight
    } else {
      line = test
    }
  }
  if (line) { drawLine(line, x, y); y += lineHeight }
  return y
}

