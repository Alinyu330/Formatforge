/**
 * 视频格式转换入口
 * 委托给平台适配器（Electron 原生 / Android WASM 本地 / Web WASM）
 */
import type { ConvertTask } from '@/types';
import { getMediaAdapter } from './media.adapter.factory';

export async function convertVideo(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const adapter = await getMediaAdapter();
  return adapter.convertVideo(task, onProgress);
}
