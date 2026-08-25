/**
 * Electron 主进程 FFmpeg IPC 处理器
 * 在 Electron 环境中使用原生 ffmpeg.exe 替代 WASM，性能大幅提升
 */
import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';
import os from 'os';

// ============== FFmpeg 路径解析 ==============

function getFFmpegPath(): string {
  // 打包后：ffmpeg.exe 放在 resources 目录下
  // 开发时：放在 electron/resources 目录下
  if (app.isPackaged) {
    return join(process.resourcesPath, 'ffmpeg.exe');
  }
  return join(app.getAppPath(), 'resources', 'ffmpeg.exe');
}

// ============== 参数构建 ==============

// opus 编码器（原生 opus / libopus）仅支持的采样率；其余采样率会导致转换失败
const OPUS_SAMPLE_RATES = [48000, 24000, 16000, 12000, 8000];

function buildAudioArgs(
  inputPath: string,
  outputPath: string,
  targetFormat: string,
  options?: { bitrate?: string; sampleRate?: number },
): string[] {
  const args = ['-i', inputPath, '-vn'];

  // 统一使用 FFmpeg 原生 opus 编码器（与 WASM 端一致，任何构建都内置）
  const codecMap: Record<string, string> = {
    mp3: 'libmp3lame', flac: 'flac', aac: 'aac', m4a: 'aac',
    ogg: 'libvorbis', opus: 'opus', webm: 'opus', wma: 'wmav2', ape: 'ape', ac3: 'ac3', eac3: 'eac3',
    amr: 'libopencore_amrnb',
  };

  const codec = codecMap[targetFormat];
  if (codec) args.push('-codec:a', codec);

  if (targetFormat === 'opus' || targetFormat === 'webm') {
    // opus 编码器不支持 -q:a 质量模式，必须用比特率；
    // 采样率必须是 opus 支持的值（默认 48000，44100 等会导致 "Specified sample rate is not supported"）
    if (codec) args.push('-strict', '-2');
    const rate = options?.sampleRate && OPUS_SAMPLE_RATES.includes(options.sampleRate)
      ? options.sampleRate
      : 48000;
    args.push('-ar', String(rate));
    args.push('-b:a', options?.bitrate && options.bitrate !== 'lossless' ? options.bitrate : '128k');
  } else if (targetFormat === 'flac') {
    args.push('-compression_level', '8');
  } else if (targetFormat === 'ogg') {
    args.push('-q:a', '5');
  } else if (
    options?.bitrate &&
    options.bitrate !== 'lossless' &&
    targetFormat !== 'wav' &&
    targetFormat !== 'aiff' &&
    targetFormat !== 'au' &&
    targetFormat !== 'caf'
  ) {
    args.push('-b:a', options.bitrate);
  }

  if (
    options?.sampleRate &&
    targetFormat !== 'opus' &&
    targetFormat !== 'webm'
  ) {
    args.push('-ar', String(options.sampleRate));
  }

  args.push('-y', outputPath);
  return args;
}

/** 图片转换参数（如 TIFF 预览解码 / 图片格式互转） */
function buildImageArgs(inputPath: string, outputPath: string): string[] {
  return ['-i', inputPath, '-y', outputPath];
}

function buildVideoArgs(
  inputPath: string,
  outputPath: string,
  targetFormat: string,
  options?: { videoBitrate?: string; audioBitrate?: string; width?: number; height?: number; preset?: string; quality?: string; resolution?: string },
): string[] {
  const videoCodecMap: Record<string, string> = {
    mp4: 'libx264', mkv: 'libx264', mov: 'libx264', avi: 'mpeg4',
    flv: 'flv', wmv: 'wmv2', mpeg: 'mpeg2video', mpg: 'mpeg2video',
    m4v: 'libx264', '3gp': 'mpeg4', ts: 'libx264', ogv: 'libtheora', webm: 'libvpx',
  };

  const audioCodecMap: Record<string, string> = {
    mp4: 'aac', mkv: 'aac', mov: 'aac', avi: 'libmp3lame', flv: 'libmp3lame',
    wmv: 'wmav2', mpeg: 'mp2', mpg: 'mp2', m4v: 'aac', '3gp': 'aac',
    ts: 'aac', ogv: 'libvorbis', webm: 'libopus',
  };

  const videoCodec = videoCodecMap[targetFormat] || 'libx264';
  const audioCodec = audioCodecMap[targetFormat] || 'aac';
  const preset = options?.preset || 'veryfast';
  const quality = options?.quality || 'medium';

  const args = ['-i', inputPath, '-c:v', videoCodec, '-c:a', audioCodec];

  // 质量映射：libx264 用 CRF（恒定质量，速度优于固定码率），其余编码器退回固定码率
  const CRF: Record<string, string> = { high: '18', medium: '23', low: '28' };
  const BITRATE: Record<string, string> = { high: '4000k', medium: '2500k', low: '1500k' };

  if (videoCodec === 'libx264') {
    args.push('-preset', preset, '-crf', CRF[quality]);
  } else if (videoCodec === 'libvpx') {
    // libvpx 默认 deadline=good 极慢，realtime + cpu-used 提速数倍
    args.push('-b:v', BITRATE[quality], '-deadline', 'realtime', '-cpu-used', '5');
  } else {
    args.push('-b:v', BITRATE[quality]);
  }

  args.push('-b:a', options?.audioBitrate || '192k');

  const resolution = options?.resolution || 'original';
  if (resolution !== 'original') {
    const height = resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
    args.push('-vf', `scale=-2:${height}:flags=bilinear`);
  } else if (options?.width && options?.height) {
    args.push('-vf', `scale=${options.width}:${options.height}:flags=bilinear`);
  }

  if (targetFormat === 'gif') {
    return ['-i', inputPath, '-vf', 'fps=12,scale=640:-1:flags=lanczos', '-an', '-y', outputPath];
  }

  args.push('-y', outputPath);
  return args;
}

