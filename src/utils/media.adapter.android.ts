/**
 * Android Capacitor 适配器
 * Android 环境下 WASM 文件已打包在 APK 内，加载速度快，使用 WASM 实现即可
 * 同时增加了更大的超时时间以应对移动设备性能差异
 */
import type { MediaAdapter } from './media.adapter';
import type { ConvertTask } from '@/types';
import { getFFmpeg, buildAudioFormatArgs } from './media.adapter.wasm';
import { isQMCFile, decryptQMC, isMusicexFormat, parseMusicexFooter, decryptMusicexWithEkey, fetchEkeyFromAPI, MusicexNeedsEkeyError } from './qmc';
import { isNCMFile, decryptNCM } from './ncm';
import { isKGMFile, decryptKGM } from './kgm';
import { isKGGFile, decryptKGG, extractKGGKeyId, getKugouKey, hasKugouKeyDb, getKugouKeyCount, importKugouKeyDb } from './kgg';
import { KugouNative, base64ToBytes } from './kugou-native';

/** 新版 QQ 音乐加密文件缺少凭证时的报错（移动端指引去 PC 端解密） */
function qmCredentialError(): Error {
  return new Error('新版 QQ 音乐加密格式（MGG/MFLAC 带数字后缀等）移动端暂不支持解密：需要 QQ 音乐网页版登录 Cookie（UIN + authst 或 qqmusic_key），该凭证只能通过 PC 浏览器登录 y.qq.com 后获取。请在 PC 端打开本站解密转换后，再把文件传到手机。');
}

// Android 设备可能性能较弱，使用更长的超时时间
const ANDROID_LOAD_TIMEOUT_MS = 120000;    // 2分钟（旧设备 WASM 编译慢）
const ANDROID_CONVERT_TIMEOUT_MS = 900000;  // 15分钟（大视频在移动设备上极慢）

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const videoCodecMap: Record<string, string> = {
  mp4: 'libx264', mkv: 'libx264', mov: 'libx264', avi: 'mpeg4',
  flv: 'flv', wmv: 'wmv2', mpeg: 'mpeg2video', mpg: 'mpeg2video',
  m4v: 'libx264', '3gp': 'mpeg4', ts: 'libx264', ogv: 'libtheora', webm: 'libvpx',
};

const videoAudioCodecMap: Record<string, string> = {
  mp4: 'aac', mkv: 'aac', mov: 'aac', avi: 'mp3', flv: 'mp3',
  wmv: 'wmav2', mpeg: 'mp2', mpg: 'mp2', m4v: 'aac', '3gp': 'aac',
  ts: 'aac', ogv: 'libvorbis', webm: 'libopus',
};

function isRecognizedAudio(data: Uint8Array): boolean {
  if (data.length >= 4) {
    const is = (text: string) => text.split('').every((char, i) => data[i] === char.charCodeAt(0));
    if (is('fLaC') || is('OggS') || is('RIFF') || is('ID3')) return true;
    if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
    if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  }
  return false;
}

// ============== 酷狗密钥库 Root 自动读取 ==============

interface KugouKeyDbLoadResult {
  loaded: boolean;
  rooted: boolean;
  message?: string;
}

