// 云函数：generatePersona
// 职责：拿openid → 查当天是否已生成 → 拼prompt → SDK调AI → 解析 → 存records → 返回
//
// 两个 SDK 并存（各司其职）：
//   wx-server-sdk       → getWXContext() 拿调用者 openid + 操作云数据库（小程序场景特有，node-sdk 没有）
//   @cloudbase/node-sdk → 调 AI（createModel/generateText，走环境鉴权，不需要 AI_KEY）
//
// 安全：AI 走 SDK 环境鉴权，不再需要 AI_URL/AI_KEY；模型名 hy3 写死在代码（与生图一致，不再依赖环境变量）。
const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const app = tcb.init({ env: 'zk-d2gcfqw9f402f9607', timeout: 60000 })

exports.main = async (event) => {
  const { name, constellation = '', mood = '' } = event

  // 拿到当前调用者的 openid（微信底层自动提供，无需前端传）
  const { OPENID } = cloud.getWXContext()

  // 0. 参数校验
  if (!name || !name.trim()) {
    return { code: 'PARAM_ERR', msg: '请输入名字' }
  }

  // 1. 今天的日期（云函数默认 UTC，转成上海时区）
  const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const db = cloud.database()

  // 2. 一天一次：查当前 openid 今天有没有生成过
  try {
    const dup = await db.collection('records')
      .where({ _openid: OPENID, date: today })
      .limit(1)
      .get()
    if (dup.data.length > 0) {
      return {
        code: 'DUP_TODAY',
        msg: '今天已经生成过啦，明天再来～',
        data: dup.data[0]   // 把已有的结果返回，前端直接展示
      }
    }
  } catch (e) {
    // 查重失败不阻塞生成（容错），继续往下
  }

  // 3. 调 AI
  let aiText
  try {
    aiText = await callAI(buildMessages({ name, constellation, mood, today }))
  } catch (e) {
    return { code: 'AI_ERR', msg: 'AI 调用失败：' + e.message }
  }

  // 4. 解析 JSON（容错：去 ``` 包裹、截取 {...}）
  let parsed
  try {
    parsed = parseAIJson(aiText)
  } catch (e) {
    return { code: 'PARSE_ERR', msg: 'AI 返回格式异常', raw: aiText }
  }

  // 5. 写入 records（显式写 _openid，否则前端"仅创建者可读写"读不到）
  const addRes = await db.collection('records').add({
    data: {
      _openid: OPENID,
      name, constellation, mood,
      persona: parsed.persona,
      fortune: parsed.fortune,
      yi: parsed.yi || [],
      ji: parsed.ji || [],
      luckScore: parsed.luckScore,
      date: today,
      createdAt: db.serverDate()
    }
  })

  // 6. 返回给前端（带 _id，供前端生成海报时定位记录、拼 cloudPath）
  return { code: 'OK', data: { ...parsed, _id: addRes._id } }
}

function buildMessages({ name, constellation, mood, today }) {
  const sys = [
    '你是幽默的"今日人设算命师"。',
    '根据用户信息和今天日期，生成一份有趣的今日人设运势。',
    '严格只返回一个 JSON 对象，不要任何多余文字、不要 markdown。',
    'JSON 格式：{"persona":"搞笑人设","fortune":"一句话运势,要有梗","yi":["宜..."],"ji":["忌..."],"luckScore":0到100的整数}',
    '风格：轻松幽默有网感，不低俗。'
  ].join('')
  const user = `名字：${name}；星座：${constellation || '未知'}；心情：${mood || '未知'}；今天：${today}`
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ]
}

// 用云开发 Node SDK 调 AI：createModel('cloudbase') 拿文本模型，generateText 一次性返回。
// 走环境鉴权（不需要 AI_KEY）；返回的 res.text 已是纯文本，直接喂给 parseAIJson。
// 之前手搓 https 的 45 行（拼URL/字节长度/chunk拼接/状态码判断）全部省掉。
async function callAI(messages) {
  const model = app.ai().createModel('cloudbase')
  const res = await model.generateText({
    model: 'hy3',
    messages,
    temperature: 0.9
  })
  return res.text
}

function parseAIJson(text) {
  let t = (text || '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  return JSON.parse(t)
}
