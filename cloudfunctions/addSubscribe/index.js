// 前端点「开启明日提醒」授权成功后调用：把当前用户登记到 subscribes 集合，
// 供 dailyNotify 每天 14:00 群发。一个 openid 一条（重复点只更新时间）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  // openid 只能服务端自取，绝不信任前端传入（安全红线，同 records）
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: 'NO_AUTH', msg: '无 openid' }

  const db = cloud.database()
  const col = db.collection('subscribes')
  const now = Date.now()

  // upsert：已登记则刷新时间；否则新建（_openid 必须显式写入，云函数 add 不会自动写）
  const { data } = await col.where({ _openid: OPENID }).get()
  if (data.length > 0) {
    await col.doc(data[0]._id).update({ data: { updatedAt: now } })
  } else {
    await col.add({ data: { _openid: OPENID, createdAt: now, updatedAt: now } })
  }
  return { code: 'OK' }
}
