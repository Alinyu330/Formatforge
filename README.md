# FormatForge — 本地离线格式转换工具

> **仅供个人使用，禁止商用盈利行为**

---

## 安装使用

### PC 端（Windows / macOS / Linux）

1. 用 **Chrome** 或 **Edge** 浏览器打开应用网址
2. 点击地址栏右侧的 **安装图标** (⊕) 即可安装为桌面应用
3. 安装后可在桌面/开始菜单直接启动，完全离线运行

### Android 端

1. 用 **Chrome** 浏览器打开应用网址
2. 点击右上角菜单 → **"添加到主屏幕"** / **"安装应用"**
3. 安装后主屏幕出现 FormatForge 图标，点即打开

### iOS 端（iPhone / iPad）

1. 用 **Safari** 浏览器打开应用网址
2. 点击底部 **分享按钮** → **"添加到主屏幕"**
3. 命名后点击添加，主屏幕即出现应用图标

---

## 功能一览

| 模块 | 功能 | 支持格式 |
|------|------|---------|
| **音频转换** | 格式互转 + 加密格式解密 | MP3、FLAC、WAV、AAC、OGG、M4A、WMA 等 |
|  | QQ音乐解密 | QMC0/QMC3/QMC4/MFLAC/MGG 等 |
|  | 网易云解密 | NCM |
|  | 酷狗解密 | KGM/KGMA/KWM |
| **表格转换** | 电子表格格式互转 | XLSX、CSV、ODS、HTML |
| **图片转换** | 图片格式互转 + 尺寸质量调节 | PNG、JPEG、WebP、BMP、ICO、TIFF |
| **文档转换** | 办公文档提取 | DOCX、PPTX → TXT/HTML/PDF |

### 核心特性

- **完全离线** — 所有处理在浏览器本地完成，文件不上传服务器
- **多任务批量** — 支持一文件转多格式，多文件同时转，上限10并发
- **实时预览** — 右侧面板即时预览转换结果（音频播放/图片查看/表格渲染/文档阅读）
- **跨平台** — PC/Android/iOS 均可安装为独立 PWA 应用
- **拖拽上传** — 支持拖拽文件和点击选择两种方式

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

## 许可证

本项目仅供个人学习与非商业使用。禁止用于任何商业盈利目的。
