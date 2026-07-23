import { create } from 'zustand';
import type { ConvertTask, ConvertType, ConvertItem, TaskStatus, AudioOptions, ImageOptions } from '@/types';
import { MAX_CONCURRENT } from '@/types';
import { getFileExtension, generateId } from '@/utils/format';
import { convertAudio } from '@/utils/audio';
import { convertSheet } from '@/utils/sheet';
import { convertImage } from '@/utils/image';
import { convertDocument } from '@/utils/document';

interface ConvertState {
  tasks: ConvertTask[];
  isProcessing: boolean;
  audioOptions: AudioOptions;
  imageOptions: ImageOptions;
  currentType: ConvertType;
  previewTaskId: string | null;
  previewItemId: string | null;
  sidebarOpen: boolean;

  addFiles: (files: File[], type: ConvertType) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  updateTaskFormats: (id: string, formats: string[]) => void;
  setAudioOptions: (opts: Partial<AudioOptions>) => void;
  setImageOptions: (opts: Partial<ImageOptions>) => void;
  setCurrentType: (type: ConvertType) => void;
  startConversion: () => Promise<void>;
  downloadItem: (taskId: string, itemId: string) => void;
  downloadTask: (taskId: string) => void;
  downloadAllAsZip: () => Promise<void>;

  setPreviewTask: (taskId: string | null, itemId?: string | null) => void;
  toggleSidebar: () => void;
  getTaskCounts: () => { pending: number; converting: number; done: number; error: number };
}

function getConversionHandler(type: ConvertType) {
  switch (type) {
    case 'audio': return convertAudio;
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
    case 'png': return 'image/png';
    case 'jpeg': case 'jpg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'ico': return 'image/x-icon';
    case 'tiff': case 'tif': return 'image/tiff';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv': return 'text/csv';
    case 'ods': return 'application/vnd.oasis.opendocument.spreadsheet';
    case 'html': case 'htm': return 'text/html';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt': return 'text/plain';
    case 'pdf': return 'application/pdf';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default: return 'application/octet-stream';
  }
}

export const useConvertStore = create<ConvertState>((set, get) => ({
  tasks: [],
  isProcessing: false,
  currentType: 'audio' as ConvertType,
  audioOptions: { bitrate: '256k', sampleRate: 44100 },
  imageOptions: { quality: 0.92 },
  previewTaskId: null,
  previewItemId: null,
  sidebarOpen: false,

  addFiles: (files: File[], type: ConvertType) => {
    const tasks: ConvertTask[] = files.map((file) => ({
      id: generateId(),
      fileName: file.name,
      fileSize: file.size,
      sourceFormat: getFileExtension(file.name),
      targetFormat: '',
      items: [] as ConvertItem[],
      sourceFile: file,
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
        // Keep already completed items, add new pending ones for new formats
        const existingFormats = t.items.map((i) => i.targetFormat);
        const newFormats = formats.filter((f) => !existingFormats.includes(f));
        const removedFormats = existingFormats.filter((f) => !formats.includes(f));
        let items = t.items.filter((i) => !removedFormats.includes(i.targetFormat));
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

  setAudioOptions: (opts) => {
    set((s) => ({ audioOptions: { ...s.audioOptions, ...opts } }));
  },

  setImageOptions: (opts) => {
    set((s) => ({ imageOptions: { ...s.imageOptions, ...opts } }));
  },

  setCurrentType: (type) => set({ currentType: type }),

  setPreviewTask: (taskId, itemId = null) => {
    set({ previewTaskId: taskId, previewItemId: itemId, sidebarOpen: !!taskId });
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },

  startConversion: async () => {
    const state = get();
    if (state.isProcessing) return;

    // Collect all pending items across all tasks, limit to MAX_CONCURRENT
    const pendingItems: { task: ConvertTask; item: ConvertItem }[] = [];
    for (const task of state.tasks) {
      for (const item of task.items) {
        if (item.status === 'pending') {
          pendingItems.push({ task, item });
          if (pendingItems.length >= MAX_CONCURRENT) break;
        }
      }
      if (pendingItems.length >= MAX_CONCURRENT) break;
    }

    if (pendingItems.length === 0) return;
    set({ isProcessing: true });

    const converter = getConversionHandler(state.currentType);

    for (const { task, item } of pendingItems) {
      // Mark as converting
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            items: t.items.map((i) =>
              i.id === item.id ? { ...i, status: 'converting' as TaskStatus } : i
            ),
          };
        }),
      }));

      try {
        // Build task-like object with single target format for the converter
        const taskWithOpts = {
          ...task,
          targetFormat: item.targetFormat,
          sourceFormat: task.sourceFormat,
          targetFormats: [item.targetFormat],
          audioOptions: state.audioOptions,
          imageOptions: state.imageOptions,
        };

        const blob = await converter(taskWithOpts as any, (progress) => {
          set((s) => ({
            tasks: s.tasks.map((t) => {
              if (t.id !== task.id) return t;
              return {
                ...t,
                items: t.items.map((i) =>
                  i.id === item.id ? { ...i, progress } : i
                ),
              };
            }),
          }));
        });

        const url = URL.createObjectURL(blob);
        set((s) => {
          // Auto-show preview when first item completes
          const shouldPreview = !s.previewTaskId && !s.previewItemId;
          return {
            tasks: s.tasks.map((t) => {
              if (t.id !== task.id) return t;
              return {
                ...t,
                items: t.items.map((i) =>
                  i.id === item.id
                    ? { ...i, status: 'done' as TaskStatus, progress: 100, resultBlob: blob, resultUrl: url }
                    : i
                ),
              };
            }),
            previewTaskId: shouldPreview ? task.id : s.previewTaskId,
            previewItemId: shouldPreview ? item.id : s.previewItemId,
            sidebarOpen: true,
          };
        });
      } catch (err: any) {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== task.id) return t;
            return {
              ...t,
              items: t.items.map((i) =>
                i.id === item.id
                  ? { ...i, status: 'error' as TaskStatus, error: err.message || '转换失败' }
                  : i
              ),
            };
          }),
        }));
      }
    }

    set({ isProcessing: false });
  },

  downloadItem: (taskId: string, itemId: string) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    const item = task?.items.find((i) => i.id === itemId);
    if (!item || !item.resultBlob) return;

    const baseName = task!.fileName.replace(/\.[^/.]+$/, '');
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
    const doneItems: { taskName: string; item: ConvertItem }[] = [];
    for (const task of state.tasks) {
      for (const item of task.items) {
        if (item.status === 'done' && item.resultBlob) {
          doneItems.push({ taskName: task.fileName, item });
        }
      }
    }
    if (doneItems.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const { taskName, item } of doneItems) {
      const baseName = taskName.replace(/\.[^/.]+$/, '');
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

  getTaskCounts: () => {
    const tasks = get().tasks;
    let pending = 0, converting = 0, done = 0, error = 0;
    for (const t of tasks) {
      for (const i of t.items) {
        switch (i.status) {
          case 'pending': pending++; break;
          case 'converting': converting++; break;
          case 'done': done++; break;
          case 'error': error++; break;
        }
      }
    }
    return { pending, converting, done, error };
  },
}));
