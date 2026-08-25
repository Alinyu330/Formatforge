/**
 * Electron 原生 FFmpeg 适配器
 * 通过 IPC 调用主进程的 ffmpeg.exe，性能远超 WASM
 *
 * 大文件防闪退（v28）：旧方案把整个文件经 IPC 在渲染/主进程间来回拷贝，
 * 峰值内存约为文件大小 4~5 倍，大文件直接 OOM 闪退。
 * 现改为分块协议：输入分块(4MB)写入主进程临时文件 → ffmpeg 读临时文件转换
 * → 输出留在主进程临时文件，渲染层分块读回组装 Blob。
 */
import type { MediaAdapter } from './media.adapter';
import type { ConvertTask } from '@/types';
import { isQMCFile, decryptQMC, decryptMusicexWithEkey, fetchEkeyFromAPI, isMusicexFormat, parseMusicexFooter } from './qmc';
import { isNCMFile, decryptNCM } from './ncm';
import { isKGMFile, decryptKGM } from './kgm';
import { isKGGFile, decryptKGG, extractKGGKeyId, getKugouKey } from './kgg';

declare global {
  interface Window {
    electronFFmpeg?: {
      convert: (
        inputData: ArrayBuffer,
        sourceFormat: string,
        targetFormat: string,
        fileType: 'audio' | 'video' | 'image',
        options?: Record<string, unknown>,
      ) => Promise<ArrayBuffer>;
      createTempInput: (sourceFormat: string) => Promise<string>;
      appendChunk: (path: string, chunk: ArrayBuffer) => Promise<boolean>;
      writeBytes: (path: string, data: ArrayBuffer) => Promise<boolean>;
      convertFile: (params: {
        inputPath: string;
        sourceFormat: string;
        targetFormat: string;
        fileType: 'audio' | 'video' | 'image';
        options?: Record<string, unknown>;
      }) => Promise<{ outputPath: string; size: number }>;
      readChunk: (path: string, offset: number, length: number) => Promise<ArrayBuffer>;
      cleanupFile: (path: string) => Promise<boolean>;
      isAvailable: () => boolean;
    };
    electronKGG?: {
      getKey: (keyId: string) => Promise<string | null>;
    };
  }
}

function getMimeType(targetFormat: string, fileType: 'audio' | 'video'): string {
  if (fileType === 'audio') {
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav',
      aac: 'audio/aac', ogg: 'audio/ogg', m4a: 'audio/mp4',
      wma: 'audio/x-ms-wma', opus: 'audio/opus', alac: 'audio/mp4',
      ape: 'audio/ape', ac3: 'audio/ac3', eac3: 'audio/eac3', amr: 'audio/amr',
    };
    return mimeMap[targetFormat] ?? 'audio/mpeg';
  }
  const videoMimeMap: Record<string, string> = {
    mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', flv: 'video/x-flv', wmv: 'video/x-ms-wmv', mpeg: 'video/mpeg',
    mpg: 'video/mpeg', m4v: 'video/x-m4v', '3gp': 'video/3gpp', ts: 'video/mp2t',
    ogv: 'video/ogg', gif: 'image/gif',
  };
  return videoMimeMap[targetFormat.toLowerCase()] ?? 'application/octet-stream';
}

/** 分块大小：4MB（IPC 结构化克隆单次传输安全且高效） */
const IPC_CHUNK_SIZE = 4 * 1024 * 1024;

/** 将 Blob 分块写入主进程临时文件，返回临时文件路径 */
async function writeBlobToTemp(blob: Blob, sourceFormat: string): Promise<string> {
  const bridge = window.electronFFmpeg!;
  const inputPath = await bridge.createTempInput(sourceFormat);
  for (let offset = 0; offset < blob.size; offset += IPC_CHUNK_SIZE) {
    const chunk = await blob.slice(offset, Math.min(offset + IPC_CHUNK_SIZE, blob.size)).arrayBuffer();
    await bridge.appendChunk(inputPath, chunk);
  }
  return inputPath;
}

