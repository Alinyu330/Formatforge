# FormatForge Release Notes

> 记录 v6 – v16 版本更新内容，可直接复制到 GitHub Release。
> 版本按发布时间从新到旧排列。
> 在线体验：https://alinyu330.github.io/Formatforge

---

## v16 — 音频视频转换修复 + 手机端 KGG 解密

### 问题修复 🐛
- 修复音频/视频格式转换失败的问题：Electron 客户端原生 FFmpeg 桥接检测失败，导致回退到 WASM 后加载超时；现改为优先通过 Capacitor 平台接口识别环境，并将「存在 electronFFmpeg 桥接」直接判定为 Electron 客户端，恢复原生转换
- 修复 Android 端音频编解码参数构建冗余，统一复用 `buildAudioFormatArgs`，确保与 Web 端编解码器映射一致

### 新功能 🚀
- 手机端 KGG（酷狗新版加密）解密：新增 `KugouNative` 原生插件，自动检测设备 Root 权限并读取本机酷狗客户端的密钥库（KGMusicV3.db）
- Root 设备：在音频选项中一键「自动读取密钥库」完成 KGG/FLAC、MFLAC、MGG 等酷狗加密文件解密，无需手动导入
- 未 Root 设备：自动提示无法读取本机密钥库，引导通过「手机端粘贴导入密钥」粘贴电脑端导出的密钥文本完成解密

> Commit: `a04847c`

---

## v15 — WMA / TIFF 预览解码 + 安卓端转换按钮修复

### 新功能 🚀
- WMA 音频预览：浏览器无法原生解码 WMA，现通过 FFmpeg WASM 实时转码为 WAV 播放预览
- TIFF 图片预览：浏览器无法原生显示 TIFF，现通过 FFmpeg WASM 实时转码为 PNG 显示预览

### 问题修复 🐛
- 修复安卓端网页「开始转换」按钮点击无响应的问题：为转换按钮补充 `type="button"` 与触摸事件（`onTouchEnd`）处理，兼容 Android WebView 的触摸交互

> Commit: `85fb7bb`

---

## v14 — 视频格式预览与转换修复

### 问题修复 🐛
- 修复 FLV、AVI、WMV、MPEG、MPG、TS 格式在网页端（WASM）和客户端（Electron / Android）无法预览播放的问题
- 修复 GIF 被误识别为视频、无法预览的问题，现正确作为图片预览
- 修复 WebM、3GP、OGV 转换后输出大小为 0B 无法播放的问题：统一三平台视频/音频编解码器映射（WebM → libvpx/libopus，3GP → mpeg4/aac，OGV → libtheora/libvorbis），并移除不再适用的 VP9/H.263/strict 参数

### 性能优化 ⚡
- 统一 Web / Android / Electron 三平台视频编解码器配置，确保各平台格式支持一致

> Commit: `5ab709c`

---

## v13 — QQ 音乐解密代理国内可达

### 问题修复 🐛
- 修复 QQ 音乐解密 CORS 代理在国内不可达的问题：代理由 Cloudflare `*.workers.dev`（国内被墙）切换为自定义域名 `qq.formatforge.asia`，国内用户网页端解密恢复正常

### 新功能 🚀
- 新增 Worker 部署配置 `worker/wrangler.toml`（自定义域名路由），便于后续重部署

> Commit: `6b8eb57`

---

## v12 — 修复生产环境 QQ 音乐解密

### 问题修复 🐛
- 修复生产环境（网页端）QQ 音乐加密音频（MFLAC/QMC 等）解密失败问题：原直连 `u.y.qq.com` GetEVkey 接口被浏览器 CORS 拦截（`net::ERR_FAILED`），现改经 Cloudflare Worker 代理转发并透传 Cookie

> Commit: `5b1fb03`

---

## v11 — 图片旋转预览 + PDF 统一尺寸

### 新功能 🚀
- **图片旋转即时预览**：图片旋转后可立即预览旋转效果
- **PDF 统一尺寸**：多张图片合并为一个 PDF 时，可一键让所有页面尺寸一致

### 问题修复 🐛
- 修复合并 PDF 时不同尺寸图片导致页面参差不齐的问题

> Commit: `e2542f8`

---

## v10 — 数字排序

### 新功能 🚀
- **数字排序**：在文件队列中直接输入序号即可调整文件排序
- 与置顶功能协同：置顶文件仅在置顶区内排序，非置顶文件仅在非置顶区内排序

> Commit: `9d34710`

---

## v9 — 置顶 + 图片旋转

### 新功能 🚀
- **文件置顶**：支持置顶区顺序管理，再次点击置顶可将文件提到最前
- **图片旋转**：图片支持顺时针 / 逆时针旋转 90°，旋转应用于转换输出

> Commit: `5e0cc42`

---

## v8 — 拖拽排序

### 新功能 🚀
- **拖拽排序**：文件支持拖拽调整顺序，解决上传顺序不对时需重新上传的问题

> Commit: `e8aa2dc`

---

## v7 — 源文件预览

### 新功能 🚀
- **源文件预览**：刚上传的文件可直接预览（图片 / 音频 / 视频 / PDF / 表格 / 文本 / HTML）

> Commit: `1bfc4dc`

---

## v6 — 转换提速 + 过程解锁

### 新功能 🚀
- **转换过程解锁**：转换期间不再锁定"转换"按钮，可继续添加文件并勾选格式

### 性能优化 ⚡
- **转换提速**：提升多文件同时转换速度（媒体串行、非媒体并行）

> Commit: `2366bee`

---

## 使用说明
- 上述为 v6 – v13 的发布记录；更早版本（v1 – v5）见 [README.md](README.md#L133) 版本历史。
- 各版本 Release 标题建议遵循 `v{n}` 命名，标签为 `backup-20260820-v{n}`（如需独立版本标签，建议另建 `v{n}` tag）。