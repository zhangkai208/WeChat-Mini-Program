// 云函数：generatePersona
// 职责：拿openid → 查当天是否已生成 → 拼prompt → HTTP调AI → 解析 → 存records → 返回
//
// 安全：AI_KEY 只从环境变量读，绝不硬编码、不入库、不入日志。
//       AI_URL/AI_MODEL 同样走环境变量。
const cloud = require('wx-server-sdk')
const https = require('https')
const { URL } = require('url')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AI_URL = process.env.AI_URL

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
  await db.collection('records').add({
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

// OpenAI 兼容格式调用。云函数 Node16 运行时无全局 fetch，改用原生 https。
async function callAI(messages) {
  const key = process.env.AI_KEY
  if (!AI_URL) throw new Error('未配置 AI_URL')
  if (!key) throw new Error('未配置 AI_KEY')

  const body = JSON.stringify({
    model: process.env.AI_MODEL,
    messages,
    temperature: 0.9
  })

  const u = new URL(AI_URL)
  const options = {
    method: 'POST',
    hostname: u.hostname,
    path: u.pathname + u.search,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      // 用字节长度，避免中文 body 被算短导致请求被截断
      'Content-Length': Buffer.byteLength(body)
    }
  }

  const text = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunk = ''
      res.on('data', (c) => { chunk += c })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          // chunk 是网关响应体，不含 key，带上一段方便排查
          reject(new Error('HTTP ' + res.statusCode + (chunk ? '：' + chunk.slice(0, 200) : '')))
          return
        }
        resolve(chunk)
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  const data = JSON.parse(text)
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
