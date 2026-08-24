# FormatForge — 本地离线格式转换工具

> **仅供个人使用，禁止商用盈利行为**

**在线体验（网页端）**：🔗 https://formatforge.asia （备用：https://alinyu330.github.io/Formatforge ）

FormatForge 是一款在浏览器中 **完全本地运行、无需上传服务器** 的多格式转换工具。它把音频、视频、图片、表格、办公文档的格式互转，以及 QQ 音乐 / 网易云 / 酷狗等主流平台的加密音频解密，全部搬到本地 WebAssembly 引擎中完成，兼顾速度、隐私与跨平台体验（Web / Android / iOS 均可作为 PWA 独立应用安装使用）。

> 📖 详细使用说明（访问域名 / 各设备用法 / 各格式可转换目标）：
> - **在线阅读（手机 / 电脑浏览器直接打开）**：[使用说明.html](https://formatforge.asia/Formatforge/使用说明.html)
> - **PDF 版（阅读器打开 / 打印）**：[使用说明.pdf](https://formatforge.asia/Formatforge/使用说明.pdf) —— 手机浏览器打开后可「分享 → 存储到文件」保存
> - 源文件：[使用说明.md](./使用说明.md)

---

## 安装使用

### PC 端（Windows / macOS / Linux）

1. **Windows 客户端（推荐，直接下载）**：👉 [点击下载 FormatForge-Setup-1.3.3.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.3.exe?v=20260825v22)

   可复制链接（国内 CDN 加速）：

   ```
   https://dl.formatforge.asia/FormatForge-Setup-1.3.3.exe?v=20260825v22
   ```

   备用链接（GitHub）：

   ```
   https://github.com/Alinyu330/Formatforge/releases/download/backup-20260825-v22/FormatForge-Setup-1.3.3.exe
   ```

   > v21 起客户端支持**应用内更新**：启动自动检查新版本（也可在首页点「检查更新」），是否更新完全由你决定；下载显示进度，可立即重启安装或退出时自动安装。v22 起客户端使用说明改为优先加载在线版，文档更新无需重装客户端。v20 及更早版本需手动下载安装本次更新。

   **安装时若弹出蓝色窗口「Windows 已保护你的电脑」**（SmartScreen 提示），这是 Windows 对**未签名软件**的标准提示，并非病毒或文件损坏。处理方式：
   1. 点击窗口上的 **「更多信息」**
   2. 再点击 **「仍要运行」**
   3. 弹出确认框时选择 **「是」**，即可正常安装
   4. 若安装完成仍提示无法运行，请在开始菜单找到 FormatForge 图标右键 →「以管理员身份运行」

   下载后双击安装即可；首次启动为窗口化，可最大化 / 还原，内置原生 FFmpeg 引擎
   > 提示：所有链接都打不开时，可用下方 PWA 方式安装（功能一致）
2. 或使用 **Chrome** / **Edge** 浏览器打开应用网址，点击地址栏右侧的 **安装图标** (⊕) 安装为 PWA 桌面应用
3. 安装后可在桌面/开始菜单直接启动，完全离线运行

### Android 端

1. **直接下载安装客户端（APK，直接下载，国内推荐）**：👉 [点击下载 FormatForge-v22.apk](https://formatforge.asia/Formatforge/FormatForge-v22.apk)

   可复制链接（国内主链接，加载快）：

   ```
   https://formatforge.asia/Formatforge/FormatForge-v22.apk
   ```

   备用链接（GitHub，国内网络可能无法访问）：

   ```
   https://github.com/Alinyu330/Formatforge/releases/download/backup-20260825-v22/FormatForge-v22.apk
   ```

   手机直接点击下载；下载后点击安装，需允许「安装未知来源应用」；同签名版本可直接覆盖安装升级
   > v21 起客户端支持**应用内更新**：启动自动检查新版本，确认后自动下载并唤起系统安装器，是否安装由你确认。v22 起客户端使用说明改为优先加载在线版，文档更新无需重装客户端。v20 及更早版本需手动下载安装本次更新。
   - **旧版本备用**：[v20](https://formatforge.asia/Formatforge/FormatForge-v20.apk) · [v19](https://formatforge.asia/Formatforge/FormatForge-v19.apk) · [v18](https://formatforge.asia/Formatforge/FormatForge-v18.apk) · [v16.1](https://formatforge.asia/Formatforge/FormatForge-v16.1.apk)（也可在应用内「历史版本」页面查看全部版本并下载）
2. 或使用 **Chrome** 浏览器打开应用网址 → 点击右上角菜单 → **"添加到主屏幕"** / **"安装应用"**
3. 安装后主屏幕出现 FormatForge 图标，点即打开

### iOS 端（iPhone / iPad）

> 目前 **无可直接下载的 IPA 安装包**（Windows 环境无法完成 Apple 签名）。可选方式如下：

1. **PWA（推荐，无需安装包）**：用 **Safari** 浏览器打开应用网址 → 点击底部 **分享按钮** → **"添加到主屏幕"** 即可像 App 一样使用

   应用网址（可复制）：

   ```
   https://formatforge.asia
   ```

2. **原生 App**：仓库已提供 Capacitor/Xcode 工程（`ios/` 目录），需在 **macOS** 上用 Xcode 打开完成签名与归档，以生成 IPA 安装包

---

## 功能一览

| 模块 | 功能 | 支持格式 |
|------|------|---------|
| **音频转换** | 格式互转 + 加密格式解密 | MP3、FLAC、WAV、AAC、OGG、M4A、WMA 等 |
|  | QQ音乐解密 | QMC0/QMC3/QMC4/MFLAC/MGG 等 |
|  | 网易云解密 | NCM |
|  | 酷狗解密 | KGM/KGMA/KWM、KGG |
| **视频转换** | 格式互转 + 速度/质量/分辨率调节 | MP4、MKV、WebM、MOV、AVI、FLV、WMV、MPEG、TS、3GP、OGV 等 |
| **表格转换** | 电子表格格式互转 | XLSX、CSV、ODS、HTML 等 |
| **图片转换** | 图片格式互转 + 尺寸/质量/旋转 | PNG、JPEG、WebP、BMP、ICO、TIFF 等 |
| **文档转换** | 办公文档提取 | DOCX、PPTX → TXT/HTML/PDF |

### 核心特性

- **完全离线** — 所有处理在浏览器本地完成，文件不上传服务器
- **多任务批量** — 支持一文件转多格式，多文件同时转，单文件可全选或点选目标格式
- **实时预览** — 右侧面板预览源文件与转换结果（音频播放/图片查看/表格渲染/文档阅读/PDF 分页）
- **图片处理** — 支持多图合并为单个 PDF，统一页面方向 / 边距 / 尺寸，无需后端
- **任务管理** — 拖拽、输入序号、置顶三种方式调整排序，支持批量重命名与批量指定格式
- **转换提速** — 转换期间不解锁、持续接收新任务；非媒体任务并行处理
- **跨平台** — PC/Android/iOS 均可安装为独立 PWA 应用
- **拖拽上传** — 支持拖拽多文件和点击选择两种方式

---

## 技术架构

```
FormatForge/
├── src/
│   ├── components/         # UI 组件
│   │   ├── ConvertLayout   # 双栏布局（主区域 + 预览面板）
│   │   ├── ConvertQueue    # 转换任务队列
│   │   ├── PreviewPanel    # 右侧实时预览面板
│   │   ├── FormatMultiSelector  # 多格式选择器
│   │   ├── FileUpload      # 拖拽上传组件
│   │   ├── AudioOptions    # 音频参数（比特率/采样率）
│   │   └── ImageOptions    # 图片参数（质量/尺寸）
│   ├── pages/              # 页面
│   │   ├── Home            # 首页功能导航
│   │   ├── AudioConvert    # 音频转换页
│   │   ├── SheetConvert    # 表格转换页
│   │   ├── ImageConvert    # 图片转换页
│   │   └── DocConvert      # 文档转换页
│   ├── store/              # Zustand 状态管理
│   │   └── convertStore    # 转换队列与任务管理
│   ├── utils/              # 核心转换引擎
│   │   ├── audio           # FFmpeg.wasm 音频转换
│   │   ├── qmc             # QQ音乐 QMC/MFLAC 解密
│   │   ├── ncm             # 网易云 NCM 解密
│   │   ├── kgm             # 酷狗 KGM 解密
│   │   ├── sheet           # SheetJS 表格转换
│   │   ├── image           # Canvas API 图片转换
│   │   ├── document        # Mammoth.js 文档转换
│   │   └── format          # 格式检测与工具函数
│   └── types/              # TypeScript 类型定义
├── public/                 # 静态资源
├── index.html              # HTML 入口（含 iOS PWA 配置）
├── vite.config.ts          # Vite + PWA 插件配置
└── package.json            # 项目依赖
```

### 技术栈

- **React 18** + **TypeScript** + **Vite 6**
- **TailwindCSS 3** — 深色科技风 UI
- **Zustand** — 轻量级状态管理
- **FFmpeg.wasm** — WebAssembly 音频编解码
- **SheetJS** — 表格格式转换
- **Mammoth.js** — DOCX 文档转换
- **JSZip** — PPTX 解析与批量打包下载
- **vite-plugin-pwa** — PWA 离线支持 + Service Worker

### 加密格式解密原理

- **QMC**（QQ音乐）：静态密钥 XOR 解密
- **NCM**（网易云音乐）：AES-128-ECB + RC4 流解密
- **KGM**（酷狗音乐）：VPR 表驱动 XOR 解密

所有解密算法在浏览器纯 JavaScript 执行，全程离线。

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 版本历史

> 版本按发布时间从新到旧排列，前行为最近发布的功能与解决的问题。
> 也可在网页端首页点击「历史版本」查看全部版本并下载安装包。

### v22 — 客户端使用说明实时更新 + 返回功能
- **新增**：客户端内「使用说明」改为优先加载在线版——内容随网页部署自动更新，今后说明文档更新无需重新安装客户端；离线时自动回退应用内置副本
- **新增**：使用说明页左上角「← 返回」按钮——新窗口打开时点击自动关闭并回到应用，直接在浏览器打开时点击跳转应用主页
- **修复**：客户端内使用说明内容停留在打包时版本、不随网页更新的问题

> 安装包：[FormatForge-Setup-1.3.3.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.3.exe?v=20260825v22)（Windows）· [FormatForge-v22.apk](https://formatforge.asia/Formatforge/FormatForge-v22.apk)（Android）

### v21 — 客户端应用内更新
- **新增**：Windows 客户端应用内一键更新——启动自动检查新版本（更新源 R2 `dl.formatforge.asia/update/`，国内直连），弹窗展示更新日志，「立即更新」/「暂不更新」完全由你决定；下载显示实时进度，支持 blockmap 差量下载（更快更省流量）；可立即重启安装或退出时自动安装
- **新增**：Android 客户端应用内更新——下载新版 APK 显示进度，完成后唤起系统安装器，是否安装由你确认
- **新增**：首页「检查更新」按钮（仅原生客户端显示）

> 安装包：[FormatForge-Setup-1.3.2.exe](https://github.com/Alinyu330/Formatforge/releases/download/backup-20260825-v21/FormatForge-Setup-1.3.2.exe)（Windows）· [FormatForge-v21.apk](https://formatforge.asia/Formatforge/FormatForge-v21.apk)（Android）

### v20 — 移动端保存稳定性 + 站点导航升级
- **修复**：Android 客户端保存转换结果时卡死闪退、文件无法保存的问题——旧方案把整个文件转成一个 base64 大字符串跨桥传输，内存峰值约为文件大小 3 倍以上，大文件直接把 WebView 顶到 OOM；现改为分块传输协议（512KB/块，FileReader 原生编码 + 原生端临时文件追加落盘），内存峰值恒定在 512KB
- **新增**：首页「历史版本」页面——查看全部历史版本更新记录，并直接下载对应版本安装包（EXE / APK）
- **新增**：首页「下载客户端」按钮——按当前设备自动下载最新版安装包（Android → APK、PC → Windows EXE、iOS → 引导添加到主屏幕）
- **新增**：首页「使用说明」入口——新标签页打开完整使用说明（在线 HTML，支持下载 PDF）

> 安装包：[FormatForge-Setup-1.3.1.exe](https://dl.formatforge.asia/FormatForge-Setup-1.3.1.exe?v=20260824v20)（Windows）· [FormatForge-v20.apk](https://formatforge.asia/Formatforge/FormatForge-v20.apk)（Android）

### v19 — 移动端下载修复 + 预览箭头切换 + 界面细节优化
- **修复**：移动端转换结果「单独下载」点击无响应、「打包下载全部」无法下载——Android 客户端经原生插件写入系统 Download 目录（Android 10+ 免权限），手机浏览器优先 Web Share 系统保存面板，桌面端保持浏览器下载
- **修复**：从电脑端复制 KGMusicV3.db 到手机无法粘贴使用——密钥文本框支持直接粘贴 / 拖拽 .db 文件导入，并提供两种移动端导入指引
- **修复**：首页主题切换（背景色）按钮与页面对应元素偏离——改为与顶部徽章同行居中，桌面 / 移动端中心线偏差均为 0px
- **优化**：转换结果行内「预览 / 下载」按钮移动端触控区域增大、图标显式居中
- **新增**：预览面板左右箭头切换已完成结果（支持键盘 ←/→，显示当前序号/总数）
- **新增**：移动端上传 MGG2/MFLAC0 等新版 QQ 音乐加密格式时给出明确指引（所需 Cookie 凭证只能 PC 端获取，引导 PC 解密后传输）

> 安装包：[FormatForge-Setup-1.3.0.exe](https://github.com/Alinyu330/Formatforge/releases/download/backup-20260822-v19/FormatForge.Setup.1.3.0.exe)（Windows）· [FormatForge-v19.apk](https://formatforge.asia/Formatforge/FormatForge-v19.apk)（Android）

### v18 — 转换稳定性修复 + KGG 跨端密钥迁移 + 三端安装包
- **修复**：偶现「开始转换」按钮无响应（PC / 移动端 / 客户端均受影响）——核心原因是 FFmpeg WASM 引擎失败或超时后 Worker 未真正终止，成为僵尸引擎导致后续任务卡死；现失败/超时后主动 terminate 并清理状态
- **修复**：FFmpeg progress/log 监听器随每次转换累积，改为实例级单次监听
- **修复**：移除转换按钮的 onTouchEnd 触摸 hack，统一使用标准 click，避免移动端 touchend 后合成 click 重复触发
- **修复**：KGMusicV3.db 在 PC 复制后移动端无法粘贴使用——导出增加 format/version 包装，导入容错支持 BOM、Markdown、新旧格式；剪贴板失败回退 execCommand
- **新增**：Windows 客户端安装包（内置原生 ffmpeg.exe，默认窗口化、可最大化/还原）
- **新增**：Android APK、iOS Capacitor/Xcode 工程交付

> 安装包：[FormatForge-Setup-1.2.0.exe](https://github.com/Alinyu330/Formatforge/releases/download/backup-20260822-v18/FormatForge-Setup-1.2.0.exe)（Windows）· [FormatForge-v18.apk](https://formatforge.asia/Formatforge/FormatForge-v18.apk)（Android）

### v17 — 移动端稳定性与 PWA 自动更新
- **修复**：修复移动端转换按钮在部分旧缓存环境中显示无响应的问题，所有转换页面统一使用 `type="button"` 与触摸事件处理
- **修复**：确认并解决多文件上传列表显示不完整的问题；上传多文件时任务队列保留全部文件
- **优化**：转换按钮在未选择目标格式时显示「请先选择目标格式」，避免出现令人困惑的「开始转换 (0)」
- **优化**：新增 Service Worker 接管刷新机制；新版本部署后自动刷新旧页面，页面加载后立即检查更新，并每小时后台检查一次，避免长期运行旧缓存代码
- **验证**：完成移动端触摸仿真、多文件上传、转换启动和 Service Worker 自动更新端到端验证

### v16 — 音频视频转换修复 + 手机端 KGG 解密
- **修复**：音频/视频格式转换失败——Electron 客户端原生 FFmpeg 桥接检测失败导致回退到 WASM 后加载超时；现优先通过 Capacitor 平台接口识别环境，并把「存在 electronFFmpeg 桥接」直接判定为 Electron 客户端，恢复原生转换
- **新增**：手机端 KGG（酷狗新版加密）解密——新增 `KugouNative` 原生插件，自动检测 Root 权限并读取本机酷狗客户端密钥库（KGMusicV3.db）
- **新增**：Root 设备可在音频选项中一键「自动读取密钥库」完成 KGG 等酷狗加密文件解密；未 Root 设备自动提示并引导经「手机端粘贴导入密钥」粘贴电脑端导出的密钥文本

> 安装包：[FormatForge-v16.1.apk](https://formatforge.asia/Formatforge/FormatForge-v16.1.apk)（Android，v16.1 为 v16 的启动修复版）

### v15 — WMA / TIFF 预览解码 + 安卓端转换按钮修复
- **新增**：WMA 音频预览——浏览器无法原生解码 WMA，现通过 FFmpeg WASM 实时转码为 WAV 播放
- **新增**：TIFF 图片预览——浏览器无法原生显示 TIFF，现通过 FFmpeg WASM 实时转码为 PNG 显示
- **修复**：安卓端网页「开始转换」按钮点击无响应——为转换按钮补充 `type="button"` 与触摸事件处理，兼容 Android WebView 触摸交互

### v14 — 视频格式预览与转换修复
- **修复**：FLV、AVI、WMV、MPEG、MPG、TS 格式在网页端和客户端无法预览播放的问题
- **修复**：GIF 被误识别为视频的问题，现正确作为图片预览
- **修复**：WebM、3GP、OGV 转换后大小为 0B 无法播放的问题
- **优化**：统一 Web / Android / Electron 三平台视频编解码器配置，确保格式支持一致

### v13 — QQ 音乐解密代理国内可达
- **修复**：QQ 音乐解密代理在国内不可达的问题——代理由 Cloudflare `*.workers.dev`（国内被墙）切换为自定义域名 `qq.formatforge.asia`
- **新增**：Worker 部署配置 `worker/wrangler.toml`（自定义域名路由）

### v12 — 修复生产环境 QQ 音乐解密
- **修复**：修复生产环境（网页端）QQ 音乐加密音频（MFLAC/QMC 等）解密失败问题——原直连 QQ 音乐接口被浏览器跨域（CORS）拦截，现改经 Cloudflare Worker 代理转发

### v11 — 图片旋转预览 + PDF 统一尺寸
- **新增**：图片旋转后可即时预览旋转效果
- **新增**：多张图片合并为一个 PDF 时，可一键"统一尺寸"，让所有页面尺寸一致
- **修复**：合并 PDF 时不同尺寸图片导致页面参差不齐的问题

### v10 — 数字排序
- **新增**：在文件队列中直接输入序号即可调整文件排序
- 与置顶功能协同：置顶文件仅在置顶区内排序，非置顶文件仅在非置顶区内排序

### v9 — 置顶 + 图片旋转
- **新增**：文件置顶功能，支持置顶区顺序管理（再次点击置顶可提到最前）
- **新增**：图片支持顺时针 / 逆时针旋转 90°，旋转应用于转换输出

### v8 — 拖拽排序
- **新增**：文件支持拖拽调整顺序，解决上传顺序不对时需重新上传的问题

### v7 — 源文件预览
- **新增**：刚上传的文件可直接预览（图片 / 音频 / 视频 / PDF / 表格 / 文本 / HTML）

### v6 — 转换提速 + 过程解锁
- **新增**：转换期间不再锁定"转换"按钮，可继续添加文件并勾选格式
- **优化**：提升多文件同时转换速度（媒体串行、非媒体并行）

### v5 — 视频转换精细化
- **新增**：视频转换提供速度（preset）、质量（CRF）、分辨率（原画 / 1080p / 720p / 480p）选项

### v4 — 视频转换提速
- **优化**：切换更快的 FFmpeg 编码器预设，显著提升视频格式转换速度

### v3 — 批量操作 + 重命名
- **新增**：所有转换功能支持文件重命名
- **新增**：批量场景下可全选指定格式，也可分别点选各自的目标格式

### v2 — 多图合并 PDF + PDF 预览
- **新增**：多张图片合并为一个 PDF，支持统一页面方向与边距配置
- **新增**：PDF 转换结果支持分页预览

### v1 — 基础版本
- **新增**：音频 / 视频 / 图片 / 表格 / 文档格式互转
- **新增**：QQ 音乐（QMC/MFLAC）、网易云（NCM）、酷狗（KGM/KGG）加密音频解密
- **新增**：PWA 支持，PC / Android / iOS 均可安装独立使用

---

## 致谢与使用说明

FormatForge 从最初"能转几个音频格式"的小工具，逐步成长为覆盖音视频、图片、表格、文档与加密音频的本地全能转换器。它坚持 **隐私优先**：所有文件在本机处理、永不离开浏览器，这也是它区别于在线转换网站的最大价值。

项目仅用于个人学习与日常文件处理，请合理使用解密功能，尊重各平台的版权与用户协议，不要用于任何商业或侵权目的。

---

## 许可证

本项目仅供个人学习与非商业使用。禁止用于任何商业盈利目的。
