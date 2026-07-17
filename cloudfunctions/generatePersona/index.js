// 云函数：generatePersona
// 职责：拼 prompt → HTTP 调 AI → 解析 → 存 records → 返回
//
// 安全：AI_KEY 只从环境变量读，绝不硬编码、不入库、不入日志。
//       AI_URL/AI_MODEL 同样走环境变量。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AI_URL = process.env.AI_URL

exports.main = async (event) => {
  const { name, constellation = '', mood = '' } = event

  // 1. 参数校验
  if (!name || !name.trim()) {
    return { code: 'PARAM_ERR', msg: '请输入名字' }
  }

  // 2. 今天的日期（云函数默认 UTC，转成上海时区的日期串）
  const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })

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

  // 5. 写入 records（云数据库自动带 _openid，按用户隔离）
  const db = cloud.database()
  await db.collection('records').add({
    data: {
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

  // 6. 返回给前端
  return { code: 'OK', data: parsed }
}

function buildMessages({ name, constellation, mood, today }) {
  const sys = [
    '你是幽默的"今日人设算命师"。',
    '根据用户信息和今天日期，生成一份有趣的今日人设运势。',
    '严格只返回一个 JSON 对象，不要任何多余文字、不要 markdown。',
    'JSON 格式：{"persona":"搞笑人设(如:薛定谔的打工人)","fortune":"一句话运势,要有梗","yi":["宜..."],"ji":["忌..."],"luckScore":0到100的整数}',
    '风格：轻松幽默有网感，不低俗。'
  ].join('')
  const user = `名字：${name}；星座：${constellation || '未知'}；心情：${mood || '未知'}；今天：${today}`
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ]
}

// OpenAI 兼容格式调用。若你的接口格式不同，改这里。
async function callAI(messages) {
  const key = process.env.AI_KEY
  if (!AI_URL) throw new Error('未配置 AI_URL')
  if (!key) throw new Error('未配置 AI_KEY')

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages,
      temperature: 0.9
    })
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return data.choices[0].message.content
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
