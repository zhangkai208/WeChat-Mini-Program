// 定时触发器云函数：每天 14:00 跑一次，给「点过明日提醒并登记到 subscribes」的用户发订阅消息。
// 一次性订阅：只有在前端点过「明日提醒我」并授权的用户才有发送配额，
// 没配额的 send 会失败（errCode 43101），属预期内，静默跳过。
// 注：定时触发器用 cloud.openapi 需在 config.json 声明 permissions.openapi（已配），否则报 -604101。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TMPL_ID = '8oLgBhItC6t_6pgJaiDuVFqLg-NdIM4Xgm6BQeHnKiE'

exports.main = async () => {
  const db = cloud.database()
  // 查所有登记过「明日提醒」的用户（管理员身份可读全部，绕过「仅创建者可读写」）
  // 单次 get 上限 20 条，个人项目够用；用户量大了再改分页
  const { data } = await db.collection('subscribes').get()

  let ok = 0, fail = 0
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
          time1: { value: '14:00' },             // 时间（和推送时间一致）
          thing2: { value: '快来查看' }          // 备注
        }
      })
      ok++
    } catch (e) {
      // 多半是「该用户没授权/配额用完」，属预期内，只记不抛
      fail++
      console.warn('send fail', r._openid, e.errCode, e.errMsg)
    }
  }
  return { code: 'OK', total: data.length, ok, fail }
}