/** 尝试在 root 设备上自动读取酷狗音乐客户端的密钥库（KGMusicV3.db） */
async function tryLoadKugouKeyDbFromRoot(): Promise<KugouKeyDbLoadResult> {
  try {
    const { data } = await KugouNative.readKugouKeyDb();
    if (data) {
      const bytes = base64ToBytes(data);
      const count = importKugouKeyDb(bytes);
      return { loaded: true, rooted: true, message: `已自动读取 ${count} 个密钥` };
    }
    const { rooted } = await KugouNative.isRooted();
    return rooted ? { loaded: false, rooted: true } : { loaded: false, rooted: false };
  } catch (err) {
    return { loaded: false, rooted: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ============== 音频转换 ==============

async function convertAudioAndroid(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const ff = await withTimeout(
    getFFmpeg(),
    ANDROID_LOAD_TIMEOUT_MS,
    '音频转换引擎加载超时（Android 设备性能有限），请关闭后台应用后重试',
  );

  let inputData: Uint8Array;
  let actualSourceFormat = task.sourceFormat;

  if (isQMCFile(task.fileName)) {
    onProgress(2);
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(10);
    if (isMusicexFormat(raw)) {
      const info = parseMusicexFooter(raw);
      const cred = task.audioOptions?.qmCredentials;
      if ((!cred?.uin && !cred?.rawCookie) || (!cred?.authst && !cred?.musicKey && !cred?.rawCookie)) {
        throw qmCredentialError();
      }
      if (!info?.mediaMid || !info?.filename) {
        throw new Error('无法解析新版 QQ 音乐文件信息，暂时不能自动获取 ekey');
      }
      const { ekey } = await fetchEkeyFromAPI(cred, info.mediaMid, info.filename, '20');
      const result = await decryptMusicexWithEkey(raw, ekey);
      inputData = result.data;
      actualSourceFormat = result.ext;
    } else {
      try {
        const result = await decryptQMC(raw);
        inputData = result.data;
        actualSourceFormat = result.ext;
      } catch (error) {
          if (error instanceof MusicexNeedsEkeyError) {
            const cred = task.audioOptions?.qmCredentials;
            const info = error.info;
            if ((!cred?.uin && !cred?.rawCookie) || (!cred?.authst && !cred?.musicKey && !cred?.rawCookie)) {
              throw qmCredentialError();
            }
          if (!info?.mediaMid || !info?.filename) {
            throw new Error('无法解析新版 QQ 音乐文件信息，暂时不能自动获取 ekey');
          }
          const { ekey } = await fetchEkeyFromAPI(cred, info.mediaMid, info.filename, '20');
          const musicexResult = await decryptMusicexWithEkey(raw, ekey);
          inputData = musicexResult.data;
          actualSourceFormat = musicexResult.ext;
        } else {
          throw error;
        }
      }
    }
    onProgress(30);
  } else if (isNCMFile(task.fileName)) {
    onProgress(2);
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(10);
    const result = await decryptNCM(raw);
    inputData = result.data;
    actualSourceFormat = result.ext;
    onProgress(30);
  } else if (isKGMFile(task.fileName)) {
    onProgress(2);
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(10);
    const result = await decryptKGM(raw);
    inputData = result.data;
    actualSourceFormat = result.ext;
    onProgress(30);
  } else if (isKGGFile(task.fileName)) {
    onProgress(2);
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(10);
    if (!hasKugouKeyDb()) {
      // 尝试在 Root 设备上自动读取酷狗客户端密钥库
      const attempt = await tryLoadKugouKeyDbFromRoot();
      if (!attempt.loaded) {
        if (attempt.rooted) {
          throw new Error('已检测到 Root 权限，但未在酷狗客户端数据目录找到密钥库。请确认已安装并登录酷狗音乐 Android 客户端后再试，或改用电脑端导入 KGMusicV3.db 密钥。');
        }
        throw new Error('KGG（酷狗新版加密）解密需要酷狗客户端的密钥库。当前设备未 Root，无法自动读取本机密钥库。请把电脑端的 KGMusicV3.db 文件发送到手机（微信/QQ/网盘），在下方「手机端导入密钥」点击「导入 KGMusicV3.db」选择该文件；或粘贴电脑端导出的密钥文本导入（纯本地解析，不会上传）。');
      }
    }
    const keyId = extractKGGKeyId(raw);
    const encryptionKey = getKugouKey(keyId);
    console.log('[diag] KGG: keyId=', keyId, 'keyCount=', getKugouKeyCount(), 'hasKey=', !!encryptionKey);
    if (!encryptionKey) {
      throw new Error(`密钥库中未找到该 KGG 文件的解密密钥（keyId: ${keyId}），请确认密钥库来自下载该歌曲的酷狗账号，且密钥库为最新版本`);
    }
    const result = decryptKGG(raw, encryptionKey);
    inputData = result.data;
    actualSourceFormat = result.ext;
    onProgress(30);
  } else {
    onProgress(5);
    inputData = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(15);
  }

  if (isQMCFile(task.fileName) || isNCMFile(task.fileName) || isKGMFile(task.fileName) || isKGGFile(task.fileName)) {
    if (inputData.length < 4 || !isRecognizedAudio(inputData)) {
      throw new Error('解密失败：输出数据不是可识别的音频流');
    }
  }

  const inputName = `ina-${Date.now()}.${actualSourceFormat}`;
  const outputName = `outa-${Date.now()}.${task.targetFormat}`;
  await ff.writeFile(inputName, inputData);

  const args: string[] = ['-i', inputName, '-vn'];
  if (task.audioOptions) {
    args.push(...buildAudioFormatArgs(task.targetFormat, task.audioOptions));
  }
  args.push('-y', outputName);

  ff.on('progress', ({ progress }) => {
    const base = isQMCFile(task.fileName) || isNCMFile(task.fileName) || isKGMFile(task.fileName) || isKGGFile(task.fileName) ? 30 : 15;
    onProgress(Math.round(base + progress * (100 - base)));
  });

  await withTimeout(
    ff.exec(args),
    ANDROID_CONVERT_TIMEOUT_MS,
    `音频"${task.fileName}"转换超时，请尝试降低比特率`,
  );

  const data = await ff.readFile(outputName);
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav',
    aac: 'audio/aac', ogg: 'audio/ogg', m4a: 'audio/mp4',
    wma: 'audio/x-ms-wma', opus: 'audio/opus', webm: 'audio/webm',
  };
  const blob = new Blob([data], { type: mimeMap[task.targetFormat] ?? 'audio/mpeg' });

  try { await ff.deleteFile(inputName); } catch { /* 清理临时文件失败可忽略 */ }
  try { await ff.deleteFile(outputName); } catch { /* 清理临时文件失败可忽略 */ }
  onProgress(100);
  return blob;
}

// ============== 视频转换 ==============

async function convertVideoAndroid(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const { fetchFile } = await import('@ffmpeg/util');

  const ff = await withTimeout(
    getFFmpeg(),
    ANDROID_LOAD_TIMEOUT_MS,
    '视频转换引擎加载超时（Android 设备性能有限），请关闭后台应用后重试',
  );

  const inputName = `vin-${Date.now()}.${task.sourceFormat}`;
  const outputName = `vout-${Date.now()}.${task.targetFormat}`;

  onProgress(2);
  await ff.writeFile(inputName, await fetchFile(task.sourceFile));
  onProgress(5);

  // 质量映射与网页端对齐：libx264 用 preset+CRF（此前无 preset 走 x264 默认
  // medium，在移动端 WASM 上极慢）；libvpx 用 realtime 模式提速数倍
  const videoCodec = videoCodecMap[task.targetFormat] || 'libx264';
  const audioCodec = videoAudioCodecMap[task.targetFormat] || 'aac';
  const preset = task.videoOptions?.preset || 'veryfast';
  const quality = task.videoOptions?.quality || 'medium';
  const CRF: Record<string, string> = { high: '18', medium: '23', low: '28' };
  const BITRATE: Record<string, string> = { high: '4000k', medium: '2500k', low: '1500k' };

  const args = [
    '-i', inputName,
    '-c:v', videoCodec,
    '-c:a', audioCodec,
  ];

  if (videoCodec === 'libx264') {
    args.push('-preset', preset, '-crf', CRF[quality]);
  } else if (videoCodec === 'libvpx') {
    args.push('-b:v', BITRATE[quality], '-deadline', 'realtime', '-cpu-used', '5');
  } else {
    args.push('-b:v', BITRATE[quality]);
  }
  args.push('-b:a', task.videoOptions?.audioBitrate || '192k');

  // bilinear 缩放比默认 bicubic 明显更快，移动端收益更大
  if (task.videoOptions?.width && task.videoOptions?.height) {
    args.push('-vf', `scale=${task.videoOptions.width}:${task.videoOptions.height}:flags=bilinear`);
  }

  if (task.targetFormat === 'gif') {
    args.length = 0;
    args.push('-i', inputName, '-vf', 'fps=12,scale=640:-1:flags=lanczos', '-an');
  }

  args.push('-y', outputName);

  ff.on('progress', ({ progress }) => {
    onProgress(Math.round(5 + progress * 94));
  });

  await withTimeout(
    ff.exec(args),
    ANDROID_CONVERT_TIMEOUT_MS,
    `视频"${task.fileName}"转换超时，请尝试降低分辨率或比特率`,
  );

  const data = await ff.readFile(outputName);
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  try { await ff.deleteFile(inputName); } catch { /* 清理临时文件失败可忽略 */ }
  try { await ff.deleteFile(outputName); } catch { /* 清理临时文件失败可忽略 */ }

  onProgress(100);
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', flv: 'video/x-flv', wmv: 'video/x-ms-wmv', mpeg: 'video/mpeg',
    mpg: 'video/mpeg', m4v: 'video/x-m4v', '3gp': 'video/3gpp', ts: 'video/mp2t',
    ogv: 'video/ogg', gif: 'image/gif',
  };
  return new Blob([bytes], { type: mimeMap[task.targetFormat] ?? 'application/octet-stream' });
}

export const androidMediaAdapter: MediaAdapter = {
  convertAudio: convertAudioAndroid,
  convertVideo: convertVideoAndroid,
  preload: async () => {
    // Android 上在进入页面时预加载 FFmpeg
    try { await getFFmpeg(); } catch { /* 预加载失败可忽略，转换时再加载 */ }
  },
};
