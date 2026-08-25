const { contextBridge, ipcRenderer } = require('electron');

require('./rt/electron-rt');

// ============== 原生 FFmpeg 桥接 ==============

contextBridge.exposeInMainWorld('electronFFmpeg', {
  /**
   * 使用原生 FFmpeg 转换音频/视频
   * @param inputData - 输入文件的 ArrayBuffer
   * @param sourceFormat - 源文件格式扩展名
   * @param targetFormat - 目标格式扩展名
   * @param fileType - 'audio' 或 'video'
   * @param options - 转换选项（比特率、采样率等）
   * @returns 转换后的文件 ArrayBuffer
   */
  convert: (
    inputData: ArrayBuffer,
    sourceFormat: string,
    targetFormat: string,
    fileType: 'audio' | 'video',
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
