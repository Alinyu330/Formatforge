/**
 * 版本历史数据（供历史版本页面与下载按钮使用）
 *
 * 注意：
 * - 安装包链接必须与实际部署的资产名完全一致：
 *   v18 的 GitHub EXE 资产名带连字符（FormatForge-Setup-1.2.0.exe），
 *   v19 的带点号（FormatForge.Setup.1.3.0.exe）——上传时的文件名不同所致。
 * - 无安装包的历史版本（v1–v15、v17）不提供下载入口，与 README 版本历史一致。
 */

export interface VersionAsset {
  /** 下载链接 */
  url: string;
  /** 展示名，如 "Windows 安装包 (FormatForge-Setup-1.2.0.exe)" */
  label: string;
  /** 平台标识：windows / android */
  platform: 'windows' | 'android';
}

export interface VersionInfo {
  /** 版本号，如 v20 */
  version: string;
  /** 一句话主题 */
  title: string;
  /** 发布日期 */
  date: string;
  /** 更新要点（简洁条目） */
  highlights: string[];
  /** 可下载的安装包（无则空数组） */
  assets: VersionAsset[];
}

/** 站点直链前缀（public/ 下随构建部署） */
export const SITE_BASE = 'https://formatforge.asia/Formatforge';

/** GitHub Release 资产前缀 */
export const GH_RELEASE_BASE = 'https://github.com/Alinyu330/Formatforge/releases/download';

/** 最新版本安装包（下载按钮按设备分发） */
export const LATEST = {
  version: 'v24',
  apkUrl: `${SITE_BASE}/FormatForge-v24.apk`,
  exeUrl: 'https://dl.formatforge.asia/FormatForge-Setup-1.3.5.exe?v=20260825v24',
  exeLabel: 'FormatForge-Setup-1.3.5.exe',
  exeGithubUrl: `${GH_RELEASE_BASE}/backup-20260825-v24/FormatForge-Setup-1.3.5.exe`,
};

