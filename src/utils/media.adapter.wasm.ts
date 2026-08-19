/**
 * Web/Android WASM FFmpeg 适配器
 * 使用 @ffmpeg/ffmpeg WebAssembly，支持重试、预加载、更大超时
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import bundledWasmURL from '@ffmpeg/core/wasm?url';
import workerURL from '@ffmpeg/ffmpeg/worker?url';
import type { MediaAdapter } from './media.adapter';
import type { ConvertTask } from '@/types';
import { isQMCFile, decryptQMC, decryptMusicexWithEkey, fetchEkeyFromAPI, isValidQMCHeader, isMusicexFormat, MusicexNeedsEkeyError, parseMusicexFooter } from './qmc';
import { isNCMFile, decryptNCM, isValidNCMHeader } from './ncm';
import { isKGMFile, decryptKGM, isValidKGMHeader } from './kgm';
import { isKGGFile, decryptKGG, extractKGGKeyId, getKugouKey, hasKugouKeyDb } from './kgg';

// Cloudflare Pages 单文件上限 25MiB，而 ffmpeg-core.wasm 约 31MB，
// 需通过环境变量 VITE_FFMPEG_WASM_URL 托管到外部（如 Cloudflare R2）；未设置时回退到打包内置的 wasm。
const wasmURL = import.meta.env.VITE_FFMPEG_WASM_URL || bundledWasmURL;

// 超时配置
const ENGINE_LOAD_TIMEOUT_MS = 300000;  // 引擎加载超时：5分钟（首次 WASM 编译可能较慢）
const CONVERSION_TIMEOUT_MS = 600000;    // 单次转换超时：10分钟（大视频需要较长时间）

let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let preloadStarted = false;

// ============== 工具函数 ==============

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ============== FFmpeg 引擎加载 ==============

async function loadFFmpegInstance(): Promise<FFmpeg> {
  const instance = new FFmpeg();
  console.log('[WASM-FFmpeg] 开始加载引擎...');
  await withTimeout(
    instance.load({ coreURL, wasmURL, workerURL }),
    ENGINE_LOAD_TIMEOUT_MS,
    '音频/视频转换引擎加载超时（WASM 编译过慢），请刷新页面后重试',
  );
  console.log('[WASM-FFmpeg] 引擎加载完成');

  // 诊断：列出可用的编码器和格式
  try {
    const encLogs: string[] = [];
    const logHandler = ({ message }: { message: string }) => { encLogs.push(message); };
    instance.on('log', logHandler);
    await instance.exec(['-encoders']);
    const audioEncoders = encLogs.filter(l => l.startsWith(' A') || l.startsWith('  A'));
    console.log('[WASM-FFmpeg] 可用音频编码器:', audioEncoders);
    encLogs.length = 0;
    await instance.exec(['-formats']);
    const formats = encLogs.filter(l => l.startsWith(' D') || l.startsWith('  D') || l.startsWith(' DE') || l.startsWith('  DE') || l.startsWith('  E') || l.startsWith(' E'));
    console.log('[WASM-FFmpeg] 可用格式:', formats);
    instance.off('log', logHandler);
  } catch (e) {
    console.warn('[WASM-FFmpeg] 编码器检测失败:', e);
  }

  return instance;

}

export async function getFFmpeg(): Promise<FFmpeg> {
  // 已有可用实例，直接返回
  if (ffmpeg?.loaded) return ffmpeg;

  // 正在加载中，等待加载完成
  if (loadingPromise) return loadingPromise;

  // 开始新的加载
  loadingPromise = loadFFmpegInstance().then((instance) => {
    ffmpeg = instance;
    loadingPromise = null;
    return instance;
  }).catch((err) => {
    loadingPromise = null;
    throw err;
  });

  return loadingPromise;
}

/** 预加载 FFmpeg 引擎（后台静默加载，在页面进入时调用） */
export async function preloadFFmpeg(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;
  console.log('[WASM-FFmpeg] 后台预加载引擎...');
  try {
    await getFFmpeg();
    console.log('[WASM-FFmpeg] 预加载完成');
  } catch (err) {
    console.warn('[WASM-FFmpeg] 预加载失败（后续转换时会重试）:', err);
    preloadStarted = false;
  }
}

