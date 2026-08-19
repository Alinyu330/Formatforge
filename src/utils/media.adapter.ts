/**
 * 音频/视频格式转换适配器接口
 * 不同平台有不同实现：Web 用 WASM，Electron 用原生 ffmpeg.exe，Android 用 WASM（本地文件）
 */
import type { ConvertTask } from '@/types';

export interface MediaConvertOptions {
  inputData: Uint8Array;
  sourceFormat: string;
  targetFormat: string;
  audioBitrate?: string;
  audioSampleRate?: number;
  videoBitrate?: string;
  audioBitrateVideo?: string;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  /** 加密格式的解密信息 */
  decrypted?: {
    ext: string;
    data: Uint8Array;
  };
}

export interface MediaConversionResult {
  blob: Blob;
}

export interface MediaAdapter {
  /** 转换音频 */
  convertAudio(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob>;
  /** 转换视频 */
  convertVideo(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob>;
  /** 预加载引擎（可提前调用以加速后续转换） */
  preload?(): Promise<void>;
}
