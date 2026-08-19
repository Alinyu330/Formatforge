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
