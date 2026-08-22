/**
 * 跨平台文件保存/下载工具
 * - 桌面浏览器：<a download> 触发下载
 * - Android 客户端（Capacitor）：WebView 不支持 a[download]，通过原生插件
 *   写入系统公共下载目录（Download/）
 * - 移动端网页：优先 Web Share API（调起系统分享/保存面板），失败回退 <a download>
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isMobileDevice } from './platform';

interface SaveFileNativePlugin {
  /** 将 base64 数据保存到系统下载目录，返回保存结果与路径 */
  saveToDownloads(options: { data: string; filename: string; mimeType?: string }): Promise<{ saved: boolean; path: string }>;
}

const SaveFileNative = registerPlugin<SaveFileNativePlugin>('SaveFileNative', {
  web: () => ({
    saveToDownloads: async () => {
      throw new Error('Web 端不支持原生保存');
    },
  }),
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** 通过 <a download> 触发浏览器下载（桌面端及移动端兜底） */
function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 保留 object URL 一段时间，确保移动端慢速下载也能完成
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * 保存/下载一个 Blob 文件。
 * 根据运行环境自动选择最可靠的保存方式，见文件头注释。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  // 1) Android 客户端：原生写入 Download 目录（WebView 内 a[download] 无效）
  if (getPlatform() === 'android') {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await SaveFileNative.saveToDownloads({
      data: bytesToBase64(bytes),
      filename,
      mimeType: blob.type || 'application/octet-stream',
    });
    if (result?.saved) return;
    throw new Error(`保存到下载目录失败，请重试（${result?.path ?? ''}）`);
  }

  // 2) 移动端网页：优先 Web Share API，调起系统「保存到文件 / 分享」面板
  if (isMobileDevice() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      const shareable = typeof navigator.canShare === 'function'
        ? navigator.canShare({ files: [file] })
        : true;
      if (shareable) {
        await navigator.share({ files: [file], title: filename });
        return; // 完成（或用户主动取消）均视为已处理
      }
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'AbortError') return; // 用户取消分享
      // 其他失败（如用户激活过期）→ 回退 <a download>
    }
  }

  // 3) 桌面端 / 移动端回退：<a download>
  downloadViaAnchor(blob, filename);
}
