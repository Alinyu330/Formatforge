/**
 * 按当前设备下载最新版客户端安装包
 * - Android（客户端 / 手机浏览器）→ 下载最新 APK
 * - iPhone / iPad → 无 IPA 安装包，提示用 Safari 添加到主屏幕（PWA）
 * - PC（Windows / macOS / Linux）→ 下载最新 Windows 安包（目前仅提供 Windows 包）
 */
import { getPlatform, isMobileDevice } from './platform';
import { LATEST } from '@/data/versions';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    // iPadOS 13+ 桌面模式 UA 不含 iPad，需配合 Macintosh + 触屏判断
    || (/Macintosh/i.test(navigator.userAgent) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
}

/** 触发浏览器下载（新标签页直链，交给系统处理） */
function triggerDownload(url: string): void {
  // location.href 直接跳转对 .apk/.exe 会触发浏览器下载而不离开当前页；
  // 但 Android WebView 内导航拦截风险较高，统一用新窗口更稳
  window.open(url, '_blank', 'noopener');
}

/**
 * 按设备下载最新版安装包。
 * 返回 false 表示当前设备无可用安装包（已向用户说明替代方式）。
 */
export function downloadLatestClient(): boolean {
  const platform = getPlatform();

  if (platform === 'android' || (isMobileDevice() && /Android/i.test(navigator.userAgent))) {
    triggerDownload(LATEST.apkUrl);
    return true;
  }

  if (isIOS()) {
    alert(
      'iOS 暂无独立安装包（IPA 需在 macOS/Xcode 签名）。\n' +
      '推荐：用 Safari 打开本站 → 底部「分享」→「添加到主屏幕」，\n' +
      '即可像 App 一样离线使用，功能与 Android 客户端一致。',
    );
    return false;
  }

  // PC / 其他：目前仅提供 Windows 安装包
  triggerDownload(LATEST.exeUrl);
  return true;
}
