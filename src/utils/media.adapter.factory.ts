/**
 * 媒体转换适配器工厂
 * 根据当前运行平台自动选择最佳转换引擎：
 * - Electron (exe): 原生 ffmpeg.exe（性能最佳）
 * - Android (apk): WASM（已打包在 APK 内，离线可用）
 * - Web: WASM（唯一选项，支持重试和预加载）
 */
import type { MediaAdapter } from './media.adapter';
import { getPlatform, type Platform } from './platform';

let cachedAdapter: MediaAdapter | null = null;

export async function getMediaAdapter(): Promise<MediaAdapter> {
  if (cachedAdapter) return cachedAdapter;

  const platform: Platform = getPlatform();

  switch (platform) {
    case 'electron': {
      // 检查原生 FFmpeg 桥接是否可用
      const bridge = (window as any).electronFFmpeg;
      if (bridge?.isAvailable?.()) {
        const { electronMediaAdapter } = await import('./media.adapter.electron');
        cachedAdapter = electronMediaAdapter;
        console.log('[MediaAdapter] 使用 Electron 原生 FFmpeg');
        return cachedAdapter;
      }
      // 兜底：使用 WASM
      console.warn('[MediaAdapter] 原生 FFmpeg 不可用，回退到 WASM');
      const { wasmMediaAdapter } = await import('./media.adapter.wasm');
      cachedAdapter = wasmMediaAdapter;
      return cachedAdapter;
    }
    case 'android': {
      const { androidMediaAdapter } = await import('./media.adapter.android');
      cachedAdapter = androidMediaAdapter;
      console.log('[MediaAdapter] 使用 Android WASM FFmpeg（本地文件，离线可用）');
      return cachedAdapter;
    }
    case 'web':
    default: {
      const { wasmMediaAdapter } = await import('./media.adapter.wasm');
      cachedAdapter = wasmMediaAdapter;
      console.log('[MediaAdapter] 使用 Web WASM FFmpeg（纯离线，无需联网）');
      return cachedAdapter;
    }
  }
}

/** 预加载媒体转换引擎（进入音频/视频页面时调用） */
export function preloadMediaEngine(): void {
  // 在后台异步预加载，不阻塞 UI
  getMediaAdapter().then((adapter) => {
    adapter.preload?.();
  }).catch(() => {
    // 预加载失败不报错，实际转换时会重试
  });
}
