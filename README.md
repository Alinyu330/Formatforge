# FormatForge — 本地离线格式转换工具

> **仅供个人使用，禁止商用盈利行为**

**在线体验（网页端）**：🔗 https://formatforge.asia （备用：https://alinyu330.github.io/Formatforge ）

FormatForge 是一款在浏览器中 **完全本地运行、无需上传服务器** 的多格式转换工具。它把音频、视频、图片、表格、办公文档的格式互转，以及 QQ 音乐 / 网易云 / 酷狗等主流平台的加密音频解密，全部搬到本地 WebAssembly 引擎中完成，兼顾速度、隐私与跨平台体验（Web / Android / iOS 均可作为 PWA 独立应用安装使用）。

> 📖 详细使用说明（访问域名 / 各设备用法 / 各格式可转换目标）见 **[使用说明.md](./使用说明.md)**

---

## 安装使用

### PC 端（Windows / macOS / Linux）

1. **Windows 客户端（推荐，直接下载）**：👉 [点击下载 FormatForge-Setup-1.2.0.exe](https://github.com/Alinyu330/Formatforge/releases/download/backup-20260822-v18/FormatForge-Setup-1.2.0.exe)

   可复制链接：

   ```
   https://github.com/Alinyu330/Formatforge/releases/download/backup-20260822-v18/FormatForge-Setup-1.2.0.exe
   ```

   下载后双击安装即可；首次启动为窗口化，可最大化 / 还原，内置原生 FFmpeg 引擎
   > 提示：安装包托管在 GitHub，国内网络可能无法访问；打不开时可用下方 PWA 方式安装（功能一致），或稍后重试
2. 或使用 **Chrome** / **Edge** 浏览器打开应用网址，点击地址栏右侧的 **安装图标** (⊕) 安装为 PWA 桌面应用
3. 安装后可在桌面/开始菜单直接启动，完全离线运行

### Android 端

1. **直接下载安装客户端（APK，直接下载，国内推荐）**：👉 [点击下载 FormatForge-v18.apk](https://formatforge.asia/Formatforge/FormatForge-v18.apk)

   可复制链接（国内主链接，加载快）：

   ```
   https://formatforge.asia/Formatforge/FormatForge-v18.apk
   ```

   备用链接（GitHub，国内网络可能无法访问）：

   ```
   https://github.com/Alinyu330/Formatforge/releases/download/backup-20260822-v18/FormatForge-v18.apk
   ```

   手机直接点击下载；下载后点击安装，需允许「安装未知来源应用」；若已装旧版请先卸载再安装
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

### v18 — 转换稳定性修复 + KGG 跨端密钥迁移 + 三端安装包
- **修复**：偶现「开始转换」按钮无响应（PC / 移动端 / 客户端均受影响）——核心原因是 FFmpeg WASM 引擎失败或超时后 Worker 未真正终止，成为僵尸引擎导致后续任务卡死；现失败/超时后主动 terminate 并清理状态
- **修复**：FFmpeg progress/log 监听器随每次转换累积，改为实例级单次监听
- **修复**：移除转换按钮的 onTouchEnd 触摸 hack，统一使用标准 click，避免移动端 touchend 后合成 click 重复触发
- **修复**：KGMusicV3.db 在 PC 复制后移动端无法粘贴使用——导出增加 format/version 包装，导入容错支持 BOM、Markdown、新旧格式；剪贴板失败回退 execCommand
- **新增**：Windows 客户端安装包（内置原生 ffmpeg.exe，默认窗口化、可最大化/还原）
- **新增**：Android APK、iOS Capacitor/Xcode 工程交付

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
