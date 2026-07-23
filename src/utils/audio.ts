import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConvertTask } from '@/types';
import { isQMCFile, decryptQMC } from './qmc';
import { isNCMFile, decryptNCM } from './ncm';
import { isKGMFile, decryptKGM } from './kgm';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.debug('[FFmpeg]', message);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export function isEncryptedFormat(filename: string): boolean {
  return isQMCFile(filename) || isNCMFile(filename) || isKGMFile(filename);
}

export async function convertAudio(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const ff = await getFFmpeg();

  let inputData: Uint8Array;
  let actualSourceFormat = task.sourceFormat;

  // Check if the file is an encrypted format and needs decryption first
  if (isQMCFile(task.fileName)) {
    onProgress(2);
    const raw = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(10);
    const result = await decryptQMC(raw);
    inputData = result.data;
    actualSourceFormat = result.ext;
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
  } else {
    // Standard format: read file directly
    onProgress(5);
    inputData = new Uint8Array(await task.sourceFile.arrayBuffer());
    onProgress(15);
  }

  const inputName = `input.${actualSourceFormat}`;
  const outputName = `output.${task.targetFormat}`;

  await ff.writeFile(inputName, inputData);

  const args: string[] = ['-i', inputName];

  // Audio-specific options
  if (task.audioOptions) {
    if (task.targetFormat === 'mp3') {
      args.push('-codec:a', 'libmp3lame');
      args.push('-b:a', task.audioOptions.bitrate);
    } else if (task.targetFormat === 'flac') {
      args.push('-codec:a', 'flac');
      args.push('-compression_level', '8');
    } else if (task.targetFormat === 'aac' || task.targetFormat === 'm4a') {
      args.push('-codec:a', 'aac');
      args.push('-b:a', task.audioOptions.bitrate);
    } else if (task.targetFormat === 'ogg') {
      args.push('-codec:a', 'libvorbis');
      args.push('-q:a', '5');
    } else if (task.targetFormat === 'wma') {
      args.push('-codec:a', 'wmav2');
      args.push('-b:a', task.audioOptions.bitrate);
    }

    if (task.audioOptions.sampleRate) {
      args.push('-ar', String(task.audioOptions.sampleRate));
    }
  }

  args.push('-y', outputName);

  ff.on('progress', ({ progress }) => {
    const baseProgress = isQMCFile(task.fileName) || isNCMFile(task.fileName) || isKGMFile(task.fileName) ? 30 : 15;
    const pct = Math.round(baseProgress + progress * (100 - baseProgress));
    onProgress(pct);
  });

  await ff.exec(args);

  const data = await ff.readFile(outputName);
  const blob = new Blob([data], {
    type: task.targetFormat === 'mp3' ? 'audio/mpeg' :
          task.targetFormat === 'flac' ? 'audio/flac' :
          task.targetFormat === 'wav' ? 'audio/wav' :
          task.targetFormat === 'aac' ? 'audio/aac' :
          task.targetFormat === 'ogg' ? 'audio/ogg' :
          task.targetFormat === 'm4a' ? 'audio/mp4' :
          'audio/mpeg',
  });

  // Cleanup
  try { await ff.deleteFile(inputName); } catch {}
  try { await ff.deleteFile(outputName); } catch {}

  onProgress(100);
  return blob;
}