// ============== IPC 处理器注册 ==============

type FileType = 'audio' | 'video' | 'image';

function buildArgs(
  fileType: FileType,
  inputPath: string,
  outputPath: string,
  targetFormat: string,
  options?: Record<string, unknown>,
): string[] {
  if (fileType === 'audio') return buildAudioArgs(inputPath, outputPath, targetFormat, options as any);
  if (fileType === 'image') return buildImageArgs(inputPath, outputPath);
  return buildVideoArgs(inputPath, outputPath, targetFormat, options as any);
}

/** 校验 ffmpeg.exe 存在；不存在时抛出带路径指引的错误 */
function ensureFFmpegAvailable(): string {
  const ffmpegPath = getFFmpegPath();
  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(
      'FFmpeg 引擎未找到。请将 ffmpeg.exe 放置在:\n' +
      (app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')) +
      '\n\n可从 https://github.com/BtbN/FFmpeg-Builds/releases 下载 static 版本'
    );
  }
  return ffmpegPath;
}

/** 运行一次 ffmpeg 转换（输入/输出均为本地临时文件路径） */
function runFFmpeg(
  ffmpegPath: string,
  args: string[],
  cleanupPaths: string[],
): Promise<void> {
  console.log('[Native-FFmpeg] 启动转换:', ffmpegPath, args.join(' '));
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        for (const p of cleanupPaths) { try { fs.unlinkSync(p); } catch {} }
        const errorDetail = stderr.slice(-300) || '未知错误';
        reject(new Error(`FFmpeg 转换失败 (退出码 ${code}): ${errorDetail}`));
        return;
      }
      resolve();
    });

    proc.on('error', (err) => {
      for (const p of cleanupPaths) { try { fs.unlinkSync(p); } catch {} }
      reject(new Error(`无法启动 FFmpeg 进程: ${err.message}\n\n请确保已安装 Visual C++ 运行库，并验证 ffmpeg.exe 是否完整`));
    });
  });
}

export function setupFFmpegIPC(): void {
  // ---- 旧接口：整文件 ArrayBuffer 进出（仅用于小文件：预览解码等）----
  ipcMain.handle('ffmpeg:convert', async (_event, params: {
    inputData: ArrayBuffer;
    sourceFormat: string;
    targetFormat: string;
    fileType: FileType;
    options?: Record<string, unknown>;
  }) => {
    const { inputData, sourceFormat, targetFormat, fileType, options } = params;

    const tmpDir = os.tmpdir();
    const inputPath = join(tmpDir, `ff_in_${Date.now()}.${sourceFormat}`);
    const outputPath = join(tmpDir, `ff_out_${Date.now()}.${targetFormat}`);

    fs.writeFileSync(inputPath, Buffer.from(inputData));
    ensureFFmpegAvailable();

    const args = buildArgs(fileType, inputPath, outputPath, targetFormat, options);
    try {
      await runFFmpeg(getFFmpegPath(), args, [inputPath, outputPath]);
      try { fs.unlinkSync(inputPath); } catch {}
      const outputData = fs.readFileSync(outputPath);
      try { fs.unlinkSync(outputPath); } catch {}
      return outputData.buffer.slice(
        outputData.byteOffset,
        outputData.byteOffset + outputData.byteLength,
      );
    } catch (err) {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      throw err;
    }
  });

  // ---- 分块协议（大文件防闪退）：输入分块写入临时文件，输出分块读回 ----
  // 旧方案把整个文件经 IPC 来回拷贝（渲染进程 + 主进程各持有完整副本），
  // 1GB 视频峰值内存可达 4~5GB，直接把客户端顶到 OOM 闪退。

  ipcMain.handle('ffmpeg:createTempInput', (_event, sourceFormat: string) => {
    ensureFFmpegAvailable();
    return join(os.tmpdir(), `ff_in_${Date.now()}.${sourceFormat}`);
  });

  ipcMain.handle('ffmpeg:appendChunk', (_event, path: string, chunk: ArrayBuffer) => {
    fs.appendFileSync(path, Buffer.from(chunk));
    return true;
  });

  ipcMain.handle('ffmpeg:writeBytes', (_event, path: string, data: ArrayBuffer) => {
    fs.writeFileSync(path, Buffer.from(data));
    return true;
  });

  ipcMain.handle('ffmpeg:convertFile', async (_event, params: {
    inputPath: string;
    sourceFormat: string;
    targetFormat: string;
    fileType: FileType;
    options?: Record<string, unknown>;
  }) => {
    const { inputPath, targetFormat, fileType, options } = params;
    ensureFFmpegAvailable();
    const outputPath = join(os.tmpdir(), `ff_out_${Date.now()}.${targetFormat}`);
    const args = buildArgs(fileType, inputPath, outputPath, targetFormat, options);
    try {
      await runFFmpeg(getFFmpegPath(), args, [inputPath, outputPath]);
      const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
      if (size === 0) throw new Error('转换输出为空（0B），源文件可能已损坏或格式不受支持');
      return { outputPath, size };
    } catch (err) {
      try { fs.unlinkSync(outputPath); } catch {}
      throw err;
    }
  });

  ipcMain.handle('ffmpeg:readChunk', (_event, path: string, offset: number, length: number) => {
    const fd = fs.openSync(path, 'r');
    try {
      const buf = Buffer.alloc(length);
      const bytesRead = fs.readSync(fd, buf, 0, length, offset);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  });

  ipcMain.handle('ffmpeg:cleanupFile', (_event, path: string) => {
    try { fs.unlinkSync(path); } catch {}
    return true;
  });
}
