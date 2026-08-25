/**
 * 浏览器 FFmpeg 转码桥：将浏览器无法原生解码/编码的格式经 FFmpeg 处理。
 * - 预览解码：WMA/APE/AC3/EAC3/AMR/AIFF/AU 音频 → WAV；
 *   AVI/FLV/WMV/MPEG/MPG/TS/3GP 视频 → MP4；TIFF 图片 → PNG
 * - 图片转码：Canvas 不支持 TIFF 编码，经 FFmpeg 真编码（供 image.ts 调用）
 * Web/Android 复用 WASM 引擎；Electron 客户端走原生 FFmpeg IPC
 * （客户端加载 WASM 不稳定，此前 WMA 预览直接失败）。
 */
import { getFFmpeg, mountInputFile, unmountInputFile } from './media.adapter.wasm';
import { getPlatform } from './platform';

const AUDIO_NEEDS_DECODE = new Set(['wma', 'ape', 'ac3', 'eac3', 'amr', 'aiff', 'au']);
const VIDEO_NEEDS_DECODE = new Set(['avi', 'flv', 'wmv', 'mpeg', 'mpg', 'ts', '3gp']);
const IMAGE_NEEDS_DECODE = new Set(['tiff', 'tif']);

/** 判断某格式在浏览器中是否需先经 FFmpeg 转码才能预览 */
export function needsPreviewDecode(format: string): boolean {
  const f = format.toLowerCase();
  return AUDIO_NEEDS_DECODE.has(f) || IMAGE_NEEDS_DECODE.has(f) || VIDEO_NEEDS_DECODE.has(f);
}

/** 预览解码的目标格式（wav / mp4 / png） */
function previewDecodeTarget(format: string): 'wav' | 'mp4' | 'png' {
  const f = format.toLowerCase();
  if (IMAGE_NEEDS_DECODE.has(f)) return 'png';
  if (VIDEO_NEEDS_DECODE.has(f)) return 'mp4';
  return 'wav';
}

const OUTPUT_MIME: Record<string, string> = {
  wav: 'audio/wav', mp4: 'video/mp4', png: 'image/png', tiff: 'image/tiff', tif: 'image/tiff',
};

// ============== Electron 原生 FFmpeg 路径 ==============

/** 分块大小：4MB（IPC 结构化克隆单次传输安全且高效） */
const IPC_CHUNK_SIZE = 4 * 1024 * 1024;

async function transcodeViaElectron(
  blob: Blob,
  sourceFormat: string,
  targetFormat: string,
  fileType: 'audio' | 'video' | 'image',
  options?: Record<string, unknown>,
): Promise<Blob> {
  const bridge = window.electronFFmpeg!;

  const inputPath = await bridge.createTempInput(sourceFormat);
  for (let offset = 0; offset < blob.size; offset += IPC_CHUNK_SIZE) {
    const chunk = await blob.slice(offset, Math.min(offset + IPC_CHUNK_SIZE, blob.size)).arrayBuffer();
    await bridge.appendChunk(inputPath, chunk);
  }

  let outputPath = '';
  try {
    const result = await bridge.convertFile({
      inputPath,
      sourceFormat,
      targetFormat,
      fileType,
      options,
    });
    outputPath = result.outputPath;

    const parts: ArrayBuffer[] = [];
    for (let offset = 0; offset < result.size; offset += IPC_CHUNK_SIZE) {
      parts.push(await bridge.readChunk(outputPath, offset, Math.min(IPC_CHUNK_SIZE, result.size - offset)));
    }
    return new Blob(parts, { type: OUTPUT_MIME[targetFormat] ?? 'application/octet-stream' });
  } finally {
    try { await bridge.cleanupFile(inputPath); } catch { /* 清理失败可忽略 */ }
    if (outputPath) {
      try { await bridge.cleanupFile(outputPath); } catch { /* 清理失败可忽略 */ }
    }
  }
}

// ============== WASM 路径（Web / Android） ==============

async function transcodeViaWasm(
  blob: Blob,
  sourceFormat: string,
  targetFormat: string,
  extraArgs: string[],
): Promise<Blob> {
  const ff = await getFFmpeg();

  // 大文件防 OOM：输入优先 WORKERFS 零拷贝挂载
  const { inputName, mountDir } = await mountInputFile(ff, blob, sourceFormat);
  const outputName = `ff-out-${Date.now()}.${targetFormat}`;

  const args = ['-i', inputName, ...extraArgs, '-y', outputName];

  try {
    if (!mountDir) {
      await ff.writeFile(inputName, new Uint8Array(await blob.arrayBuffer()));
    }
    await ff.exec(args);
    const data = await ff.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    return new Blob([bytes], { type: OUTPUT_MIME[targetFormat] ?? 'application/octet-stream' });
  } finally {
    await unmountInputFile(ff, mountDir, inputName);
    try { await ff.deleteFile(outputName); } catch { /* 清理失败可忽略 */ }
  }
}

/** 平台感知转码入口：Electron 走原生 IPC，Web/Android 走 WASM */
function isElectronNative(): boolean {
  return getPlatform() === 'electron' && !!window.electronFFmpeg?.isAvailable?.();
}

// ============== 预览解码 ==============

/** 将原始 blob 解码为浏览器可预览的 WAV（音频）/ MP4（视频）/ PNG（图片）blob */
export async function decodeForPreview(blob: Blob, format: string): Promise<Blob> {
  const f = format.toLowerCase();
  const isImage = IMAGE_NEEDS_DECODE.has(f);
  const isVideo = VIDEO_NEEDS_DECODE.has(f);
  const target = previewDecodeTarget(f);

  if (isElectronNative()) {
    // 视频预览转码：ultrafast + 低质量，追求解码速度
    const options = isVideo ? { preset: 'ultrafast', quality: 'low' } : undefined;
    return transcodeViaElectron(blob, f, target, isImage ? 'image' : isVideo ? 'video' : 'audio', options);
  }

  let extraArgs: string[];
  if (isImage) {
    extraArgs = ['-f', 'image2'];
  } else if (isVideo) {
    // 预览转码：ultrafast + CRF30 + 最高 720p，保证 WASM 解码速度；
    // 限 30 分钟，避免超长视频把输出 Blob 撑爆移动端内存
    extraArgs = [
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '128k',
      '-vf', 'scale=-2:min(720\\,ih):flags=bilinear',
      '-t', '1800',
      '-movflags', '+faststart',
    ];
  } else {
    extraArgs = ['-vn', '-ac', '2', '-ar', '44100', '-f', 'wav', '-codec:a', 'pcm_s16le'];
  }
  return transcodeViaWasm(blob, f, target, extraArgs);
}

// ============== 图片真编码（TIFF） ==============

/**
 * 将图片 Blob 经 FFmpeg 转码为指定格式。
 * Canvas 原生不支持 TIFF 编码（旧实现输出的是改了扩展名的 PNG 假 TIFF），
 * 这里经 FFmpeg 用真 TIFF 编码器输出。
 */
export async function transcodeImage(blob: Blob, sourceFormat: string, targetFormat: string): Promise<Blob> {
  if (isElectronNative()) {
    return transcodeViaElectron(blob, sourceFormat, targetFormat, 'image');
  }
  return transcodeViaWasm(blob, sourceFormat, targetFormat, []);
}
