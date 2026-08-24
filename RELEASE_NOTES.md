# FormatForge Release Notes

> 记录 v6 – v21 版本更新内容，可直接复制到 GitHub Release。
> 版本按发布时间从新到旧排列。
> 在线体验：https://alinyu330.github.io/Formatforge

---

## v21 — 客户端应用内更新

### 新功能 🚀
- **Windows 客户端应用内一键更新**：
  - 启动后自动静默检查新版本（更新源 R2 `dl.formatforge.asia/update/`，国内直连）
  - 发现新版本弹窗展示更新日志，**「立即更新」/「暂不更新」完全由你决定**（自动检查被拒绝后本次会话不再打扰）
  - 选择更新后显示实时下载进度条；下载完成可**立即重启安装**，或选「稍后」退出应用时自动安装
  - 采用 electron-updater 标准协议，支持 blockmap 差量下载（版本间体积差异小则只下载差异部分）
- **Android 客户端应用内更新**：
  - 同样启动自动检查 + 首页「检查更新」按钮手动触发
  - 确认更新后原生线程下载 APK（实时进度），完成后唤起系统安装器，**是否安装由系统层面再次确认**
  - 新增 `REQUEST_INSTALL_PACKAGES` 权限声明；下载失败自动清理残留文件
- 首页新增「检查更新」按钮（仅原生客户端显示，Web 端 PWA 仍由 Service Worker 自动更新）
- 更新元数据（版本号 + 更新日志）集中托管于 `update/version.json`，后续发版只需更新该文件与安装包

### 技术说明
- 更新链路：`latest.yml`（electron-updater 协议）+ `version.json`（统一元数据）+ 安装包均托管 R2，dl.formatforge.asia Worker 分发（支持 Range 断点续传、no-store 防旧缓存）
- Windows 更新校验：SHA512 与 latest.yml 一致性已验证
- v20 及更早版本不含更新器，**需手动安装一次 v21**；从 v21 起即可应用内更新

