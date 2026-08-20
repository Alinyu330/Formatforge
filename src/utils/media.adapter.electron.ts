/**
 * Electron 原生 FFmpeg 适配器
 * 通过 IPC 调用主进程的 ffmpeg.exe，性能远超 WASM
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
        fileType: 'audio' | 'video',
        options?: Record<string, unknown>,
      ) => Promise<ArrayBuffer>;
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

async function convertNative(
  task: ConvertTask,
  fileType: 'audio' | 'video',
  onProgress: (p: number) => void,
): Promise<Blob> {
  const bridge = window.electronFFmpeg;
  if (!bridge?.isAvailable?.()) {
    throw new Error('原生 FFmpeg 引擎不可用，请确认已安装 ffmpeg.exe');
  }

  let inputData = await task.sourceFile.arrayBuffer();
  let sourceFormat = task.sourceFormat;
  if (fileType === 'audio') {
    const raw = new Uint8Array(inputData);
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
      inputData = result.data.buffer.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength);
      sourceFormat = result.ext;
    } else if (isNCMFile(task.fileName)) {
      const result = await decryptNCM(raw);
      inputData = result.data.buffer.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength);
      sourceFormat = result.ext;
    } else if (isKGMFile(task.fileName)) {
      const result = await decryptKGM(raw);
      inputData = result.data.buffer.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength);
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
      const result = decryptKGG(raw, encryptionKey);
      inputData = result.data.buffer.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength);
      sourceFormat = result.ext;
    }
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

  // 通过 IPC 调用原生 FFmpeg
  const outputBuffer = await bridge.convert(
    inputData,
    sourceFormat,
    task.targetFormat.toLowerCase(),
    fileType,
    options,
  );

  onProgress(99);

  const blob = new Blob([outputBuffer], {
    type: getMimeType(task.targetFormat, fileType),
  });

  onProgress(100);
  return blob;
}

export const electronMediaAdapter: MediaAdapter = {
  convertAudio: (task, onProgress) => convertNative(task, 'audio', onProgress),
  convertVideo: (task, onProgress) => convertNative(task, 'video', onProgress),
};
