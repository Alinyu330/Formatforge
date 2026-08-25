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

function buildAudioArgs(
  inputPath: string,
  outputPath: string,
  targetFormat: string,
  options?: { bitrate?: string; sampleRate?: number },
): string[] {
  const args = ['-i', inputPath, '-vn'];

  const codecMap: Record<string, string> = {
    mp3: 'libmp3lame', flac: 'flac', aac: 'aac', m4a: 'aac',
    ogg: 'libvorbis', opus: 'libopus', wma: 'wmav2', ape: 'ape', ac3: 'ac3', eac3: 'eac3',
    amr: 'libopencore_amrnb',
  };

  const codec = codecMap[targetFormat];
  if (codec) args.push('-codec:a', codec);

  if (targetFormat === 'flac') {
    args.push('-compression_level', '8');
  } else if (targetFormat === 'ogg' || targetFormat === 'opus') {
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

  if (options?.sampleRate) args.push('-ar', String(options.sampleRate));

  args.push('-y', outputPath);
  return args;
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

export function setupFFmpegIPC(): void {
  ipcMain.handle('ffmpeg:convert', async (_event, params: {
    inputData: ArrayBuffer;
    sourceFormat: string;
    targetFormat: string;
    fileType: 'audio' | 'video';
    options?: Record<string, unknown>;
  }) => {
    const { inputData, sourceFormat, targetFormat, fileType, options } = params;

    const tmpDir = os.tmpdir();
    const inputPath = join(tmpDir, `ff_in_${Date.now()}.${sourceFormat}`);
    const outputPath = join(tmpDir, `ff_out_${Date.now()}.${targetFormat}`);

    // 写入输入文件
    fs.writeFileSync(inputPath, Buffer.from(inputData));

    const ffmpegPath = getFFmpegPath();

    // 检查 ffmpeg 是否存在
    if (!fs.existsSync(ffmpegPath)) {
      try { fs.unlinkSync(inputPath); } catch {}
      throw new Error(
        'FFmpeg 引擎未找到。请将 ffmpeg.exe 放置在:\n' +
        (app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')) +
        '\n\n可从 https://github.com/BtbN/FFmpeg-Builds/releases 下载 static 版本'
      );
    }

    const args = fileType === 'audio'
      ? buildAudioArgs(inputPath, outputPath, targetFormat, options as any)
      : buildVideoArgs(inputPath, outputPath, targetFormat, options as any);

    console.log('[Native-FFmpeg] 启动转换:', ffmpegPath, args.join(' '));

    return new Promise<ArrayBuffer>((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { windowsHide: true });

      let stderr = '';
      let progress = 0;

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;

        // 从 ffmpeg stderr 解析进度（ffmpeg 进度信息输出到 stderr）
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (timeMatch) {
          progress = Math.round((parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3])) / 10);
        }
      });

      proc.on('close', (code: number) => {
        // 清理输入文件
        try { fs.unlinkSync(inputPath); } catch {}

        if (code !== 0) {
          try { fs.unlinkSync(outputPath); } catch {}
          const errorDetail = stderr.slice(-300) || '未知错误';
          reject(new Error(`FFmpeg 转换失败 (退出码 ${code}): ${errorDetail}`));
          return;
        }

        try {
          const outputData = fs.readFileSync(outputPath);
          try { fs.unlinkSync(outputPath); } catch {}
          // 返回 ArrayBuffer（会被 Electron IPC 序列化）
          resolve(outputData.buffer.slice(
            outputData.byteOffset,
            outputData.byteOffset + outputData.byteLength,
          ));
        } catch (err: any) {
          reject(new Error(`读取转换结果失败: ${err.message}`));
        }
      });

      proc.on('error', (err) => {
        try { fs.unlinkSync(inputPath); } catch {}
        try { fs.unlinkSync(outputPath); } catch {}
        reject(new Error(`无法启动 FFmpeg 进程: ${err.message}\n\n请确保已安装 Visual C++ 运行库，并验证 ffmpeg.exe 是否完整`));
      });
    });
  });
}
