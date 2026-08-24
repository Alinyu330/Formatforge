/**
 * 跨平台文件保存/下载工具
 * - 桌面浏览器：<a download> 触发下载
 * - Android 客户端（Capacitor）：WebView 不支持 a[download]，通过原生插件
 *   分块写入临时文件后落盘到系统公共下载目录（Download/）。
 *   v20 起改为分块协议：旧方案把整个文件转成一个 base64 大字符串跨桥传输，
 *   内存峰值约为文件大小的 3 倍以上（原始 bytes + UTF-16 拼接串 + base64 串，
 *   原生端再解码一份），大文件直接把 WebView 顶到 OOM——表现为保存时卡死闪退。
 * - 移动端网页：优先 Web Share API（调起系统分享/保存面板），失败回退 <a download>
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isMobileDevice } from './platform';

interface SaveFileNativePlugin {
  /** （旧接口）整文件 base64 一次传输，仅兼容保留，勿再使用 */
  saveToDownloads(options: { data: string; filename: string; mimeType?: string }): Promise<{ saved: boolean; path: string }>;
  /** 分块协议 1/3：创建保存会话，返回 token */
  beginSave(options: { filename: string; mimeType?: string }): Promise<{ token: string }>;
  /** 分块协议 2/3：追加写入一块 base64 数据（约 512KB/块） */
  appendChunk(options: { token: string; data: string }): Promise<void>;
  /** 分块协议 3/3：落盘到系统下载目录并清理临时文件 */
  finishSave(options: { token: string }): Promise<{ saved: boolean; path: string }>;
  /** 取消保存会话，清理临时文件 */
  cancelSave(options: { token: string }): Promise<void>;
}

const SaveFileNative = registerPlugin<SaveFileNativePlugin>('SaveFileNative', {
  web: () => ({
    saveToDownloads: async () => {
      throw new Error('Web 端不支持原生保存');
    },
    beginSave: async () => {
      throw new Error('Web 端不支持原生保存');
    },
    appendChunk: async () => {
      throw new Error('Web 端不支持原生保存');
    },
    finishSave: async () => {
      throw new Error('Web 端不支持原生保存');
    },
    cancelSave: async () => undefined,
  }),
});

/** 每块原始字节数：512KB → base64 后约 700KB 字符串，桥传输安全无压力 */
const CHUNK_SIZE = 512 * 1024;

/**
 * 用 FileReader 把一块 Blob 转成 base64。
 * 相比手动 String.fromCharCode + btoa 拼接，readAsDataURL 原生生成、
 * 无中间大字符串，小块场景下零内存浪费。
 */
function blobChunkToBase64(chunk: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 结果形如 "data:application/octet-stream;base64,xxxx"，取逗号后纯 base64
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取分块数据失败'));
    reader.readAsDataURL(chunk);
  });
}

/**
 * Android 客户端：分块写入系统 Download 目录。
 * 任何一步失败都会取消原生会话，避免临时文件残留。
 */
async function saveViaNativeChunks(blob: Blob, filename: string): Promise<void> {
  const mimeType = blob.type || 'application/octet-stream';
  const { token } = await SaveFileNative.beginSave({ filename, mimeType });
  try {
    for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
      const chunk = blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size));
      const data = await blobChunkToBase64(chunk);
      await SaveFileNative.appendChunk({ token, data });
    }
    const result = await SaveFileNative.finishSave({ token });
    if (!result?.saved) {
      throw new Error(`保存到下载目录失败，请重试（${result?.path ?? ''}）`);
    }
  } catch (err) {
    // 中断会话并清理原生端临时文件（cancelSave 自身失败不再叠加处理）
    SaveFileNative.cancelSave({ token }).catch(() => undefined);
    throw err;
  }
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
  // 1) Android 客户端：原生分块写入 Download 目录（WebView 内 a[download] 无效）
  if (getPlatform() === 'android') {
    await saveViaNativeChunks(blob, filename);
    return;
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
