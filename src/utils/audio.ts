/**
 * 音频格式转换入口
 * 委托给平台适配器（Electron 原生 / Android WASM 本地 / Web WASM）
 */
import type { ConvertTask } from '@/types';
import { getMediaAdapter } from './media.adapter.factory';

// 重新导出加密格式检测（供 store 使用）
export { isEncryptedFormat } from './media.adapter.wasm';

export async function convertAudio(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const adapter = await getMediaAdapter();
  return adapter.convertAudio(task, onProgress);
}