// ============== 音频编解码映射 ==============

// 每个格式独立构建 FFmpeg 参数，互不干扰
function buildAudioFormatArgs(targetFormat: string, audioOptions: { bitrate: string; sampleRate?: number }): string[] {
  const args: string[] = [];

  switch (targetFormat) {
    case 'mp3':
      args.push('-codec:a', 'mp3');
      if (audioOptions.bitrate !== 'lossless') args.push('-b:a', audioOptions.bitrate);
      break;
    case 'flac':
      args.push('-codec:a', 'flac', '-compression_level', '8');
      break;
    case 'wav':
      args.push('-codec:a', 'pcm_s16le');
      break;
    case 'aac':
    case 'm4a':
      args.push('-codec:a', 'aac');
      if (audioOptions.bitrate !== 'lossless') args.push('-b:a', audioOptions.bitrate);
      break;
    case 'ogg':
      args.push('-codec:a', 'vorbis', '-strict', '-2', '-q:a', '5');
      break;
    case 'opus':
      // 原生 opus 编码器只支持 48000/24000/16000/12000/8000 Hz，默认 48000
      args.push('-codec:a', 'opus', '-strict', '-2', '-ar', audioOptions.sampleRate && [48000, 24000, 16000, 12000, 8000].includes(audioOptions.sampleRate) ? String(audioOptions.sampleRate) : '48000');
      if (audioOptions.bitrate !== 'lossless') args.push('-b:a', audioOptions.bitrate);
      return args;
    case 'webm':
      args.push('-codec:a', 'opus', '-strict', '-2', '-ar', '48000');
      return args;
    case 'wma':
      args.push('-codec:a', 'wmav2', '-f', 'asf');
      if (audioOptions.bitrate !== 'lossless') args.push('-b:a', audioOptions.bitrate);
      break;
    default:
      // 未知格式，尝试用扩展名推断
      args.push('-codec:a', targetFormat);
      break;
  }

  if (audioOptions.sampleRate) args.push('-ar', String(audioOptions.sampleRate));

  return args;
}

const videoCodecMap: Record<string, string> = {
  mp4: 'libx264', mkv: 'libx264', mov: 'libx264', avi: 'mpeg4',
  flv: 'flv', wmv: 'wmv2', mpeg: 'mpeg2video', mpg: 'mpeg2video',
  m4v: 'libx264', '3gp': 'h263', ts: 'libx264', ogv: 'libtheora', webm: 'libvpx-vp9',
};

const videoAudioCodecMap: Record<string, string> = {
  mp4: 'aac', mkv: 'aac', mov: 'aac', avi: 'mp3', flv: 'mp3',
  wmv: 'wmav2', mpeg: 'mp2', mpg: 'mp2', m4v: 'aac', '3gp': 'aac',
  ts: 'aac', ogv: 'vorbis', webm: 'opus',
};

// ============== 加密格式检测 ==============

export function isEncryptedFormat(filename: string): boolean {
  return isQMCFile(filename) || isNCMFile(filename) || isKGMFile(filename) || isKGGFile(filename);
}

function isRecognizedAudio(data: Uint8Array): boolean {
  if (data.length >= 4) {
    const is = (text: string) => text.split('').every((char, i) => data[i] === char.charCodeAt(0));
    if (is('fLaC') || is('OggS') || is('RIFF') || is('ID3')) return true;
    if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
    if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  }
  return false;
}

// ============== 转换实现 ==============

