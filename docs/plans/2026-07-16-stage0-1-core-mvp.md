# 今日人设小程序 · 阶段 0+1 实施计划（核心 MVP）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成云开发开通准备，并跑通"输入名字 → AI 生成今日人设运势 → 自动存历史 → 微信拿头像昵称"的核心闭环，得到一个能用的完整小程序。

**Architecture:** 原生小程序前端 + 腾讯云开发（云函数 `generatePersona` 通过 HTTP 调 AI、云数据库 `records` 存历史）。数据按 `_openid` 自动隔离。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS）、腾讯云开发 CloudBase、云函数 Node.js 18+（内置 fetch）、`wx-server-sdk`。

## Global Constraints

- **平台**：微信小程序原生开发（不用 uni-app/Taro）。
- **AI 调用安全红线**：API Key 只能存在云函数**环境变量** `AI_KEY` 中；禁止硬编码、入库、入日志、入对话。URL 可入码或同样存环境变量。
- **数据库权限**：`records` 集合权限设为「仅创建者可读写」。
- **版本**：云函数运行时选 **Node.js 18 或以上**（用内置 `fetch`）。
- **环境 ID**：需在 `app.js` 中替换为真实的云开发环境 ID。
- **验证约定**：小程序/云开发项目以「开发者工具中运行 + 观察预期效果」作为每个任务的验证，不写自动化单测。
- **频次提交**：每个产出代码的任务结束都 commit。

## 验证与测试约定（替代严格 TDD）

本项目是小程序 + 云开发练手，验证方式如下：
- **云函数**：在开发者工具的「云开发 → 云函数 → 测试」里用测试参数调用，或在前端调用后看返回。
- **小程序页面**：在开发者工具模拟器中操作，观察页面表现是否符合预期。
- **每个任务的"验证"步骤给出：操作 + 预期结果**。

---

## 文件结构（阶段 1 结束时）

小程序（开发者工具创建的项目根目录）：
- `miniprogram/app.js` — 入口，初始化 `wx.cloud`
- `miniprogram/app.json` — 页面注册、tabBar、窗口配置
- `miniprogram/app.wxss` — 全局样式
- `miniprogram/pages/home/{home.js,home.wxml,home.wxss,home.json}` — 首页（生成）
- `miniprogram/pages/history/{history.js,history.wxml,history.wxss,history.json}` — 历史页
- `miniprogram/pages/profile/{profile.js,profile.wxml,profile.wxss,profile.json}` — 我的页

云函数：
- `cloudfunctions/generatePersona/index.js` — 主逻辑
- `cloudfunctions/generatePersona/package.json` — 依赖

数据库（控制台创建）：`records` 集合

---

## 阶段 0：开通准备

### Task 1: 初始化 git 仓库

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: 在项目根目录初始化 git**

在 `c:\Users\张恺\Desktop\Cloud Development` 打开终端，运行：
```bash
git init
git add docs
git commit -m "docs: 设计文档"
```

- [ ] **Step 2: 创建 `.gitignore`，防止敏感信息和无关文件入库**

创建 `.gitignore`，内容：
```
# 微信开发者工具
project.private.config.json

# 依赖
node_modules/
miniprogram_npm/

# 系统
.DS_Store
Thumbs.db

# 日志
*.log
```

- [ ] **Step 3: 提交**
```bash
git add .gitignore
git commit -m "chore: 添加 .gitignore"
```

**验证：** `git log` 能看到两条提交；`.gitignore` 存在。

---

### Task 2: 开通云开发环境与 AI 能力（控制台操作）

> 这一步全部在浏览器 + 腾讯云控制台完成。界面如有差异，按功能名称找对应入口。

**需要准备的东西（自己保管，不要发给我）：**
- 你的 AI 服务**接口 URL**（可告诉我，用于写进代码/配置）
- 你的 AI 服务 **API Key**（🚫 绝不要发我、不要写进代码，只能填到云函数环境变量）

- [ ] **Step 1: 开通云开发环境**

