// 定时触发器云函数：每天早上跑一次，给「昨天生成过人设」的用户发订阅消息提醒。
// 一次性订阅：只有昨天在前端点过「明日提醒我」并授权的用户才有发送配额，
// 没授权的 send 会失败（errCode 43101 之类），属预期内，静默跳过。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TMPL_ID = '8oLgBhItC6t_6pgJaiDuVFqLg-NdIM4Xgm6BQeHnKiE'

exports.main = async (event = {}) => {
  // 算日期字符串（上海时区，和 generatePersona 写 records.date 的格式保持一致）
  // 正常定时触发查「昨天」的记录；控制台手动测试可传 { testMode: true } 查「今天」，立即验证
  const base = event.testMode ? Date.now() : Date.now() - 24 * 3600 * 1000
  const dateStr = new Date(base).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })

  const db = cloud.database()
  const { data } = await db.collection('records').where({ date: dateStr }).get()

  let ok = 0, fail = 0
  const fails = []   // 【临时调试】收集失败详情，定位完连同 home.js 调试行一起删
  for (const r of data) {
    if (!r._openid) continue
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r._openid,
        templateId: TMPL_ID,
        page: 'pages/home/home',
        miniprogramState: 'trial',   // 体验版
        data: {
          // key 必须是模板关键词的英文变量名（{{xx.DATA}} 里的 xx），非中文显示名
          thing3: { value: '今日人设待解锁' },   // 处理结果
          time1: { value: '08:30' },             // 时间
          thing2: { value: '快来查看' }          // 备注
        }
      })
      ok++
    } catch (e) {
      // 多半是「该用户没授权/配额用完」，属预期内，只记不抛
      fail++
      fails.push({ errCode: e.errCode, errMsg: e.errMsg })   // 【临时调试】
      console.warn('send fail', r._openid, e.errCode, e.errMsg)
    }
  }
  return { code: 'OK', date: dateStr, total: data.length, ok, fail, fails }   // 【临时调试】带出 fails
}