> Backup tag: `backup-20260825-v21`
> 安装包：[FormatForge-Setup-1.3.2.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.2.exe?v=20260825v21)（Windows）· [FormatForge-v21.apk](https://formatforge.asia/Formatforge/FormatForge-v21.apk)（Android）

---

## v20 — 移动端保存稳定性 + 站点导航升级

### 问题修复 🐛
- 修复 Android 客户端保存转换结果时**卡死闪退、文件无法保存**的问题：
  - 根因：旧方案把整个文件转成一个 base64 大字符串跨 JS→Java 桥传输，内存峰值约为文件大小的 3 倍以上（原始 bytes + UTF-16 拼接串 + base64 串，原生端再解码一份），大文件直接把 WebView 顶到 OOM
  - 修复：改为**分块传输协议**——JS 端按 512KB 分块（FileReader.readAsDataURL 原生编码，无中间大字符串），原生端 `beginSave`/`appendChunk`/`finishSave` 三步写入缓存临时文件后一次性落盘到系统 Download 目录；内存峰值恒定在 512KB，与文件大小无关
  - 健壮性：任一分块失败自动取消会话并清理临时文件；Android 9 及以下的存储权限提前到会话创建阶段申请，避免数据写完才弹权限

### 新功能 🚀
- 首页新增「**历史版本**」页面（/history）：查看 v1–v20 全部版本更新记录，可直接下载对应版本安装包（Windows EXE / Android APK），无安装包的历史版本标注说明
- 首页新增「**下载客户端**」按钮：按当前设备自动分发最新版安装包——Android 下载 APK、PC 下载 Windows EXE、iOS 弹窗引导「Safari → 添加到主屏幕」使用 PWA
- 首页新增「**使用说明**」入口：新标签页打开在线使用说明（HTML 版，另附可下载 PDF）

### 验证
- tsc -b 编译通过
- 分块协议在 Android 10+（MediaStore）与 Android 9-（公共目录）双路径实现
- 历史版本页安装包链接与实际部署资产逐一核对（v18 EXE 资产名带连字符、v19 带点号，均已按实际名称链接）

> Backup tag: `backup-20260824-v20`
> 安装包：[FormatForge-Setup-1.3.1.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.1.exe?v=20260824v20)（Windows）· [FormatForge-v20.apk](https://formatforge.asia/Formatforge/FormatForge-v20.apk)（Android）

---

## v19 — 移动端下载修复 + 预览箭头切换 + 界面细节优化

### 问题修复 🐛
- 修复移动端转换结果「单独下载」点击无响应、「打包下载全部」无法下载的问题：Android WebView 内 `<a download>` 不可靠，新增跨平台保存管线 `saveBlob`——Android 客户端经原生插件（SaveFilePlugin）写入系统 Download 目录（Android 10+ 走 MediaStore 免权限、自动 Toast 提示保存路径，Android 9 及以下自动申请存储权限）；手机浏览器优先 Web Share API 调起系统「保存到文件 / 分享」面板；桌面端保持 `<a download>` 下载
- 修复从电脑端复制 KGMusicV3.db 到手机无法粘贴使用的问题：密钥文本框现支持**直接粘贴 / 拖拽 .db 文件**导入（自动识别剪贴板中的文件），并提供「发送 .db 文件到手机再选择导入」与「复制密钥文本到手机粘贴导入」两种移动端操作指引
- 修复首页主题切换（背景色）按钮与页面对应元素存在偏离的问题：改为与顶部徽章同行布局（flex 居中），桌面端与移动端中心线偏差均从约 21px / 2px 修正为 **0px**，且不再受系统字体缩放影响
- 优化转换结果行内「预览 / 下载」小按钮：移动端触控区域从 20px 增大到 26px，图标在按钮内显式 flex 居中，点击更准更稳

### 新功能 🚀
- 预览面板新增**左右箭头切换**：在所有已完成的转换结果之间快速切换（含跨任务），支持键盘 ← / → 按键，面板顶部显示「当前序号 / 总数」
- 移动端上传新版 QQ 音乐加密格式（MGG2 / MFLAC0 / MFLAC2 / TKM 等 musicex 格式）时给出明确指引：说明所需凭证（QQ 音乐网页版登录 Cookie：UIN + authst 或 qqmusic_key）只能通过 PC 浏览器登录 y.qq.com 获取，移动端无法输入，引导在 PC 端解密转换后再把文件传到手机

### 验证
- 375px 移动视口与桌面视口下，主题切换按钮与徽章中心线偏差均为 0px
- 打包下载 / 单独下载均统一走 saveBlob 管线（convertStore 中 downloadItem 与 downloadAllAsZip）
- tsc -b 编译通过

> Backup tag: `backup-20260822-v19`

---

## v18 — 转换稳定性修复 + KGG 跨端密钥迁移 + 三端安装包

### 问题修复 🐛
- 修复偶现「开始转换」按钮无响应（PC 网页 / Windows 客户端 / 移动端 / Android WebView 均受影响）：核心原因是 FFmpeg WASM 引擎在转换失败或超时后 Worker 未真正终止，成为「僵尸引擎」，导致后续任务 writeFile/exec 排队卡死；现统一 FFmpeg 单例生命周期，失败/超时后主动 `terminate()` 并清理状态
- 修复 FFmpeg progress/log 监听器随每次转换累积导致的内存与状态混乱：改为实例级单次监听，通过 `activeProgressCb` 分发当前任务进度，日志最多保留 400 条
- 移除转换按钮上的 `onTouchEnd` 触摸 hack：移动端 touchend 后浏览器会再派发合成 click，导致一次触摸可能重复启动或事件状态异常；四个转换页面统一只使用标准 `click`
- 修复 KGMusicV3.db 在 PC 复制后移动端无法粘贴使用的问题：导出格式增加 `format/version` 包装；导入容错支持 UTF-8 BOM、Markdown 代码围栏、聊天软件附加说明文字、新旧两种格式；剪贴板写入失败时回退 `execCommand('copy')`，移动端支持 `readText()` 与手动粘贴

### 新功能 🚀
- Windows 客户端安装包：内置原生 `ffmpeg.exe`，转换走原生引擎；首次启动默认窗口化（1000×800），可最大化 / 还原
- Android APK 安装包（versionCode 3 / versionName 1.2）
- iOS Capacitor/Xcode 工程（已纳入版本库；Windows 无法签名 IPA，最终 IPA 需在 macOS/Xcode 完成签名归档）

### 验证
- 桌面 Chrome 真实 WAV→MP3 转换通过（15.67 KB → 33.51 KB）
- 390×844 移动视口双文件批量转换通过（两个文件均完成，输出各 33.51 KB）
- 多文件上传后任务列表保留全部文件
- Electron 安装包内置 ffmpeg.exe 已就位并验证 `ffmpeg -version`

> Commit: `678a40f`
> Backup tag: `backup-20260822-v18`

---

## v17 — 移动端稳定性与 PWA 自动更新

### 问题修复 🐛
- 修复移动端转换按钮在部分旧缓存环境中显示无响应的问题，所有转换页面统一使用 `type="button"` 与触摸事件处理
- 确认并解决多文件上传列表显示不完整的问题；上传多文件时任务队列保留全部文件

### 用户体验优化 ⚡
- 转换按钮在未选择目标格式时显示「请先选择目标格式」，避免出现令人困惑的「开始转换 (0)」
- 新增 Service Worker 接管刷新机制：新版本部署后自动刷新旧页面
- 页面加载后立即检查 Service Worker 更新，并每小时后台检查一次，避免长期运行旧缓存代码

### 验证
- 完成移动端触摸仿真、多文件上传、转换启动和 Service Worker 自动更新端到端验证

> Commit: `7f4e207`
> Backup tag: `backup-20260821-v17`

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