export const VERSIONS: VersionInfo[] = [
  {
    version: 'v24',
    title: '客户端内容彻底在线化 + 检查更新入口调整',
    date: '2026-08-25',
    highlights: [
      '彻底修复客户端「历史版本」「使用说明」仍停留旧内容的问题：客户端改由系统默认浏览器打开在线版（Windows 经 Electron shell、Android 经原生 Intent），链接统一编码并附带版本参数穿透浏览器 / CDN 缓存，今后内容随网页部署即时生效，无需重装客户端',
      '「检查更新」按钮移至首页页脚，与历史版本 / 下载 / 使用说明按钮分离，避免误触',
    ],
    assets: [
      { url: LATEST.exeUrl, label: 'Windows 安装包 (FormatForge-Setup-1.3.5.exe)', platform: 'windows' },
      { url: LATEST.apkUrl, label: 'Android 安装包 (FormatForge-v24.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v22',
    title: '客户端使用说明实时更新 + 返回功能',
    date: '2026-08-25',
    highlights: [
      '客户端内打开使用说明改为优先加载在线版：内容随网页部署自动更新，无需重新安装客户端',
      '使用说明新增左上角「返回」按钮：新窗口打开时点击自动关闭返回应用，直接打开时跳转主页',
      '无网络时自动回退到应用内置的说明副本，离线依然可查',
    ],
    assets: [
      { url: 'https://dl.formatforge.asia/FormatForge-Setup-1.3.3.exe?v=20260825v22', label: 'Windows 安装包 (FormatForge-Setup-1.3.3.exe)', platform: 'windows' },
      { url: `${SITE_BASE}/FormatForge-v22.apk`, label: 'Android 安装包 (FormatForge-v22.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v21',
    title: '客户端应用内更新',
    date: '2026-08-25',
    highlights: [
      '新增客户端应用内更新：启动自动检查 + 首页「检查更新」按钮，新版本弹窗由你决定是否更新',
      'Windows 客户端支持一键更新：显示更新日志与下载进度，可立即重启安装或退出时自动安装（支持差量下载）',
      'Android 客户端支持应用内更新：下载新版 APK 后唤起系统安装器，是否安装由你确认',
    ],
    assets: [
      { url: `${GH_RELEASE_BASE}/backup-20260825-v21/FormatForge-Setup-1.3.2.exe`, label: 'Windows 安装包 (FormatForge-Setup-1.3.2.exe)', platform: 'windows' },
      { url: `${SITE_BASE}/FormatForge-v21.apk`, label: 'Android 安装包 (FormatForge-v21.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v20',
    title: '移动端保存稳定性 + 站点导航升级',
    date: '2026-08-24',
    highlights: [
      '修复 Android 客户端保存转换结果时卡死闪退、文件无法保存的问题（分块传输协议，大文件内存峰值从 3 倍文件大小降至 512KB）',
      '新增「历史版本」页面：查看全部历史版本信息并下载对应安装包',
      '新增「下载客户端」按钮：按当前设备自动下载最新版安装包（Android → APK / PC → Windows EXE）',
      '新增「使用说明」入口：一键查看完整使用说明（在线 HTML / 可下载 PDF）',
    ],
    assets: [
      { url: 'https://dl.formatforge.asia/FormatForge-Setup-1.3.1.exe?v=20260824v20', label: 'Windows 安装包 (FormatForge-Setup-1.3.1.exe)', platform: 'windows' },
      { url: `${SITE_BASE}/FormatForge-v20.apk`, label: 'Android 安装包 (FormatForge-v20.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v19',
    title: '移动端下载修复 + 预览箭头切换 + 界面细节优化',
    date: '2026-08-22',
    highlights: [
      '修复移动端转换结果单独下载无响应、打包下载无法下载的问题',
      '修复从电脑端复制 KGMusicV3.db 到手机无法粘贴使用的问题',
      '修复首页主题切换按钮与页面对应元素偏离的问题（中心线偏差 0px）',
      '新增预览面板左右箭头切换已完成结果（支持键盘 ←/→）',
      '移动端上传 MGG2/MFLAC0 等新版 QQ 音乐加密格式时给出明确指引',
    ],
    assets: [
      { url: `${GH_RELEASE_BASE}/backup-20260822-v19/FormatForge.Setup.1.3.0.exe`, label: 'Windows 安装包 (FormatForge-Setup-1.3.0.exe)', platform: 'windows' },
      { url: `${SITE_BASE}/FormatForge-v19.apk`, label: 'Android 安装包 (FormatForge-v19.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v18',
    title: '转换稳定性修复 + KGG 跨端密钥迁移 + 三端安装包',
    date: '2026-08-22',
    highlights: [
      '修复偶现「开始转换」按钮无响应（FFmpeg 僵尸引擎导致任务卡死）',
      '修复 FFmpeg 监听器随转换累积导致的内存与状态混乱',
      '修复 KGMusicV3.db 跨端复制粘贴导入失败',
      '新增 Windows 客户端安装包（内置原生 ffmpeg.exe）',
      '新增 Android APK、iOS Capacitor/Xcode 工程',
    ],
    assets: [
      { url: `${GH_RELEASE_BASE}/backup-20260822-v18/FormatForge-Setup-1.2.0.exe`, label: 'Windows 安装包 (FormatForge-Setup-1.2.0.exe)', platform: 'windows' },
      { url: `${SITE_BASE}/FormatForge-v18.apk`, label: 'Android 安装包 (FormatForge-v18.apk)', platform: 'android' },
    ],
  },
  {
    version: 'v17',
    title: '移动端稳定性与 PWA 自动更新',
    date: '2026-08-21',
    highlights: [
      '修复移动端转换按钮在部分旧缓存环境中显示无响应的问题',
      '转换按钮未选择目标格式时显示「请先选择目标格式」',
      '新增 Service Worker 接管刷新机制，新版本部署后自动刷新旧页面',
    ],
    assets: [],
  },
  {
    version: 'v16',
    title: '音频视频转换修复 + 手机端 KGG 解密',
    date: '2026-08-21',
    highlights: [
      '修复 Electron 客户端音频/视频转换失败（原生 FFmpeg 桥接检测问题）',
      '新增手机端 KGG 解密：Root 设备一键读取本机密钥库',
      '未 Root 设备引导粘贴电脑端导出的密钥文本完成解密',
    ],
    assets: [
      { url: `${SITE_BASE}/FormatForge-v16.1.apk`, label: 'Android 安装包 (FormatForge-v16.1.apk，v16.1 为 v16 的启动修复版)', platform: 'android' },
    ],
  },
  {
    version: 'v15',
    title: 'WMA / TIFF 预览解码 + 安卓端转换按钮修复',
    date: '2026-08-21',
    highlights: [
      '新增 WMA 音频预览（FFmpeg WASM 实时转码 WAV 播放）',
      '新增 TIFF 图片预览（FFmpeg WASM 实时转码 PNG 显示）',
      '修复安卓端网页「开始转换」按钮点击无响应',
    ],
    assets: [],
  },
  {
    version: 'v14',
    title: '视频格式预览与转换修复',
    date: '2026-08-21',
    highlights: [
      '修复 FLV、AVI、WMV、MPEG、MPG、TS 无法预览播放的问题',
      '修复 GIF 被误识别为视频的问题',
      '修复 WebM、3GP、OGV 转换后 0B 无法播放的问题',
    ],
    assets: [],
  },
  {
    version: 'v13',
    title: 'QQ 音乐解密代理国内可达',
    date: '2026-08-21',
    highlights: [
      'QQ 音乐解密代理切换为自定义域名 qq.formatforge.asia，国内可达',
      '新增 Worker 部署配置 worker/wrangler.toml',
    ],
    assets: [],
  },
  {
    version: 'v12',
    title: '修复生产环境 QQ 音乐解密',
    date: '2026-08-20',
    highlights: [
      '修复生产环境 QQ 音乐加密音频解密失败——直连接口被 CORS 拦截，改经 Cloudflare Worker 代理',
    ],
    assets: [],
  },
  {
    version: 'v11',
    title: '图片旋转预览 + PDF 统一尺寸',
    date: '2026-08-20',
    highlights: [
      '图片旋转后可即时预览旋转效果',
      '多图合并 PDF 支持一键「统一尺寸」',
    ],
    assets: [],
  },
  {
    version: 'v10',
    title: '数字排序',
    date: '2026-08-20',
    highlights: [
      '文件队列直接输入序号调整排序',
      '置顶区与非置顶区分别独立排序',
    ],
    assets: [],
  },
  {
    version: 'v9',
    title: '置顶 + 图片旋转',
    date: '2026-08-20',
    highlights: [
      '文件置顶功能，支持置顶区顺序管理',
      '图片支持顺/逆时针旋转 90°，旋转应用于转换输出',
    ],
    assets: [],
  },
  {
    version: 'v8',
    title: '拖拽排序',
    date: '2026-08-20',
    highlights: [
      '文件支持拖拽调整顺序，无需重新上传',
    ],
    assets: [],
  },
  {
    version: 'v7',
    title: '源文件预览',
    date: '2026-08-20',
    highlights: [
      '刚上传的文件可直接预览（图片/音频/视频/PDF/表格/文本/HTML）',
    ],
    assets: [],
  },
  {
    version: 'v6',
    title: '转换提速 + 过程解锁',
    date: '2026-08-20',
    highlights: [
      '转换期间不再锁定转换按钮，可继续添加文件',
      '提升多文件同时转换速度（媒体串行、非媒体并行）',
    ],
    assets: [],
  },
  {
    version: 'v5',
    title: '视频转换精细化',
    date: '2026-08-20',
    highlights: [
      '视频转换提供速度、质量（CRF）、分辨率选项',
    ],
    assets: [],
  },
  {
    version: 'v4',
    title: '视频转换提速',
    date: '2026-08-20',
    highlights: [
      '切换更快的 FFmpeg 编码器预设，显著提升视频转换速度',
    ],
    assets: [],
  },
  {
    version: 'v3',
    title: '批量操作 + 重命名',
    date: '2026-08-20',
    highlights: [
      '所有转换功能支持文件重命名',
      '批量场景可全选指定格式，也可分别点选目标格式',
    ],
    assets: [],
  },
  {
    version: 'v2',
    title: '多图合并 PDF + PDF 预览',
    date: '2026-08-20',
    highlights: [
      '多张图片合并为一个 PDF，支持统一方向与边距',
      'PDF 转换结果支持分页预览',
    ],
    assets: [],
  },
  {
    version: 'v1',
    title: '基础版本',
    date: '2026-08-20',
    highlights: [
      '音频/视频/图片/表格/文档格式互转',
      'QQ 音乐、网易云、酷狗加密音频解密',
      'PWA 支持，PC / Android / iOS 均可安装独立使用',
    ],
    assets: [],
  },
];
