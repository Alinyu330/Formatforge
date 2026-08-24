/**
 * 使用说明打开工具
 *
 * - 网页端：打开随本站部署的说明页（相对路径，GitHub Pages / Cloudflare 均适用）
 * - 客户端（Electron / Android）：优先打开在线版（内容随网页部署自动更新，
 *   无需重新发版）；网络不可达时回退到打包在应用内的本地副本
 */
import { isNativePlatform } from './platform';

/** 在线版使用说明（主站部署，客户端优先使用，保证内容始终最新） */
const GUIDE_ONLINE_URL = 'https://formatforge.asia/Formatforge/使用说明.html';

/** 本地打包副本（随客户端构建分发，离线回退用） */
const GUIDE_LOCAL_URL = `${import.meta.env.BASE_URL}使用说明.html`;

/** 在线版是否可达（no-cors 模式拿到 opaque 响应即视为可达，网络错误则 reject） */
async function isOnlineGuideReachable(): Promise<boolean> {
  try {
    await fetch(GUIDE_ONLINE_URL, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

export async function openGuide(): Promise<void> {
  if (isNativePlatform() && (await isOnlineGuideReachable())) {
    window.open(GUIDE_ONLINE_URL, '_blank', 'noopener');
    return;
  }
  window.open(GUIDE_LOCAL_URL, '_blank', 'noopener');
}
