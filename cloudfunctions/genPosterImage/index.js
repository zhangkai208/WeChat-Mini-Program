// 云函数：genPosterImage
// 职责（扩展）：按 action 分派——
//   getToday：查当天 record 有无 posterFileID，有就返缓存 fileID，没有就生图返背景图 url
//   save    ：把合成海报的 fileID 回写到当天 record
//
// 两个 SDK 并存（与 generatePersona 一致）：
//   wx-server-sdk       → getWXContext() 取 openid + 操作 records 数据库
//   @cloudbase/node-sdk → 调 AI 生图（createImageModel，走环境鉴权，不需要 AI_KEY）
//
// ⚠️ 返回的生图 url 只有 24 小时有效；前端拿到后必须立即 downloadFile 画进 Canvas。
const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const app = tcb.init({ env: 'zk-d2gcfqw9f402f9607', timeout: 150000 })

exports.main = async (event) => {
  const { action = 'getToday', recordId, constellation = '', persona = '', fileID } = event
  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()

  // —— action === 'save'：回写 posterFileID ——
  if (action === 'save') {
    const upd = await db.collection('records')
      .where({ _id: recordId, _openid: OPENID })   // 双校验，防伪造他人 recordId
      .update({ data: { posterFileID: fileID } })
    if (upd.stats.updated === 0) return { code: 'NOT_FOUND', msg: '记录不存在或无权操作' }
    return { code: 'OK' }
  }

  // —— action === 'getToday'：探缓存，命中直接返，未命中生图 ——
  const r = await db.collection('records')
    .where({ _id: recordId, _openid: OPENID })
    .limit(1).get()
  if (!r.data.length) return { code: 'NOT_FOUND', msg: '记录不存在或无权操作' }
  if (r.data[0].posterFileID) {
    return { code: 'CACHED', posterFileID: r.data[0].posterFileID }
  }

  // 未命中：生图（沿用原逻辑）
  try {
    const prompt = buildPrompt(constellation, persona)
    const imageModel = app.ai().createImageModel('hunyuan-image')
    const res = await imageModel.generateImage({
      model: 'HY-Image-3.0-Plus-4090-Tob-v1.0',
      prompt,
      size: '720x1280',
      revise: { value: false }
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
