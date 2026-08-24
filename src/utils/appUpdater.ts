/**
 * 应用内更新工具（Electron / Android 客户端）
 *
 * 更新元数据（版本号 + 更新日志）：
 *   https://dl.formatforge.asia/update/version.json
 *
 * - Electron：electron-updater 标准流程（latest.yml + NSIS 安装包，支持差量下载），
 *   经 preload 注入的 window.electronUpdater 桥接调用主进程
 * - Android：下载 APK 到应用缓存目录（原生线程 + 进度事件），
 *   下载完成后经 FileProvider 唤起系统安装器，是否安装由用户决定
 * - Web：不支持（PWA 由 Service Worker 自动更新）
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { getPlatform } from './platform';

// ============== Electron 桥接类型 ==============

declare global {
  interface Window {
    electronUpdater?: {
      getVersion: () => Promise<string>;
      check: () => Promise<{ version: string }>;
      download: () => Promise<unknown>;
      install: () => Promise<void>;
      on: (event: string, callback: (data: unknown) => void) => () => void;
    };
  }
}

// ============== Android 原生插件 ==============

interface AppUpdateNativePlugin {
  /** 获取当前应用版本（versionName 如 "1.5"，versionCode 单调递增） */
  getVersion(): Promise<{ versionName: string; versionCode: number }>;
  /** 下载 APK 到缓存目录，进度经 updateProgress 事件通知，返回本地文件路径 */
  downloadApk(options: { url: string }): Promise<{ filePath: string }>;
  /** 唤起系统安装器安装指定 APK（系统会再次请求用户确认） */
  installApk(options: { filePath: string }): Promise<void>;
  /** 订阅原生进度事件（Capacitor 5+ 返回 Promise 句柄） */
  addListener(
    eventName: 'updateProgress',
    listenerFunc: (data: { percent?: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const AppUpdateNative = registerPlugin<AppUpdateNativePlugin>('AppUpdateNative', {
  web: () => ({
    getVersion: async () => {
      throw new Error('Web 端不支持应用内更新');
    },
    downloadApk: async () => {
      throw new Error('Web 端不支持应用内更新');
    },
    installApk: async () => {
      throw new Error('Web 端不支持应用内更新');
    },
  }),
});

// ============== 版本元数据 ==============

/** 更新元数据地址（R2，国内直连；加时间戳查询串防缓存） */
const VERSION_JSON_URL = 'https://dl.formatforge.asia/update/version.json';

interface PlatformUpdateMeta {
  version?: string;
  versionName?: string;
  versionCode?: number;
  apkUrl?: string;
  notes?: string[];
}

interface UpdateMeta {
  windows?: PlatformUpdateMeta;
  android?: PlatformUpdateMeta;
}

async function fetchUpdateMeta(): Promise<UpdateMeta> {
  const res = await fetch(`${VERSION_JSON_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`获取版本信息失败（${res.status}）`);
  return res.json() as Promise<UpdateMeta>;
}

/** 比较语义化版本号：a > b 返回 1，相等返回 0，否则 -1 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// ============== 对外 API ==============

export interface UpdateInfo {
  /** 新版本号（Electron 为 semver，Android 为 versionName） */
  version: string;
  /** 更新日志条目 */
  notes: string[];
}

/** 当前环境是否支持应用内更新 */
export function isUpdaterSupported(): boolean {
  const platform = getPlatform();
  return platform === 'electron' || platform === 'android';
}

/**
 * 检查更新。有新版本返回 UpdateInfo，已是最新返回 null。
 * 网络失败抛出异常（调用方决定是否提示）。
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const platform = getPlatform();

  if (platform === 'electron') {
    const bridge = window.electronUpdater;
    if (!bridge) return null;
    const [{ version: latest }, current, meta] = await Promise.all([
      bridge.check(),
      bridge.getVersion(),
      fetchUpdateMeta().catch(() => ({}) as UpdateMeta),
    ]);
    if (compareVersion(latest, current) <= 0) return null;
    return {
      version: latest,
      notes: meta.windows?.notes ?? [],
    };
  }

  if (platform === 'android') {
    const [native, meta] = await Promise.all([
      AppUpdateNative.getVersion(),
      fetchUpdateMeta(),
    ]);
    const android = meta.android;
    if (!android?.versionCode || !android.apkUrl) return null;
    if (native.versionCode >= android.versionCode) return null;
    return {
      version: android.versionName ?? `v${android.versionCode}`,
      notes: android.notes ?? [],
    };
  }

  return null;
}

export type DownloadState =
  | { stage: 'downloading'; percent: number }
  | { stage: 'done' }
  | { stage: 'installing' };

/**
 * 下载更新并（Android）自动唤起安装器。
 * - Electron：下载完成后返回 done，由 UI 询问用户「立即重启安装 / 稍后（退出时自动装）」
 * - Android：下载完成后直接唤起系统安装器（系统层面仍需用户确认安装）
 */
export async function downloadUpdate(
  onState: (state: DownloadState) => void,
): Promise<void> {
  const platform = getPlatform();

  if (platform === 'electron') {
    const bridge = window.electronUpdater;
    if (!bridge) throw new Error('更新桥接不可用');
    await new Promise<void>((resolve, reject) => {
      const offProgress = bridge.on('updater:progress', (data) => {
        const percent = (data as { percent?: number })?.percent ?? 0;
        onState({ stage: 'downloading', percent: Math.min(100, Math.max(0, percent)) });
      });
      const offDone = bridge.on('updater:downloaded', () => {
        cleanup();
        onState({ stage: 'done' });
        resolve();
      });
      const offError = bridge.on('updater:error', (data) => {
        cleanup();
        reject(new Error((data as { message?: string })?.message ?? '下载更新失败'));
      });
      const cleanup = () => {
        offProgress();
        offDone();
        offError();
      };
      bridge.download().catch((err: unknown) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
    return;
  }

  if (platform === 'android') {
    const meta = await fetchUpdateMeta();
    const apkUrl = meta.android?.apkUrl;
    if (!apkUrl) throw new Error('更新信息中缺少安装包地址');

    const offProgress = AppUpdateNative.addListener(
      'updateProgress',
      (data: { percent?: number }) => {
        const percent = data?.percent ?? 0;
        onState({ stage: 'downloading', percent: Math.min(100, Math.max(0, percent)) });
      },
    );
    try {
      const { filePath } = await AppUpdateNative.downloadApk({ url: apkUrl });
      onState({ stage: 'done' });
      onState({ stage: 'installing' });
      await AppUpdateNative.installApk({ filePath });
    } finally {
      offProgress.then((h) => h.remove()).catch(() => undefined);
    }
    return;
  }

  throw new Error('当前环境不支持应用内更新');
}

/** Electron：立即重启并安装已下载的更新 */
export async function installUpdate(): Promise<void> {
  const bridge = window.electronUpdater;
  if (!bridge) throw new Error('更新桥接不可用');
  await bridge.install();
}