1. 打开 [云开发控制台](https://tcb.cloud.tencent.com/)，登录。
2. 新建一个环境（记下**环境 ID**，后面要用，例如 `cloud1-0abc...`）。
3. 进入该环境，确认「云函数」「云数据库」「云存储」都在。

- [ ] **Step 2: 在云函数里配置 AI 环境变量（key 自己填）**

1. 进入「云函数」页面（先随便看一个函数或新建空函数，找到「配置 → 环境变量」入口）。
2. 添加环境变量：
   - `AI_URL` = 你的 AI 接口地址（例如 `https://api.xxx.com/v1/chat/completions`）
   - `AI_KEY` = 你的 API Key（**只有你填**）
   - `AI_MODEL` = 模型名（例如 `deepseek-chat`）
3. 保存。

> ⚠️ 确认环境变量是「按函数配置」还是「环境级配置」，以你的控制台为准。Task 5 部署云函数后，再回来确认这个函数能读到这三个变量。

**验证：** 控制台能看到环境 ID；AI 相关环境变量已添加（值不显示给你以外的人）。

---

### Task 3: 用微信开发者工具创建小程序项目并初始化云开发 SDK

**前提：** 你的小程序 AppID 已就绪。

- [ ] **Step 1: 新建项目**

1. 打开微信开发者工具，新建项目：
   - 目录：`c:\Users\张恺\Desktop\Cloud Development`
   - AppID：填你的小程序 AppID
   - 后端服务：选「**微信·云开发**」
   - 模板：选「不使用模板」或最简模板
2. 创建后，若提示「开通云开发」，用 Task 2 同一个账号/环境。

- [ ] **Step 2: 确认项目结构生成了 `cloudfunctions/` 和 `miniprogram/` 两个目录**

若无 `cloudfunctions` 目录，在 `project.config.json` 里确认有：
```json
"cloudfunctionRoot": "cloudfunctions/",
"miniprogramRoot": "miniprogram/"
```

- [ ] **Step 3: 在 `app.js` 初始化云开发（替换环境 ID）**

把 `miniprogram/app.js` 改为：
```js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库')
      return
    }
    wx.cloud.init({
      env: '替换为你的环境ID',   // ← Task 2 Step1 拿到的环境 ID
      traceUser: true
    })
  },
  globalData: {}
})
```

- [ ] **Step 4: 提交**
```bash
git add -A
git commit -m "feat: 创建小程序项目并初始化云开发"
```

**验证：** 开发者工具不报 `wx.cloud.init` 错误；控制台无环境 ID 无效的红字。

---

## 阶段 1：核心跑通

### Task 4: 创建云数据库 records 集合并配置权限

**Files:** （控制台操作，无代码文件）

- [ ] **Step 1: 创建集合**

云开发控制台 → 云数据库 → 新建集合，名称：`records`（不建字段，写入时自动生成）。

- [ ] **Step 2: 设置权限为「仅创建者可读写」**

集合 `records` → 权限设置 → 选「**仅创建者可读写**」→ 保存。
> 这保证每个人只能看到自己的历史，靠 `_openid` 自动隔离。

**验证：** 集合列表里有 `records`，权限标注为「仅创建者可读写」。

---

### Task 5: 编写并部署 generatePersona 云函数

**Files:**
- Create: `cloudfunctions/generatePersona/package.json`
- Create: `cloudfunctions/generatePersona/index.js`

**Interfaces:**
- Produces: 云函数 `generatePersona`，入参 `{ name, constellation?, mood? }`，返回 `{ code, data?, msg? }`。`code === 'OK'` 时 `data` 形如 `{ persona, fortune, yi:[], ji:[], luckScore }`。

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "generatePersona",
  "version": "1.0.0",
  "description": "生成今日人设运势",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "^2.6.3"
  }
}
```

- [ ] **Step 2: 创建 `index.js`**

```js
// 云函数：generatePersona
// 职责：拼 prompt → HTTP 调 AI → 解析 → 存 records → 返回
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// AI 接口 URL：优先读环境变量，回退到默认（用户按需替换默认值）
const AI_URL = process.env.AI_URL

