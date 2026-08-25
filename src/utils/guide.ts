/**
 * 在线内容页打开工具（使用说明 / 历史版本）
 *
 * 客户端（Electron / Android）统一用系统默认浏览器打开在线版，内容随网页
 * 部署自动更新，彻底摆脱客户端打包版本滞后的历史问题；网页端在站内打开，
 * 内容同样实时最新。
 *
 * 所有在线地址统一处理：
 *   1. encodeURI 对路径中的中文文件名做百分号编码，避免 Electron shell 或
 *      Android Intent 解析未编码 URL 时出错；
 *   2. 附带版本查询参数 ?v=<LATEST.version>，每次发版自动穿透浏览器 / CDN
 *      缓存，保证历史版本与使用说明始终展示最新内容。
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform } from './platform';
import { LATEST } from '@/data/versions';

/** 主站地址（Cloudflare 部署，国内可达） */
const SITE_ORIGIN = 'https://formatforge.asia/Formatforge';

/** 拼接在线页面绝对地址：encodeURI 编码中文路径 + 版本查询参数穿透缓存 */
function onlineUrl(path: string): string {
  return encodeURI(`${SITE_ORIGIN}${path}?v=${LATEST.version}`);
}

function isNativePlatform(): boolean {
  return getPlatform() === 'electron' || getPlatform() === 'android';
}

interface OpenExternalNativePlugin {
  open(options: { url: string }): Promise<void>;
}

const OpenExternalNative = registerPlugin<OpenExternalNativePlugin>('OpenExternalNative');

/** 获取 Electron 注入的 shell 能力（无则返回 undefined） */
function getElectronShell(): { openExternal(url: string): Promise<{ ok: boolean }> } | undefined {
  const w = window as unknown as { electronShell?: { openExternal(url: string): Promise<{ ok: boolean }> } };
  return w.electronShell;
}

/**
 * 用系统默认浏览器打开 URL（Electron / Android）；失败时兜底 window.open
 */
async function openInSystemBrowser(url: string): Promise<void> {
  try {
    if (getPlatform() === 'electron') {
      const shell = getElectronShell();
      if (shell) {
        const result = await shell.openExternal(url);
        if (result.ok) return;
      }
      window.open(url, '_blank', 'noopener');
      return;
    }
    await OpenExternalNative.open({ url });
  } catch {
    // 系统浏览器打开失败时兜底站内打开
    window.open(url, '_blank', 'noopener');
  }
}

/** 打开使用说明（客户端走在线版，网页端走站内文件） */
export function openGuide(): void {
  if (isNativePlatform()) {
    void openInSystemBrowser(onlineUrl('/使用说明.html'));
    return;
  }
  window.open(`${import.meta.env.BASE_URL}使用说明.html?v=${LATEST.version}`, '_blank', 'noopener');
}

/** 打开历史版本页（客户端走在线版，网页端走站内路由） */
export function openHistory(): void {
  if (isNativePlatform()) {
    void openInSystemBrowser(onlineUrl('/history'));
    return;
  }
  window.location.href = `${import.meta.env.BASE_URL}history`;
}