async function convertAudioWasm(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const ff = await getFFmpeg();

  let inputData: Uint8Array;
  let actualSourceFormat = task.sourceFormat;
  let wasDecrypted = false;
  let decryptFormat = '';

  if (isEncryptedFormat(task.fileName)) {
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(5);

    const isQMC = isQMCFile(task.fileName);
    const isNCM = isNCMFile(task.fileName);
    const isKGM = isKGMFile(task.fileName);
    const isKGG = isKGGFile(task.fileName);
    const isMusicex = isQMC && isMusicexFormat(raw);

    if (isKGG) {
      if (!hasKugouKeyDb()) {
        throw new Error('KGG（酷狗新版加密）需要密钥库才能解密。请先在下方「酷狗 KGG 密钥库」导入本机酷狗客户端的 KGMusicV3.db 文件（路径：%APPDATA%\\KuGou8\\KGMusicV3.db，需已登录酷狗客户端）。');
      }
      const keyId = extractKGGKeyId(raw);
      const encryptionKey = getKugouKey(keyId);
      if (!encryptionKey) {
        throw new Error('密钥库中未找到该 KGG 文件的解密密钥，请确认密钥库来自下载该歌曲的酷狗账号');
      }
      const result = decryptKGG(raw, encryptionKey);
      inputData = result.data;
      actualSourceFormat = result.ext;
      wasDecrypted = true;
      decryptFormat = 'kgg';
      onProgress(30);
    } else {
      const headerValid =
        (isQMC && isValidQMCHeader(raw)) ||
        (isNCM && isValidNCMHeader(raw)) ||
        (isKGM && isValidKGMHeader(raw));

      if (headerValid) {
      onProgress(10);
      if (isMusicex) {
        console.log('[diag] convertAudio: path=musicex+API fileName=', task.fileName);
        const info = parseMusicexFooter(raw);
        const cred = task.audioOptions?.qmCredentials;
        if ((!cred?.uin && !cred?.rawCookie) || (!cred?.authst && !cred?.musicKey && !cred?.rawCookie)) {
          throw new Error('该文件为新版 QQ 音乐加密格式，请填写 QQ 音乐 UIN 并提供 authst 或 qqmusic_key，或直接粘贴完整 Cookie');
        }
        if (!info?.mediaMid || !info?.filename) {
          throw new Error('无法解析新版 QQ 音乐文件信息，暂时不能自动获取 ekey');
        }
        const { ekey } = await fetchEkeyFromAPI(cred, info.mediaMid, info.filename, '20');
        const result = await decryptMusicexWithEkey(raw, ekey);
        inputData = result.data;
        actualSourceFormat = result.ext;
      } else if (isQMC) {
        console.log('[diag] convertAudio: path=non-musicex QMC fileName=', task.fileName);
        try {
          const result = await decryptQMC(raw);
          inputData = result.data;
          actualSourceFormat = result.ext;
        } catch (error) {
          if (error instanceof MusicexNeedsEkeyError) {
            console.log('[diag] convertAudio: path=musicex+API (fallback via MusicexNeedsEkeyError)');
            const cred = task.audioOptions?.qmCredentials;
            const info = error.info;
            if ((!cred?.uin && !cred?.rawCookie) || (!cred?.authst && !cred?.musicKey && !cred?.rawCookie)) {
              throw new Error('该文件为新版 QQ 音乐加密格式，请填写 QQ 音乐 UIN 并提供 authst 或 qqmusic_key，或直接粘贴完整 Cookie');
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
      } else if (isNCM) {
        console.log('[diag] convertAudio: path=ncm fileName=', task.fileName);
        const result = await decryptNCM(raw);
        inputData = result.data;
        actualSourceFormat = result.ext;
        console.log('[diag] convertAudio: ncm decrypted len=', inputData.length, 'ext=', actualSourceFormat, 'first16=', Array.from(inputData.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join(' '));
      } else {
        const result = await decryptKGM(raw);
        inputData = result.data;
        actualSourceFormat = result.ext;
      }
      wasDecrypted = true;
      decryptFormat = task.fileName.split('.').pop()?.toLowerCase() || '';
      onProgress(30);
    } else {
      console.warn(`${task.fileName} 扩展名匹配加密格式但文件头不匹配，跳过解密`);
      inputData = raw;
      onProgress(10);
    }
    }
  } else {
    onProgress(5);
    inputData = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(15);
  }

  if (wasDecrypted && (inputData.length < 4 || !isRecognizedAudio(inputData))) {
    console.log('[diag] convertAudio: isRecognizedAudio=FAIL actualSourceFormat=', actualSourceFormat, 'first16=', Array.from(inputData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    throw new Error(`解密失败：输出数据不是可识别的音频流。该 ${decryptFormat.toUpperCase()} 文件可能已损坏或来自不支持的版本`);
  }

  const inputName = `in-${Date.now()}.${actualSourceFormat}`;
  const outputName = `out-${Date.now()}.${task.targetFormat}`;

  await ff.writeFile(inputName, inputData);

  const args: string[] = ['-i', inputName, '-vn'];

  if (task.audioOptions) {
    args.push(...buildAudioFormatArgs(task.targetFormat, task.audioOptions));
  }

  args.push('-y', outputName);


  ff.on('progress', ({ progress }) => {
    const base = wasDecrypted ? 30 : 15;
    onProgress(Math.round(base + progress * (100 - base)));
  });

  // 捕获 FFmpeg 日志用于调试
  const ffLogs: string[] = [];
  ff.on('log', ({ message }) => {
    ffLogs.push(message);
  });

  try {
    await withTimeout(
      ff.exec(args),
      CONVERSION_TIMEOUT_MS,
      `音频"${task.fileName}"转换超时，文件可能过大，请尝试降低比特率`,
    );
  } catch (error) {
    // RuntimeError（WASM 内存越界）会损坏 FFmpeg 实例，需要销毁重建
    if (error instanceof Error && error.name === 'RuntimeError') {
      console.error(`[FFmpeg] WASM 内存错误，销毁实例以重建: ${task.fileName} → ${task.targetFormat}`, { args: args.join(' '), logs: ffLogs, error });
      ffmpeg = null;
      loadingPromise = null;
    } else {
      console.error(`[FFmpeg] 转换失败: ${task.fileName} → ${task.targetFormat}`, { args: args.join(' '), logs: ffLogs, error });
    }
    throw error;
  }

  const data = await ff.readFile(outputName);
  const outputSize = data instanceof Uint8Array ? data.length : (typeof data === 'string' ? data.length : 0);
  console.log(`[FFmpeg] ${task.fileName} → ${task.targetFormat}: outputSize=${outputSize} args=${args.join(' ')}`);
  if (outputSize === 0) {
    console.error(`[FFmpeg] 输出为 0B! stderr:`, ffLogs);
  }
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

async function convertVideoWasm(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const ff = await getFFmpeg();

  const inputName = `vin-${Date.now()}.${task.sourceFormat}`;
  const outputName = `vout-${Date.now()}.${task.targetFormat}`;

  onProgress(2);
  await ff.writeFile(inputName, await fetchFile(task.sourceFile));
  onProgress(5);

  const args = [
    '-i', inputName,
    '-c:v', videoCodecMap[task.targetFormat] || 'libx264',
    '-c:a', videoAudioCodecMap[task.targetFormat] || 'aac',
    '-b:v', task.videoOptions?.videoBitrate || '2500k',
    '-b:a', task.videoOptions?.audioBitrate || '192k',
  ];

  if (task.videoOptions?.width && task.videoOptions?.height) {
    args.push('-vf', `scale=${task.videoOptions.width}:${task.videoOptions.height}`);
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
    CONVERSION_TIMEOUT_MS,
    `视频"${task.fileName}"转换超时，文件可能过大，请尝试降低分辨率或比特率`,
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

// ============== 导出适配器实例 ==============

export const wasmMediaAdapter: MediaAdapter = {
  convertAudio: convertAudioWasm,
  convertVideo: convertVideoWasm,
  preload: preloadFFmpeg,
};
