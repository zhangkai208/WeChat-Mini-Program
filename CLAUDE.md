# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

「今日人设」（today-persona）——微信小程序 + 腾讯云开发（CloudBase）练手项目。用户输入名字（可选星座、心情），云函数调 AI 生成「今日人设 + 运势 + 宜忌」，支持历史记录、AI 生图海报。个人学习项目，只发体验版（个人主体的 AI 小程序过不了正式版审核），明确不做：后台管理、社交关系、付费、自建服务器。

## 开发与部署工作流（无构建/测试命令）

本项目**没有 npm scripts、没有 lint、没有自动化测试**。所有开发、部署、验证都在**微信开发者工具**中进行：

- **运行小程序**：开发者工具打开项目根目录，在模拟器中操作验证。
- **部署云函数**：右键 `cloudfunctions/<函数名>` → 「上传并部署：云端安装依赖」。本地改完代码不部署不生效；改了 package.json 必须选"云端安装依赖"。
- **测试云函数**：云开发控制台 → 云函数 → 测试，传 JSON 参数看返回。
- **验证约定**：每个任务以「开发者工具中操作 + 观察预期效果」为验收，不写单测。
- **提交约定**：每完成一个任务就 commit；提交信息用中文，前缀 `feat:` / `fix:` / `doc:` / `refactor:` / `chore:`。

环境相关：

- 云开发环境 ID `zk-d2gcfqw9f402f9607`（6 个月免费试用环境），硬编码在**三处**：`miniprogram/app.js` 的 `wx.cloud.init` 和两个云函数的 `tcb.init`。换环境要同步改。
- 云函数绑定环境：在 `cloudfunctions/` **父目录**上右键选环境，不是在单个函数目录上操作。
- 云函数超时：控制台默认 3 秒，调 AI 必须在控制台调大（文本生成 30s；生图函数的 tcb init timeout 已设 150s）。
- 真机调试：下载生图背景走普通 `wx.downloadFile`，需在小程序后台配置 downloadFile 合法域名（混元 COS 域名，见 docs/plans/2026-07-18-海报云存储.md）。

## 架构

```
miniprogram/            原生小程序（WXML/WXSS/JS），无框架、无 npm 依赖
  pages/home            生成页：本地登录 → 调 generatePersona → 展示卡片 → 生成海报
  pages/history         历史页：前端直接读 records 集合，skip/limit 分页（单次上限 20 条）
  pages/profile         我的页：本地登录态展示/退出
cloudfunctions/         每个函数独立目录 + package.json，Node.js 16 运行时（无全局 fetch）
  generatePersona       取 openid → 当天查重 → 拼 prompt → 调 AI(hy3) → 容错解析 JSON → 写 records → 返回（带 _id）
  genPosterImage        按 action 分派：getToday（探 posterFileID 缓存，未命中调混元生图返 24h 有效 url）；save（回写 posterFileID）
数据库 records 集合     权限「仅创建者可读写」，按 _openid 隔离
云存储 posters/{recordId}.png   权限「所有用户可读，仅创建者可写」
```

### 云函数双 SDK 模式（两个函数一致）

- `wx-server-sdk`：`cloud.getWXContext()` 取调用者 OPENID + 操作云数据库（小程序场景特有，node-sdk 没有）。
- `@cloudbase/node-sdk`：调 AI——`app.ai().createModel('cloudbase')` 生成文本、`createImageModel('hunyuan-image')` 生图。走环境鉴权，**不需要 AI_URL/AI_KEY 环境变量**（早期 HTTP 调网关的方式已弃用）。

### 云函数返回约定

统一返回 `{ code, msg?, data? }`，不向前端抛异常。code 取值：`OK` / `CACHED` / `DUP_TODAY`（当天已生成，data 带已有结果）/ `PARAM_ERR` / `AI_ERR` / `PARSE_ERR` / `NOT_FOUND`。前端按 code 分支处理。

### 海报链路（home.js 的 onGenPoster）

探缓存（CACHED 直接预览）→ 生图拿 url（**仅 24h 有效，须立即下载**）→ `wx.downloadFile`（返回 downloadTask，不走 promise 化，要手动包 Promise）→ 离屏 Canvas 2D 合成（`createImage` 只吃本地路径；文字先 strokeText 描边再 fillText 保证浅色背景可读）→ `wx.cloud.uploadFile` 到 `posters/{recordId}.png`（同名覆盖）→ save 回写 fileID（best-effort，失败只 warn 不阻断）→ `wx.previewImage`（原生支持 cloud:// fileID，自带保存到相册）。

## 关键约束与已踩的坑（改代码前必读）

- **_openid 必须显式写入**：云函数以管理员身份执行，`db.add` **不会**自动写 `_openid`；必须从 `cloud.getWXContext()` 取 OPENID 显式写进 data，否则「仅创建者可读写」权限下前端读不到该记录。
- **_openid 安全红线**：openid 只能服务端自取，**绝不信任前端传入**；按 recordId 查/改记录一律 `where({ _id, _openid })` 双校验，防伪造他人 recordId。
- **AI 调用必须在云函数内**：禁止小程序前端直接调 AI（凭证暴露、额度被盗用）。
- **时区**：云函数默认 UTC，日期一律 `toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })`；"一天一次"查重依赖这个 date 字符串。
- **一天一次**：generatePersona 按 `{ _openid, date }` 查重返回 DUP_TODAY；查重本身失败不阻塞生成（容错放行）。
- **AI 返回解析**：`parseAIJson` 三步容错（去 ``` 围栏 → 截取 `{...}` → JSON.parse）。改 prompt 时保持"严格只返回 JSON、不要 markdown"的约束。
- **登录是纯本地的**：头像（chooseAvatar 临时路径）+ 昵称只存 `wx.setStorageSync('userInfo')`，**故意不上云**（避免与微信头像不同步）；数据隔离靠 _openid，与此登录态无关。`wx.getUserProfile` 已不可用（2022.10 后只返回灰头像"微信用户"），必须用 `button open-type="chooseAvatar"` + `input type="nickname"`。

更多踩坑详录（环境换绑、部署报错、404 路径、超时等 10 个坑）见 [docs/notes/2026-07-17-开发笔记.md](docs/notes/2026-07-17-开发笔记.md)，遇到部署/权限/AI 调用问题先查它。

## 安全红线

- 密钥只能放云函数环境变量（当前架构走 SDK 环境鉴权，已无需 AI_KEY）；禁止硬编码、写入日志、提交 git、在对话中发送。
- `project.private.config.json` 已 gitignore，不要提交。
- 数据库集合权限保持「仅创建者可读写」，云存储保持「所有用户可读，仅创建者可写」，不要放宽。

## 文档约定

- `docs/specs/` 设计文档；`docs/plans/` 带 checkbox 的分任务实施计划（按任务执行、每任务一 commit）；`docs/notes/` 开发笔记/复盘。文件名格式 `YYYY-MM-DD-标题.md`。
