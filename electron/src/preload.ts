const { contextBridge, ipcRenderer } = require('electron');

require('./rt/electron-rt');

// ============== 原生 FFmpeg 桥接 ==============

contextBridge.exposeInMainWorld('electronFFmpeg', {
  /**
   * 使用原生 FFmpeg 转换音频/视频（小文件接口：预览解码等）
   * @param inputData - 输入文件的 ArrayBuffer
   * @param sourceFormat - 源文件格式扩展名
   * @param targetFormat - 目标格式扩展名
   * @param fileType - 'audio' | 'video' | 'image'
   * @param options - 转换选项（比特率、采样率等）
   * @returns 转换后的文件 ArrayBuffer
   */
  convert: (
    inputData: ArrayBuffer,
    sourceFormat: string,
    targetFormat: string,
    fileType: 'audio' | 'video' | 'image',
    options?: Record<string, unknown>,
  ): Promise<ArrayBuffer> => {
    return ipcRenderer.invoke('ffmpeg:convert', {
      inputData,
      sourceFormat,
      targetFormat,
      fileType,
      options,
    });
  },

  // ---- 分块协议（大文件防闪退）：避免整文件经 IPC 来回拷贝导致 OOM ----

  /** 创建输入临时文件，返回主进程本地路径 */
  createTempInput: (sourceFormat: string): Promise<string> => {
    return ipcRenderer.invoke('ffmpeg:createTempInput', sourceFormat);
  },

  /** 向临时文件追加一块数据（约 4MB/块） */
  appendChunk: (path: string, chunk: ArrayBuffer): Promise<boolean> => {
    return ipcRenderer.invoke('ffmpeg:appendChunk', path, chunk);
  },

  /** 整体覆写临时文件（用于解密后的小音频） */
  writeBytes: (path: string, data: ArrayBuffer): Promise<boolean> => {
    return ipcRenderer.invoke('ffmpeg:writeBytes', path, data);
  },

  /** 对临时输入文件执行转换，返回输出文件路径与大小（不回传内容） */
  convertFile: (params: {
    inputPath: string;
    sourceFormat: string;
    targetFormat: string;
    fileType: 'audio' | 'video' | 'image';
    options?: Record<string, unknown>;
  }): Promise<{ outputPath: string; size: number }> => {
    return ipcRenderer.invoke('ffmpeg:convertFile', params);
  },

  /** 分块读取输出文件 */
  readChunk: (path: string, offset: number, length: number): Promise<ArrayBuffer> => {
    return ipcRenderer.invoke('ffmpeg:readChunk', path, offset, length);
  },

  /** 删除主进程临时文件 */
  cleanupFile: (path: string): Promise<boolean> => {
    return ipcRenderer.invoke('ffmpeg:cleanupFile', path);
  },

  /** 检查原生 FFmpeg 是否可用 */
  isAvailable: (): boolean => {
    return true; // Electron 环境始终可用
  },
});

console.log('[Preload] 原生 FFmpeg 桥接已注册');

// ============== KGG 密钥数据库桥接 ==============

contextBridge.exposeInMainWorld('electronKGG', {
  /**
   * 从酷狗密钥数据库查询 EncryptionKeyId 对应的 EncryptionKey
   * @param keyId - KGG 文件头中解析出的密钥 ID
   * @returns base64 ekey 字符串，未找到时返回 null
   */
  getKey: (keyId: string): Promise<string | null> => {
    return ipcRenderer.invoke('kgg:getKey', keyId);
  },
});

console.log('[Preload] KGG 密钥数据库桥接已注册');

// ============== 应用内更新桥接 ==============

/** 允许渲染层订阅的更新事件白名单 */
const UPDATER_EVENTS = [
  'updater:available',
  'updater:not-available',
  'updater:progress',
  'updater:downloaded',
  'updater:error',
] as const;

contextBridge.exposeInMainWorld('electronUpdater', {
  /** 当前应用版本号（package.json version） */
  getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
  /** 检查更新；结果（是否更新、版本号）由返回值 + updater:* 事件共同通知 */
  check: (): Promise<{ version: string }> => ipcRenderer.invoke('updater:check'),
  /** 下载更新，进度经 updater:progress 事件通知 */
  download: (): Promise<unknown> => ipcRenderer.invoke('updater:download'),
  /** 下载完成后重启并安装（用户确认后调用） */
  install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
  /** 订阅更新事件，返回取消订阅函数 */
  on: (event: string, callback: (data: unknown) => void): (() => void) => {
    if (!UPDATER_EVENTS.includes(event as (typeof UPDATER_EVENTS)[number])) {
      return () => undefined;
    }
    const listener = (_e: unknown, data: unknown) => callback(data);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
});

console.log('[Preload] 应用内更新桥接已注册');

// ============== 系统浏览器打开外部链接桥接 ==============

contextBridge.exposeInMainWorld('electronShell', {
  /**
   * 在系统默认浏览器打开外部链接（仅本项目站点 https 域名）
   * @param url - 目标链接
   * @returns { ok: true } 成功；{ ok: false, error } 失败
   */
  openExternal: (url: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('shell:openExternal', url),
});

console.log('[Preload] 系统浏览器桥接已注册');
