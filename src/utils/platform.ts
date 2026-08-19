/**
 * 平台检测工具
 * 用于判断当前运行环境（Web / Electron / Android Capacitor）
 */
export type Platform = 'web' | 'electron' | 'android';

let cachedPlatform: Platform | null = null;

export function getPlatform(): Platform {
  if (cachedPlatform !== null) return cachedPlatform;

  // Android Capacitor 环境检测必须优先，避免被 UA 误判为 Electron
  if ((window as any).Capacitor?.getPlatform?.() === 'android') {
    cachedPlatform = 'android';
    return cachedPlatform;
  }

  // Electron 环境必须同时具有原生 bridge 和对应 UA 标识
  const ua = navigator.userAgent.toLowerCase();
  if ((window as any).electronFFmpeg && (ua.includes('electron') || ua.includes('formatforge'))) {
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
