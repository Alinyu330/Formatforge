# FormatForge Release Notes

> 记录 v6 – v28 版本更新内容，可直接复制到 GitHub Release。
> 版本按发布时间从新到旧排列。
> 在线体验：https://alinyu330.github.io/Formatforge

---

## v28 — 三端转换与预览全面修复（OPUS/OGV/PDF/DOCX/大文件）

### 问题修复 🐛
- **修复 Windows 客户端音频转 OPUS / WEBM 失败**：FFmpeg 原生 Opus 编码器不支持 44100Hz 等采样率，现对 OPUS / WEBM 目标强制 48kHz 采样率并改用比特率模式（`-b:a`）
- **修复客户端解密 QQ 音乐加密音频时「获取 ekey 失败：直连 QQ 音乐接口被浏览器拦截」**：Windows / Android 客户端默认改走 Cloudflare 代理（qq.formatforge.asia），Electron CSP 同步放行代理域名
- **修复大文件转换时客户端闪退（双客户端）**：
  - Windows：输入 / 输出文件改走分块传输协议（临时文件 + 512KB 分块 IPC 读写），不再整文件载入渲染进程内存
  - 网页 / Android：FFmpeg WASM 改用 WORKERFS 流式挂载，文件按需读取
- **修复 WMA 无法预览、部分视频格式转换成功后无法预览的问题**：三端统一「预览解码桥」——Windows 走原生 FFmpeg 转码（ultrafast 低延迟），网页 / Android 走 WASM 转码（限 720p / 30 分钟防内存溢出），FLV / AVI / WMV / MPEG / TS 等格式预览恢复正常
- **修复 OGV 格式转换崩溃**：@ffmpeg/core 升级至 0.12.10，修复 libtheora 编码器兼容性问题
- **修复图片转 TIFF 输出为「假 TIFF」的问题**：此前 Canvas 导出的实为改扩展名的 PNG，专业软件无法识别；现改用 FFmpeg 真编码为 TIFF，TIFF 转换结果的预览也同步修复
- **修复 PDF 转换与预览在部分环境失败**：
  - `Promise.withResolvers is not a function`：pdfjs-dist v6 依赖 ES2024/ES2025 新 API，为主线程与 worker 双端注入 polyfill
  - PDF 预览 `getOrInsertComputed is not a function`：补齐 `Map.prototype.getOrInsertComputed` / `Promise.try` polyfill
- **修复 DOCX 转换报错晦涩的问题**：空文件 / 旧版 .doc 改扩展名 / 损坏文件现在给出明确中文提示（如「不是有效的 DOCX 文件……请先用 Office/WPS 另存为 DOCX 格式」），不再抛出 `End of data reached` 这类原始错误

### 性能优化 🏎️
- 移动端视频转换提速：分辨率选项真正生效（此前选择后被忽略）、x264 / libvpx 编码速度档位与缩放算法优化

### 验证
- tsc 编译（根 + Electron）与网页构建通过
- 浏览器实测：PDF 源文件预览分页渲染 ✓、PDF → PNG 转换 ✓、PNG → TIFF 转换 + TIFF 预览 ✓、伪造 DOCX 报错提示 ✓

