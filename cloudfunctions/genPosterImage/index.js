// 云函数：genPosterImage
// 职责：拼 prompt → 用 @cloudbase/node-sdk（云开发 Node SDK）调 HY-Image 文生图 → 返回图片 URL
//
// 为什么用 @cloudbase/node-sdk 而不是 wx-server-sdk：
//   小程序成长计划「仅支持小程序 SDK 和云开发 SDK」(AI_CHANNEL_NOT_ALLOWED)。
//   实测 wx-server-sdk 的 cloud.ai() 仍被拒——它不被认可为合法 channel；
//   @cloudbase/node-sdk 是文档指定的"云开发 Node SDK"，且文档明说"图片生成仅在 Node SDK 中可用"。
// 好处：走环境自带鉴权，不需要 AI_URL/AI_KEY。
//
// ⚠️ 返回的图片 URL 只有 24 小时有效！前端拿到后必须立即 downloadFile 画进 Canvas，不能存库。
const tcb = require('@cloudbase/node-sdk')

// 生图慢（十几秒），单次 HTTP 超时调到 150s，避免默认超时掐断
const app = tcb.init({
  env: 'zk-d2gcfqw9f402f9607',   // 环境 ID（公开信息，非密钥）
  timeout: 150000
})

exports.main = async (event) => {
  const { constellation = '', persona = '' } = event
  const prompt = buildPrompt(constellation, persona)

  try {
    const imageModel = app.ai().createImageModel('hunyuan-image')
    const res = await imageModel.generateImage({
      model: 'HY-Image-3.0-Plus-4090-Tob-v1.0',
      prompt,
      size: '720x1280',          // 竖图，面积合规、适合手机海报
      revise: { value: false }   // 关掉 prompt 改写，省约 30s
    })
    const url = res.data[0] && res.data[0].url
    if (!url) return { code: 'AI_ERR', msg: 'AI 未返回图片' }
    return { code: 'OK', url }
  } catch (e) {
    return { code: 'AI_ERR', msg: '生图失败：' + e.message }
  }
}

// 12 星座专属色调（可爱治愈系插画配色），让每个星座背景有视觉区分度。
// 仅给文生图的中文配色描述，与产品文案无关；空字符串（没填星座）落到默认梦幻多彩。
const CONSTELLATION_PALETTES = {
  '白羊': '暖珊瑚红与奶白色调',
  '金牛': '抹茶绿与燕麦米色调',
  '双子': '明柠檬黄与浅天蓝调',
  '巨蟹': '月光银蓝与薄雾紫调',
  '狮子': '落日金棕与琥珀橙调',
  '处女': '鼠尾草绿与米白色调',
  '天秤': '樱花粉与雾霾蓝调',
  '天蝎': '深葡萄紫与暗夜蓝调',
  '射手': '暖橙紫与落霞色调',
  '摩羯': '雾岩灰蓝与砂石灰调',
  '水瓶': '冰晶蓝与电光青调',
  '双鱼': '梦幻海蓝与樱花紫调'
}

// 把人设信息翻译成适合文生图的画面描述。
// 注：persona（具体句子）暂不直接塞 prompt——AI 画不出具体中文句子的画面，先用星座定主题与配色。
function buildPrompt(constellation, persona) {
  const palette = CONSTELLATION_PALETTES[constellation] || '梦幻马卡龙多彩色调'
  const theme = constellation ? `${constellation}座主题元素与符号` : '梦幻星空元素'
  return [
    theme,
    '可爱治愈系插画风格',
    palette + '，柔和光影',
    '画面上半部分保留大面积纯色柔和留白，便于后续排版文字',
    '不要出现任何文字、字母、数字、签名或水印'
  ].join('，')
}
