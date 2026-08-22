/**
 * 平台检测工具
 * 用于判断当前运行环境（Web / Electron / Android Capacitor）
 */
export type Platform = 'web' | 'electron' | 'android';

let cachedPlatform: Platform | null = null;

export function getPlatform(): Platform {
  if (cachedPlatform !== null) return cachedPlatform;

  // Capacitor 环境检测（Android / Electron），避免依赖脆弱的 UA 判断
  const capPlatform = (window as any).Capacitor?.getPlatform?.();
  if (capPlatform === 'android') {
    cachedPlatform = 'android';
    return cachedPlatform;
  }
  if (capPlatform === 'electron') {
    cachedPlatform = 'electron';
    return cachedPlatform;
  }

  // Electron 环境只要有原生 FFmpeg 桥接即为桌面端（桥接仅由 preload 注入）
  if ((window as any).electronFFmpeg) {
    cachedPlatform = 'electron';
    return cachedPlatform;
  }

  // 兜底：Web
  cachedPlatform = 'web';
  return cachedPlatform;
}

/**
 * 检查是否运行在原生环境（Electron 或 Android），即可以离线使用
 */
export function isNativePlatform(): boolean {
  const p = getPlatform();
  return p === 'electron' || p === 'android';
}

/**
 * 检查是否为 Web 环境
 */
export function isWebPlatform(): boolean {
  return getPlatform() === 'web';
}

let cachedMobile: boolean | null = null;

/**
 * 检查当前是否为移动端设备（Android 客户端 / 手机浏览器 / 平板浏览器）。
 * 用于区分 PC 与移动端的交互（下载方式、凭证输入等）。
 */
export function isMobileDevice(): boolean {
  if (cachedMobile !== null) return cachedMobile;
  if (getPlatform() === 'android') {
    cachedMobile = true;
    return cachedMobile;
  }
  if (getPlatform() === 'electron') {
    cachedMobile = false;
    return cachedMobile;
  }
  cachedMobile = typeof navigator !== 'undefined'
    && /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
  return cachedMobile;
}