> Backup tag: `backup-20260825-v28`
> 安装包：[FormatForge-Setup-1.3.9.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.9.exe?v=20260825v28)（Windows）· [FormatForge-v28.apk](https://formatforge.asia/Formatforge/FormatForge-v28.apk)（Android）
> v21 及以上客户端可直接在应用内更新（「检查更新」入口在首页顶部右侧）；v20 及更早版本需手动下载安装。

---

## v27 — 修复 Windows 客户端历史版本按钮 + 构建流程自动同步

### 问题修复 🐛
- **修复 Windows 客户端「历史版本」按钮仍跳转系统浏览器的问题**：
  - 根因：v26 的 Windows 安装包（1.3.7）误打包了旧版页面资源——构建时 `electron/app` 目录未同步最新 `dist` 产物（停留在 v25 代码），源码本身无缺陷，Android 客户端（同一份代码）不受影响
  - 本次重新打包后历史版本页面在应用内打开（顶部「返回首页」一键回主页），与 Android 客户端行为一致

### 工程改进 🔧
- **客户端构建流程自动同步**：`build:native` 构建完成后自动镜像 `dist` → `electron/app`（先清空再复制），从根源杜绝「功能已修复但安装包内仍是旧代码」的问题再次发生
- Android 客户端同步升级至 v27（versionCode 12，功能与 v26 一致），保持三端版本对齐

### 验证
- 打包前已校验 `electron/app/assets` 主 bundle 包含 v27 版本数据（`FormatForge-v27.apk` 链接与 `/history` 站内路由），非旧版资源
- tsc 编译与网页构建通过

> Backup tag: `backup-20260825-v27`
> 安装包：[FormatForge-Setup-1.3.8.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.8.exe?v=20260825v27)（Windows）· [FormatForge-v27.apk](https://formatforge.asia/Formatforge/FormatForge-v27.apk)（Android）
> v21 及以上客户端可直接在应用内更新（「检查更新」入口在首页顶部右侧）；v20 及更早版本需手动下载安装。

---

## v26 — 历史版本应用内打开 + 使用说明返回来源页

### 体验改进 🚀
- **客户端「历史版本」改为应用内打开（不再跳转系统浏览器）**：
  - 直接走站内 `/history` 原生页面，即时加载、离线可用
  - 顶部「返回首页」一键回到客户端主页
  - 与 v25 的「使用说明」应用内打开保持一致的交互体验
- **网页端使用说明「返回」按钮回到来源页**：
  - 点击返回后回到**打开说明时所在的页面**（如首页 / 历史版本页），不再跳转到工具主页
  - 新窗口打开时优先自动关闭窗口返回原页；关闭被拦截或直接打开时跳回来源页（来源页地址经 `from` 参数传递并做同域校验）

### 验证
- tsc 编译与 ESLint 检查通过
- 客户端历史版本应用内页面、网页端说明页返回来源页逻辑均已验证

> Backup tag: `backup-20260825-v26`
> 安装包：[FormatForge-Setup-1.3.7.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.7.exe?v=20260825v26)（Windows）· [FormatForge-v26.apk](https://formatforge.asia/Formatforge/FormatForge-v26.apk)（Android）
> v21 及以上客户端可直接在应用内更新（「检查更新」入口在首页顶部右侧）；v20 及更早版本需手动下载安装。

---

## v25 — 使用说明应用内打开 + 检查更新防误触 + 视频转换提速

### 体验改进 🚀
- **客户端「使用说明」改为应用内全屏打开（不再跳转系统浏览器）**：
  - 新增 SPA `/guide` 路由全屏视图，顶部「返回主页」一键回到客户端主页
  - 优先加载在线版文档（内容随网页部署实时更新），离线或探测失败自动回退本地打包副本，右上角标识当前来源
  - 文档内嵌时自动隐藏自带返回按钮，由外层「返回主页」栏接管；Electron CSP 增加 `frame-src` 允许内嵌在线文档
  - 网页端「使用说明」仍为新窗口打开站内文件，行为不变

### 体验调整 ⚡
- 「检查更新」按钮从首页页脚移至**首页顶部右侧**（与主题切换按钮并列）——此前与底部固定反馈邮箱距离过近，移动端易误触，现彻底分离

### 性能优化 🏎️
- **视频转换提速（网页 / Android / Windows 三端同步生效）**：
  - Android 客户端补齐 x264 编码速度档位（`-preset veryfast` + CRF 质量映射，此前走 x264 默认 medium，约快 3–4 倍）
  - WebM（libvpx）编码启用实时模式（`-deadline realtime -cpu-used 5`，此前默认 good 质量优先模式极慢，约快 5–10 倍）
  - 分辨率缩放滤镜换用 bilinear 算法（比默认 bicubic 更快，画质差异肉眼基本不可辨）

### 问题修复 🐛
- **修复网页端打开使用说明偶发黑屏**：Service Worker NavigationRoute 会劫持带查询串的 `.html` 导航为 SPA 外壳（黑色背景无内容）；denylist 正则已改为兼容 `?v=` 查询串（workbox 对 pathname+search 整体匹配），并新增 SPA 兜底路由与 sw.js 缓存穿透，三重保险彻底修复

### 验证
- tsc 编译通过，网页版构建通过
- 应用内使用说明视图（在线/本地回退、返回主页）、检查更新按钮新位置、三端视频转换参数均已验证

> Backup tag: `backup-20260825-v25`
> 安装包：[FormatForge-Setup-1.3.6.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.6.exe?v=20260825v25)（Windows）· [FormatForge-v25.apk](https://formatforge.asia/Formatforge/FormatForge-v25.apk)（Android）
> v21 及以上客户端可直接在应用内更新（「检查更新」入口在首页顶部右侧）；v20 及更早版本需手动下载安装。

---

## v24 — 客户端内容彻底在线化 + 检查更新入口调整

### 问题修复 🐛
- **彻底修复客户端「历史版本」「使用说明」仍停留旧内容的问题**：
  - 客户端内「使用说明」「历史版本」改为用**系统默认浏览器打开在线版**（Windows 经 Electron shell 域名白名单校验、Android 经原生 Intent 插件）
  - 在线页地址统一 `encodeURI` 百分号编码（兼容 Electron shell / Android Intent 解析中文路径）+ 附带 `?v=<版本号>` 版本参数，每次发版自动穿透浏览器 / CDN 缓存
  - 效果：今后历史版本信息与使用说明内容更新只需部署网页，客户端**无需重装**即可实时同步

### 体验调整 ⚡
- 「检查更新」按钮从首页导航区（历史版本 / 下载客户端 / 使用说明旁）移至**首页页脚**，与下载类按钮物理分离，避免误触

### 验证
- tsc 编译通过，网页版构建通过
- 在线版使用说明 / 历史版本链接均带 `?v=v24` 参数，中文路径已百分号编码

> Backup tag: `backup-20260825-v24`
> 安装包：[FormatForge-Setup-1.3.5.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.5.exe?v=20260825v24)（Windows）· [FormatForge-v24.apk](https://formatforge.asia/Formatforge/FormatForge-v24.apk)（Android）
> v21 及以上客户端可直接在应用内更新（「检查更新」入口在首页页脚）；v20 及更早版本需手动下载安装。

---

## v22 — 客户端使用说明实时更新 + 返回功能

### 新功能 🚀
- **客户端使用说明实时更新**：客户端内打开「使用说明」改为优先加载在线版，内容随网页部署自动更新，今后说明文档更新**无需重新安装客户端**
- **使用说明返回按钮**：说明页左上角新增「← 返回」按钮——新窗口打开时点击自动关闭并回到应用；直接在浏览器打开时点击跳转应用主页
- **离线回退**：无网络时自动回退到应用内置的说明副本，离线依然可查

### 修复 🐛
- 修复客户端内使用说明内容停留在打包时版本、不随网页更新的问题

> 安装包：[FormatForge-Setup-1.3.3.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.3.exe?v=20260825v22)（Windows）· [FormatForge-v22.apk](https://formatforge.asia/Formatforge/FormatForge-v22.apk)（Android）
> v21 客户端可直接在应用内更新到本版本；v20 及更早版本需手动下载安装。

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