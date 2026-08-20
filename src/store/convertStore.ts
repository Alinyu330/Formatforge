import { create } from 'zustand';
import type { ConvertTask, ConvertType, ConvertItem, TaskStatus, AudioOptions, ImageOptions, VideoOptions, PdfMergeOptions } from '@/types';
import { getFileExtension, resolveAudioExtension, generateId, stripExtension } from '@/utils/format';
import { convertAudio } from '@/utils/audio';
import { convertVideo } from '@/utils/video';
import { convertSheet } from '@/utils/sheet';
import { convertImage, convertImagesToPdf } from '@/utils/image';
import { convertDocument } from '@/utils/document';
import { convertPdf } from '@/utils/pdf';
import { preloadMediaEngine } from '@/utils/media.adapter.factory';

// ============== 并发调度 ==============
// 音频/视频共用同一个 FFmpeg WASM 实例，必须串行执行以避免竞态
let mediaRunning = false;
// 图片/表格/办公/PDF 转换相互独立，可并行提升多文件吞吐
let nonMediaRunning = 0;
const NON_MEDIA_CONCURRENCY = 4;

/** 全局转换超时：15 分钟（视频转换在 WASM 中可能非常耗时） */
const TASK_TIMEOUT_MS = 900000;

function withTimeout<T>(promise: Promise<T>, fileName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${fileName} 转换超时，文件可能过大，请重试`)), TASK_TIMEOUT_MS)),
  ]);
}

interface ConvertState {
  tasks: ConvertTask[];
  audioOptions: AudioOptions;
  imageOptions: ImageOptions;
  videoOptions: VideoOptions;
  pdfMergeOptions: PdfMergeOptions;
  currentType: ConvertType;
  previewTaskId: string | null;
  previewItemId: string | null;
  sidebarOpen: boolean;

  addFiles: (files: File[], type: ConvertType, formats?: string[]) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  updateTaskFormats: (id: string, formats: string[]) => void;
  renameTask: (id: string, name: string) => void;
  setTaskSelected: (id: string, selected: boolean) => void;
  setAllTasksSelected: (selected: boolean) => void;
  setFormatsForSelected: (formats: string[]) => void;
  setAudioOptions: (opts: Partial<AudioOptions>) => void;
  setImageOptions: (opts: Partial<ImageOptions>) => void;
  setVideoOptions: (opts: Partial<VideoOptions>) => void;
  setPdfMergeOptions: (opts: Partial<PdfMergeOptions>) => void;
  setCurrentType: (type: ConvertType) => void;
  startConversion: () => void;
  downloadItem: (taskId: string, itemId: string) => void;
  downloadTask: (taskId: string) => void;
  downloadAllAsZip: () => Promise<void>;
  mergeImagesToPdf: () => Promise<void>;

  setPreviewTask: (taskId: string | null, itemId?: string | null) => void;
  toggleSidebar: () => void;
  getTaskCounts: () => { pending: number; converting: number; done: number; error: number };
}

function getConversionHandler(task: ConvertTask) {
  if (task.convertType === 'document' && task.sourceFormat.toLowerCase() === 'pdf') return convertPdf;
  switch (task.convertType) {
    case 'audio': return convertAudio;
    case 'video': return convertVideo;
    case 'sheet': return convertSheet;
    case 'image': return convertImage;
    case 'document': return convertDocument;
  }
}

function getMimeType(targetFormat: string, sourceFormat: string): string {
  const ext = targetFormat || sourceFormat;
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'flac': return 'audio/flac';
    case 'wav': return 'audio/wav';
    case 'aac': return 'audio/aac';
    case 'ogg': return 'audio/ogg';
    case 'm4a': return 'audio/mp4';
    case 'wma': return 'audio/x-ms-wma';
    case 'opus': return 'audio/opus';
    case 'alac': return 'audio/mp4';
    case 'ape': return 'audio/ape';
    case 'ac3': return 'audio/ac3';
    case 'eac3': return 'audio/eac3';
    case 'amr': return 'audio/amr';
    case 'aiff': return 'audio/aiff';
    case 'au': return 'audio/basic';
    case 'caf': return 'audio/x-caf';
    case 'webm': return 'video/webm';
    case 'mp4': case 'm4v': return 'video/mp4';
    case 'mkv': return 'video/x-matroska';
    case 'mov': return 'video/quicktime';
    case 'avi': return 'video/x-msvideo';
    case 'flv': return 'video/x-flv';
    case 'wmv': return 'video/x-ms-wmv';
    case 'mpeg': case 'mpg': return 'video/mpeg';
    case '3gp': return 'video/3gpp';
    case 'ts': return 'video/mp2t';
    case 'ogv': return 'video/ogg';
    case 'png': return 'image/png';
    case 'jpeg': case 'jpg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'ico': return 'image/x-icon';
    case 'tiff': case 'tif': return 'image/tiff';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsb': return 'application/vnd.ms-excel.sheet.binary.macroEnabled.12';
    case 'xlsm': return 'application/vnd.ms-excel.sheet.macroEnabled.12';
    case 'csv': return 'text/csv';
    case 'ods': return 'application/vnd.oasis.opendocument.spreadsheet';
    case 'fods': return 'application/vnd.oasis.opendocument.spreadsheet-flat-xml';
    case 'html': case 'htm': return 'text/html';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

export const useConvertStore = create<ConvertState>((set, get) => {
  // 标记某个转换项的状态/进度
  const markItem = (taskId: string, itemId: string, patch: Partial<ConvertItem>) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : t
      ),
    }));
  };

  // 执行单个转换项（媒体/非媒体通用）
  const convertOne = async (task: ConvertTask, item: ConvertItem) => {
    const converter = getConversionHandler(task);
    try {
      const opts = get();
      const taskWithOpts = {
        ...task,
        targetFormat: item.targetFormat,
        sourceFormat: task.sourceFormat,
        targetFormats: [item.targetFormat],
        audioOptions: opts.audioOptions,
        imageOptions: opts.imageOptions,
        videoOptions: opts.videoOptions,
      };

      if (!converter) throw new Error('不支持的转换类型');
      const blob = await withTimeout(
        converter(taskWithOpts as any, (progress: number) => {
          markItem(task.id, item.id, { progress });
        }),
        task.fileName,
      );

      const url = URL.createObjectURL(blob);
      set((s) => {
        const shouldPreview = !s.previewTaskId && !s.previewItemId;
        return {
          tasks: s.tasks.map((t) =>
            t.id === task.id
              ? { ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, status: 'done' as TaskStatus, progress: 100, resultBlob: blob, resultUrl: url } : i)) }
              : t
          ),
          previewTaskId: shouldPreview ? task.id : s.previewTaskId,
          previewItemId: shouldPreview ? item.id : s.previewItemId,
          sidebarOpen: true,
        };
      });
    } catch (err: any) {
      console.warn('[Convert] 转换失败:', task.fileName, '→', item.targetFormat, err);
      markItem(task.id, item.id, { status: 'error' as TaskStatus, error: err.message || '转换失败' });
    }
  };

  // 启动单个转换项，完成后释放槽位并继续调度
  const startOne = (task: ConvertTask, item: ConvertItem) => {
    const isMedia = task.convertType === 'audio' || task.convertType === 'video';
    if (isMedia) mediaRunning = true;
    else nonMediaRunning += 1;

    markItem(task.id, item.id, { status: 'converting' as TaskStatus });

    convertOne(task, item).finally(() => {
      if (isMedia) mediaRunning = false;
      else nonMediaRunning -= 1;
      pump();
    });
  };

  // 调度器：在并发上限内尽量启动所有 pending 项
  const pump = () => {
    const state = get();
    if (mediaRunning && nonMediaRunning >= NON_MEDIA_CONCURRENCY) return;
    for (const task of state.tasks) {
      for (const item of task.items) {
        if (item.status !== 'pending') continue;
        const isMedia = task.convertType === 'audio' || task.convertType === 'video';
        if (isMedia) {
          if (mediaRunning) continue;
        } else if (nonMediaRunning >= NON_MEDIA_CONCURRENCY) {
          continue;
        }
        startOne(task, item);
      }
    }
  };

  return {
  tasks: [],
  currentType: 'audio' as ConvertType,
  audioOptions: { bitrate: '256k', sampleRate: 44100, qmCredentials: { uin: '', authst: '', musicKey: '', rawCookie: '', loginType: '2' } },
  imageOptions: { quality: 0.92 },
  videoOptions: { videoCodec: 'libx264', audioCodec: 'aac', videoBitrate: '2500k', audioBitrate: '192k', preset: 'veryfast', quality: 'medium', resolution: 'original' },
  pdfMergeOptions: { orientation: 'auto', margin: 0 },
  previewTaskId: null,
  previewItemId: null,
  sidebarOpen: false,

  addFiles: (files: File[], type: ConvertType, formats: string[] = []) => {
    const tasks: ConvertTask[] = files.map((file) => ({
      id: generateId(),
      convertType: type,
      fileName: file.name,
      fileSize: file.size,
      sourceFormat: type === 'audio' ? resolveAudioExtension(file.name) : getFileExtension(file.name),
      targetFormat: '',
      items: formats.map((targetFormat) => ({
        id: generateId(),
        targetFormat,
        status: 'pending' as TaskStatus,
        progress: 0,
      })),
      sourceFile: file,
      selected: true,
    }));
    set((s) => ({ tasks: [...s.tasks, ...tasks] }));
  },

  removeTask: (id: string) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (task) {
        task.items.forEach((item) => {
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        });
      }
      return {
        tasks: s.tasks.filter((t) => t.id !== id),
        previewTaskId: s.previewTaskId === id ? null : s.previewTaskId,
      };
    });
  },

  clearTasks: () => {
    const state = get();
    state.tasks.forEach((task) => {
      task.items.forEach((item) => {
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    });
    set({ tasks: [], previewTaskId: null, previewItemId: null });
  },

  updateTaskFormats: (id: string, formats: string[]) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const existingFormats = t.items.map((i) => i.targetFormat);
        const newFormats = formats.filter((f) => !existingFormats.includes(f));
        const removedFormats = existingFormats.filter((f) => !formats.includes(f));
        const items = t.items.filter((i) => !removedFormats.includes(i.targetFormat));
        const newItems: ConvertItem[] = newFormats.map((f) => ({
          id: generateId(),
          targetFormat: f,
          status: 'pending' as TaskStatus,
          progress: 0,
        }));
        return { ...t, items: [...items, ...newItems] };
      }),
    }));
  },

  renameTask: (id, name) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, customName: name } : t)),
    }));
  },

  setTaskSelected: (id, selected) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, selected } : t)),
    }));
  },

  setAllTasksSelected: (selected) => {
    set((s) => ({
      tasks: s.tasks.map((t) => ({ ...t, selected })),
    }));
  },

  setFormatsForSelected: (formats) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.selected
          ? {
              ...t,
              items: formats.map((f) => ({
                id: generateId(),
                targetFormat: f,
                status: 'pending' as TaskStatus,
                progress: 0,
              })),
            }
          : t
      ),
    }));
  },

  setAudioOptions: (opts) => {
    set((s) => ({ audioOptions: { ...s.audioOptions, ...opts } }));
  },

  setImageOptions: (opts) => {
    set((s) => ({ imageOptions: { ...s.imageOptions, ...opts } }));
  },

  setVideoOptions: (opts) => {
    set((s) => ({ videoOptions: { ...s.videoOptions, ...opts } }));
  },

  setPdfMergeOptions: (opts) => {
    set((s) => ({ pdfMergeOptions: { ...s.pdfMergeOptions, ...opts } }));
  },

  setCurrentType: (type) => set({ currentType: type }),

  setPreviewTask: (taskId, itemId = null) => {
    set({ previewTaskId: taskId, previewItemId: itemId, sidebarOpen: !!taskId });
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },

  startConversion: () => {
    pump();
  },

  downloadItem: (taskId: string, itemId: string) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    const item = task?.items.find((i) => i.id === itemId);
    if (!item || !item.resultBlob) return;

    const baseName = (task!.customName && task!.customName.trim()) || stripExtension(task!.fileName);
    const newName = `${baseName}.${item.targetFormat}`;

    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  downloadTask: (taskId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    const item = task?.items.find((i) => i.status === 'done' && i.resultBlob);
    if (item) get().downloadItem(taskId, item.id);
  },

  downloadAllAsZip: async () => {
    const state = get();
    const doneItems: { task: ConvertTask; item: ConvertItem }[] = [];
    for (const task of state.tasks) {
      for (const item of task.items) {
        if (item.status === 'done' && item.resultBlob) {
          doneItems.push({ task, item });
        }
      }
    }
    if (doneItems.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const { task, item } of doneItems) {
      const baseName = (task.customName && task.customName.trim()) || stripExtension(task.fileName);
      zip.file(`${baseName}.${item.targetFormat}`, item.resultBlob!);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  mergeImagesToPdf: async () => {
    const state = get();
    const imageTasks = state.tasks.filter((t) => t.convertType === 'image');
    if (imageTasks.length < 2) return;

    const files = imageTasks.map((t) => t.sourceFile);
    const taskId = generateId();
    const itemId = generateId();
    const fileName = `合并结果 (${files.length} 张图片).pdf`;
    const totalSize = files.reduce((n, f) => n + f.size, 0);

    set((s) => ({
      tasks: [
        ...s.tasks,
        {
          id: taskId,
          convertType: 'image' as ConvertType,
          fileName,
          fileSize: totalSize,
          sourceFormat: 'image',
          targetFormat: 'pdf',
          sourceFile: files[0],
          selected: true,
          items: [{ id: itemId, targetFormat: 'pdf', status: 'converting' as TaskStatus, progress: 0 }],
        },
      ],
    }));

    try {
      const blob = await withTimeout(
        convertImagesToPdf(files, state.imageOptions, state.pdfMergeOptions, (progress) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === taskId
                ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, progress } : i)) }
                : t
            ),
          }));
        }),
        fileName,
      );

      const url = URL.createObjectURL(blob);
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                items: t.items.map((i) =>
                  i.id === itemId
                    ? { ...i, status: 'done' as TaskStatus, progress: 100, resultBlob: blob, resultUrl: url }
                    : i
                ),
              }
            : t
        ),
        previewTaskId: s.previewTaskId ?? taskId,
        previewItemId: s.previewItemId ?? itemId,
        sidebarOpen: true,
      }));
    } catch (err: any) {
      console.warn('[Convert] 合并 PDF 失败:', err);
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                items: t.items.map((i) =>
                  i.id === itemId
                    ? { ...i, status: 'error' as TaskStatus, error: err.message || '合并失败' }
                    : i
                ),
              }
            : t
        ),
      }));
    }
  },

  getTaskCounts: () => {
    const counts = { pending: 0, converting: 0, done: 0, error: 0 };
    get().tasks.forEach((task) => task.items.forEach((item) => { counts[item.status]++; }));
    return counts;
  },
  };
});