exports.main = async (event) => {
  const { name, constellation = '', mood = '' } = event

  // 1. 参数校验
  if (!name || !name.trim()) {
    return { code: 'PARAM_ERR', msg: '请输入名字' }
  }

  // 2. 今天的日期（云函数默认 UTC，这里转成日期串即可）
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

  // 6. 返回
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
  const key = process.env.AI_KEY           // 从环境变量读，绝不硬编码
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
```

- [ ] **Step 3: 部署云函数**

在开发者工具左侧 `cloudfunctions/generatePersona` 文件夹上**右键 → 上传并部署：云端安装依赖**（注意是"云端安装"，这样 `wx-server-sdk` 在云端装）。等待提示"上传成功"。

- [ ] **Step 4: 确认该云函数的环境变量已生效**

回到云开发控制台 → 云函数 → `generatePersona` → 配置 → 确认有 `AI_URL`、`AI_KEY`、`AI_MODEL` 三个环境变量（Task 2 配的；若当时是环境级配置，这里应已继承；没有则在此函数补上）。

- [ ] **Step 5: 测试云函数**

控制台 → 云函数 → `generatePersona` → 测试，输入：
```json
{ "name": "小明", "constellation": "白羊", "mood": "想摸鱼" }
```
**预期：** 返回 `{ "code": "OK", "data": { persona, fortune, yi, ji, luckScore } }`，且数据库 `records` 里多出一条记录。

- [ ] **Step 6: 提交**
```bash
git add cloudfunctions/generatePersona
git commit -m "feat: 实现并部署 generatePersona 云函数"
```

---

### Task 6: 小程序入口配置（app.js / app.json / app.wxss）

**Files:**
- Modify: `miniprogram/app.js`（已在 Task 3 初始化，确认即可）
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/app.wxss`

- [ ] **Step 1: 写 `app.json`（注册页面 + tabBar）**

```json
{
  "pages": [
    "pages/home/home",
    "pages/history/history",
    "pages/profile/profile"
  ],
  "window": {
    "navigationBarTitleText": "今日人设",
    "navigationBarBackgroundColor": "#faf7f2",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#faf7f2"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#e8a87c",
    "backgroundColor": "#ffffff",
    "list": [
      { "pagePath": "pages/home/home", "text": "生成" },
      { "pagePath": "pages/history/history", "text": "历史" },
      { "pagePath": "pages/profile/profile", "text": "我的" }
    ]
  },
  "sitemapLocation": "sitemap.json"
}
```

> 说明：tabBar 暂不放图标（纯文字也能显示）。后续要图标再加 `iconPath`。

- [ ] **Step 2: 写 `app.wxss`（全局样式）**

```css
page {
  background: #faf7f2;
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
  color: #333;
}
.container { padding: 40rpx; }
.title { font-size: 44rpx; font-weight: 700; margin-bottom: 30rpx; text-align: center; }
.input {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  margin-bottom: 20rpx; font-size: 30rpx;
}
.btn {
  background: #e8a87c; color: #fff; border-radius: 40rpx;
  margin: 20rpx 0; font-size: 32rpx;
}
.err { color: #d9534f; text-align: center; margin-top: 10rpx; font-size: 26rpx; }
.card {
  background: #fff; border-radius: 20rpx; padding: 36rpx; margin-top: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);
}
```

- [ ] **Step 3: 提交**
```bash
git add miniprogram/app.json miniprogram/app.wxss
git commit -m "feat: 全局配置与样式"
```

**验证：** 开发者工具编译无错（页面还没建，会提示页面不存在，属正常，Task 7 起逐个建）。

---

### Task 7: 首页 —— 生成今日人设

**Files:**
- Create: `miniprogram/pages/home/home.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: 云函数 `generatePersona`，调用方式 `wx.cloud.callFunction({ name:'generatePersona', data:{...} })`。

- [ ] **Step 1: `home.json`**
```json
{ "usingComponents": {}, "navigationBarTitleText": "今日人设" }
```

- [ ] **Step 2: `home.js`**
```js
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
```

- [ ] **Step 3: `home.wxml`**
```xml
<view class="container">
  <view class="title">🎭 今日人设生成器</view>

  <input class="input" placeholder="输入你的名字" bindinput="onNameInput" value="{{name}}" />

  <picker mode="selector" range="{{constellations}}" bindchange="onConstellationChange" value="{{constellationIdx}}">
    <view class="input">星座：{{constellations[constellationIdx] || '选填'}}</view>
  </picker>

  <input class="input" placeholder="今天心情如何？（选填）" bindinput="onMoodInput" value="{{mood}}" />

  <button class="btn" bindtap="generate" loading="{{loading}}" disabled="{{loading}}">
    生成今日人设
  </button>

  <view wx:if="{{errMsg}}" class="err">{{errMsg}}</view>

  <view wx:if="{{result}}" class="card">
    <view class="persona">🎭 {{result.persona}}</view>
    <view class="fortune">{{result.fortune}}</view>
    <view class="score">今日运势：{{result.luckScore}} / 100</view>
    <view class="row">
      <view class="col">
        <view class="lbl">宜</view>
        <view wx:for="{{result.yi}}" wx:key="*this" class="item">· {{item}}</view>
      </view>
      <view class="col">
        <view class="lbl">忌</view>
        <view wx:for="{{result.ji}}" wx:key="*this" class="item">· {{item}}</view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: `home.wxss`（页面内样式，补充全局未覆盖的）**
```css
.persona { font-size: 38rpx; font-weight: 700; margin-bottom: 16rpx; }
.fortune { font-size: 30rpx; color: #555; margin-bottom: 16rpx; }
.score { font-size: 28rpx; color: #e8a87c; margin-bottom: 24rpx; }
.row { display: flex; gap: 40rpx; }
.col { flex: 1; }
.lbl { font-weight: 700; margin-bottom: 12rpx; }
.item { font-size: 28rpx; color: #666; line-height: 1.8; }
```

- [ ] **Step 5: 提交**
```bash
git add miniprogram/pages/home
git commit -m "feat: 首页生成今日人设"
```

**验证：** 模拟器首页能输入名字、选星座、点「生成今日人设」后展示一张人设卡片（含人设/运势/宜忌/分数）。出错会显示 `errMsg`。

---

### Task 8: 历史页 —— 查看历史记录

**Files:**
- Create: `miniprogram/pages/history/history.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: 云数据库 `records` 集合（仅创建者可读写，按 `_openid` 自动过滤当前用户）。

- [ ] **Step 1: `history.json`**
```json
{ "usingComponents": {}, "navigationBarTitleText": "历史" }
```

- [ ] **Step 2: `history.js`**
```js
Page({
  data: { records: [], loading: true, errMsg: '' },

  onShow() { this.loadHistory() },   // 每次进入刷新

  async loadHistory() {
    this.setData({ loading: true, errMsg: '' })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('records')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()
      this.setData({ records: res.data })
    } catch (e) {
      this.setData({ errMsg: '加载失败：' + (e.errMsg || e.message) })
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

- [ ] **Step 3: `history.wxml`**
```xml
<view class="container">
  <view class="title">📜 我的历史</view>
  <view wx:if="{{loading}}" class="muted">加载中…</view>
  <view wx:elif="{{errMsg}}" class="err">{{errMsg}}</view>
  <view wx:elif="{{records.length === 0}}" class="muted">还没有记录，去生成一个吧～</view>

  <view wx:for="{{records}}" wx:key="_id" class="card">
    <view class="date">{{item.date}}</view>
    <view class="persona">🎭 {{item.persona}}</view>
    <view class="fortune">{{item.fortune}}</view>
    <view class="score">运势 {{item.luckScore}}/100</view>
  </view>
</view>
```

- [ ] **Step 4: `history.wxss`**
```css
.muted { color: #999; text-align: center; margin-top: 40rpx; }
.date { font-size: 24rpx; color: #aaa; margin-bottom: 8rpx; }
.persona { font-size: 32rpx; font-weight: 700; margin-bottom: 8rpx; }
.fortune { font-size: 28rpx; color: #555; margin-bottom: 8rpx; }
.score { font-size: 26rpx; color: #e8a87c; }
.card { margin-bottom: 24rpx; }
```

- [ ] **Step 5: 提交**
```bash
git add miniprogram/pages/history
git commit -m "feat: 历史页查看生成记录"
```

**验证：** 先在首页生成 1～2 条，切到「历史」tab，能看到刚才的记录（按时间倒序）。

---

### Task 9: 我的页 + tabBar 联调 + 收尾

**Files:**
- Create: `miniprogram/pages/profile/profile.{js,wxml,wxss,json}`

> 说明：阶段 1 的"登录"用 `wx.getUserProfile` 拿头像昵称展示即可；数据的归属隔离已由云函数写入 `records` 时自动注入的 `_openid` 完成，无需单独登录云函数（YAGNI）。`users` 集合留待后续需要云端持久化资料时再加。
>
> ⚠️ 头像昵称限制：2022.10 后的新基础库中，`wx.getUserProfile` 可能返回匿名头像和"微信用户"。练手阶段无妨（不影响生成/历史）；若要真实头像昵称，改用 `<button open-type="chooseAvatar">` + `<input type="nickname">`，留待打磨阶段处理。

- [ ] **Step 1: `profile.json`**
```json
{ "usingComponents": {}, "navigationBarTitleText": "我的" }
```

- [ ] **Step 2: `profile.js`**
```js
Page({
  data: { userInfo: null },

  onShow() {
    const cached = wx.getStorageSync('userInfo')
    if (cached) this.setData({ userInfo: cached })
  },

  async login() {
    try {
      const { userInfo } = await wx.getUserProfile({ desc: '展示头像和昵称' })
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
    } catch (e) {
      wx.showToast({ title: '已取消', icon: 'none' })
    }
  },

  logout() {
    wx.removeStorageSync('userInfo')
    this.setData({ userInfo: null })
  }
})
```

- [ ] **Step 3: `profile.wxml`**
```xml
<view class="container">
  <view class="title">😊 我的</view>

  <view wx:if="{{userInfo}}" class="card">
    <image class="avatar" src="{{userInfo.avatarUrl}}" />
    <view class="nick">{{userInfo.nickName}}</view>
    <button class="btn" bindtap="logout">退出登录</button>
  </view>

  <view wx:else class="card">
    <view class="muted">登录后体验更完整</view>
    <button class="btn" bindtap="login">微信登录</button>
  </view>

  <view class="tip">你的生成记录靠微信身份自动隔离，只有你能看到。</view>
</view>
```

- [ ] **Step 4: `profile.wxss`**
```css
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; margin-bottom: 16rpx; }
.nick { font-size: 32rpx; font-weight: 700; margin-bottom: 20rpx; }
.muted { color: #999; margin-bottom: 20rpx; }
.tip { color: #bbb; font-size: 24rpx; text-align: center; margin-top: 40rpx; }
```

- [ ] **Step 5: 全流程联调**

在模拟器走一遍：首页生成 → 切「历史」看到记录 → 切「我的」点登录拿头像昵称。

- [ ] **Step 6: 提交收尾**
```bash
git add miniprogram/pages/profile
git commit -m "feat: 我的页 + 阶段1联调完成"
```

**验证：** 三个 tab 都正常；生成→历史→登录全闭环跑通。阶段 1 完成 🎉

---

## 阶段 1 完成后

- 你得到一个**能用的完整小程序**：生成今日人设 + 查看历史 + 微信头像昵称。
- 已练到云开发的：**云函数、云函数调 AI、云数据库读写、`_openid` 数据隔离**。
- 下一步可进入**阶段 2（分享卡片）**，届时我再出一份计划。

## 常见问题排查

- **云函数返回 `AI_ERR`/`PARSE_ERR`**：先在控制台测试函数看 `raw`；若是格式问题，按你 AI 接口的真实返回调整 `callAI`/`parseAIJson`。
- **历史页拿不到数据**：确认 `records` 集合权限是「仅创建者可读写」，且当前小程序账号和生成时一致。
- **`fetch is not defined`**：云函数运行时必须选 **Node.js 18+**；不行则把 `fetch` 换成 `axios`（在 `package.json` 加依赖，`require('axios')`）。