/** 将 Uint8Array 写入主进程临时文件，返回临时文件路径 */
async function writeBytesToTemp(data: Uint8Array, sourceFormat: string): Promise<string> {
  const bridge = window.electronFFmpeg!;
  const inputPath = await bridge.createTempInput(sourceFormat);
  await bridge.writeBytes(
    inputPath,
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return inputPath;
}

/** 分块读取主进程输出文件并组装 Blob（避免一次性整文件 IPC 拷贝） */
async function readOutputAsBlob(outputPath: string, size: number, mimeType: string): Promise<Blob> {
  const bridge = window.electronFFmpeg!;
  const parts: ArrayBuffer[] = [];
  for (let offset = 0; offset < size; offset += IPC_CHUNK_SIZE) {
    parts.push(await bridge.readChunk(outputPath, offset, Math.min(IPC_CHUNK_SIZE, size - offset)));
  }
  return new Blob(parts, { type: mimeType });
}

async function convertNative(
  task: ConvertTask,
  fileType: 'audio' | 'video',
  onProgress: (p: number) => void,
): Promise<Blob> {
  const bridge = window.electronFFmpeg;
  if (!bridge?.isAvailable?.()) {
    throw new Error('原生 FFmpeg 引擎不可用，请确认已安装 ffmpeg.exe');
  }

  let sourceFormat = task.sourceFormat;
  let inputPath: string;

  if (fileType === 'audio') {
    // 音频：可能需要先解密（解密后的数据量较小，一次性写入临时文件）
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    if (isQMCFile(task.fileName)) {
      let result;
      if (isMusicexFormat(raw)) {
        const info = parseMusicexFooter(raw);
        const cred = task.audioOptions?.qmCredentials;
        if ((!cred?.uin && !cred?.rawCookie) || (!cred?.authst && !cred?.musicKey && !cred?.rawCookie)) {
          throw new Error('该文件为新版 QQ 音乐加密格式，请填写 QQ 音乐 UIN 并提供 authst 或 qqmusic_key，或直接粘贴完整 Cookie');
        }
        if (!info?.mediaMid || !info?.filename) {
          throw new Error('无法解析新版 QQ 音乐文件信息，暂时不能自动获取 ekey');
        }
        const ekeyResult = await fetchEkeyFromAPI(cred, info.mediaMid, info.filename, '27');
        result = await decryptMusicexWithEkey(raw, ekeyResult.ekey);
      } else {
        result = await decryptQMC(raw);
      }
      inputPath = await writeBytesToTemp(result.data, result.ext);
      sourceFormat = result.ext;
    } else if (isNCMFile(task.fileName)) {
      const result = await decryptNCM(raw);
      inputPath = await writeBytesToTemp(result.data, result.ext);
      sourceFormat = result.ext;
    } else if (isKGMFile(task.fileName)) {
      const result = await decryptKGM(raw);
      inputPath = await writeBytesToTemp(result.data, result.ext);
      sourceFormat = result.ext;
    } else if (isKGGFile(task.fileName)) {
      const keyId = extractKGGKeyId(raw);
      let encryptionKey: string | null = null;
      const bridgeKGG = window.electronKGG;
      if (bridgeKGG?.getKey) {
        try {
          encryptionKey = await bridgeKGG.getKey(keyId);
        } catch {
          encryptionKey = null;
        }
      }
      if (!encryptionKey) encryptionKey = getKugouKey(keyId);
      if (!encryptionKey) {
        throw new Error('未在密钥库中找到该 KGG 文件的解密密钥。请先安装并登录酷狗音乐客户端下载该歌曲，或在页面中导入 KGMusicV3.db 密钥数据库');
      }
      const result = await decryptKGG(raw, encryptionKey);
      inputPath = await writeBytesToTemp(result.data, result.ext);
      sourceFormat = result.ext;
    } else {
      // 普通音频：原样分块写入（FLAC 无损动辄上百 MB，同样走分块）
      inputPath = await writeBlobToTemp(task.sourceFile, sourceFormat);
    }
  } else {
    // 视频：大文件主力场景，分块写入临时文件
    inputPath = await writeBlobToTemp(task.sourceFile, sourceFormat);
  }
  onProgress(5);

  const options: Record<string, unknown> = {};

  if (fileType === 'audio' && task.audioOptions) {
    options.bitrate = task.audioOptions.bitrate;
    options.sampleRate = task.audioOptions.sampleRate;
  } else if (fileType === 'video' && task.videoOptions) {
    options.videoBitrate = task.videoOptions.videoBitrate;
    options.audioBitrate = task.videoOptions.audioBitrate;
    options.preset = task.videoOptions.preset;
    options.quality = task.videoOptions.quality;
    options.resolution = task.videoOptions.resolution;
    options.width = task.videoOptions.width;
    options.height = task.videoOptions.height;
  }

  let outputPath = '';
  try {
    const result = await bridge.convertFile({
      inputPath,
      sourceFormat,
      targetFormat: task.targetFormat.toLowerCase(),
      fileType,
      options,
    });
    outputPath = result.outputPath;
    onProgress(99);

    const blob = await readOutputAsBlob(outputPath, result.size, getMimeType(task.targetFormat, fileType));
    onProgress(100);
    return blob;
  } finally {
    try { await bridge.cleanupFile(inputPath); } catch { /* 清理失败可忽略 */ }
    if (outputPath) {
      try { await bridge.cleanupFile(outputPath); } catch { /* 清理失败可忽略 */ }
    }
  }
}

export const electronMediaAdapter: MediaAdapter = {
  convertAudio: (task, onProgress) => convertNative(task, 'audio', onProgress),
  convertVideo: (task, onProgress) => convertNative(task, 'video', onProgress),
};
