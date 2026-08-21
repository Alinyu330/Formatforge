/**
 * 预览解码：将浏览器无法原生解码的格式转码为可播放/可显示的格式。
 * - WMA 音频 → WAV（浏览器普遍支持）
 * - TIFF 图片 → PNG（浏览器普遍支持）
 * 复用 FFmpeg WASM 引擎，跨平台（Web / Android / Electron）行为一致。
 */
import { getFFmpeg } from './media.adapter.wasm';

const AUDIO_NEEDS_DECODE = new Set(['wma']);
const IMAGE_NEEDS_DECODE = new Set(['tiff', 'tif']);

/** 判断某格式在浏览器中是否需先经 FFmpeg 转码才能预览 */
export function needsPreviewDecode(format: string): boolean {
  const f = format.toLowerCase();
  return AUDIO_NEEDS_DECODE.has(f) || IMAGE_NEEDS_DECODE.has(f);
}

/** 将原始 blob 解码为浏览器可预览的 WAV（音频）/ PNG（图片）blob */
export async function decodeForPreview(blob: Blob, format: string): Promise<Blob> {
  const f = format.toLowerCase();
  const isImage = IMAGE_NEEDS_DECODE.has(f);
  const ff = await getFFmpeg();

  const inputName = `preview-in-${Date.now()}.${f}`;
  const outputName = `preview-out-${Date.now()}.${isImage ? 'png' : 'wav'}`;

  await ff.writeFile(inputName, new Uint8Array(await blob.arrayBuffer()));

  const args = ['-i', inputName];
  if (isImage) {
    args.push('-f', 'image2');
  } else {
    args.push('-vn', '-ac', '2', '-ar', '44100', '-f', 'wav', '-codec:a', 'pcm_s16le');
  }
  args.push('-y', outputName);

  try {
    await ff.exec(args);
    const data = await ff.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    return new Blob([bytes], { type: isImage ? 'image/png' : 'audio/wav' });
  } finally {
    try { await ff.deleteFile(inputName); } catch { /* 清理失败可忽略 */ }
    try { await ff.deleteFile(outputName); } catch { /* 清理失败可忽略 */ }
  }
}