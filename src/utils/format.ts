import type { ConvertType } from '@/types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/** 判断某个文件名片段是否为 QQ 音乐加密扩展名（支持可变数字，如 mgg2 / mflac0 / qmc3 / tkm4 等）。 */
export function isQQMusicEncryptedExt(part: string): boolean {
  if (/^mgg\d*$/.test(part)) return true;    // mgg / mgg1 / mgg2 ...
  if (/^mflac\d*$/.test(part)) return true;  // mflac / mflac0 / mflac1 ...
  if (/^qmc(?:flac|ogg|\d+)$/.test(part)) return true; // qmc0 / qmc3 / qmcflac / qmcogg ...
  if (/^tkm\d*$/.test(part)) return true;    // tkm / tkm3 / tkm4 ...
  return part === 'bkcmp3' || part === 'bkcflac';
}

/** 解析音频源格式扩展名，兼容双重后缀（如 歌名.mflac.flac → mflac、歌名.qmcflac.flac → qmcflac）。 */
export function resolveAudioExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (AUDIO_ENCRYPTED_EXTENSIONS.includes(parts[i]) || isQQMusicEncryptedExt(parts[i])) return parts[i];
  }
  return getFileExtension(filename);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'ape', 'wv', 'aiff', 'alac', 'ac3', 'eac3', 'amr', 'au', 'caf', 'webm'];
export const QQ_MUSIC_ENCRYPTED_EXTENSIONS = ['qmc0', 'qmc3', 'qmc4', 'qmc6', 'qmc8', 'qmcflac', 'mgg', 'mgg1', 'mflac', 'mflac0', 'bkcmp3', 'bkcflac', 'tkm', 'tkm3', 'tkm4', 'qmcogg'];
export const NETEASE_MUSIC_ENCRYPTED_EXTENSIONS = ['ncm'];
export const KUGOU_MUSIC_ENCRYPTED_EXTENSIONS = ['kgm', 'kgma', 'kwm', 'vpr', 'kgg'];
export const AUDIO_ENCRYPTED_EXTENSIONS = [...QQ_MUSIC_ENCRYPTED_EXTENSIONS, ...NETEASE_MUSIC_ENCRYPTED_EXTENSIONS, ...KUGOU_MUSIC_ENCRYPTED_EXTENSIONS];
export const ALL_AUDIO_EXTENSIONS = [...AUDIO_EXTENSIONS, ...AUDIO_ENCRYPTED_EXTENSIONS];
export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ts', 'ogv'];
export const SHEET_EXTENSIONS = ['xlsx', 'xls', 'csv', 'ods', 'html', 'htm'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'gif', 'svg'];
export const WORD_EXTENSIONS = ['docx'];
export const POWERPOINT_EXTENSIONS = ['pptx'];
export const DOCUMENT_EXTENSIONS = [...WORD_EXTENSIONS, ...POWERPOINT_EXTENSIONS, 'pdf'];

export const AUDIO_MIME_MAP: Record<string, string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'], flac: ['audio/flac', 'audio/x-flac'], wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  aac: ['audio/aac', 'audio/x-aac'], ogg: ['audio/ogg', 'audio/opus'], m4a: ['audio/mp4', 'audio/x-m4a'], wma: ['audio/x-ms-wma'],
};
export const SHEET_MIME_MAP: Record<string, string[]> = {
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], xls: ['application/vnd.ms-excel'], csv: ['text/csv'], ods: ['application/vnd.oasis.opendocument.spreadsheet'], html: ['text/html'],
};
export const IMAGE_MIME_MAP: Record<string, string[]> = {
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], webp: ['image/webp'], bmp: ['image/bmp'], ico: ['image/x-icon', 'image/vnd.microsoft.icon'], tiff: ['image/tiff'], tif: ['image/tiff'], gif: ['image/gif'], svg: ['image/svg+xml'],
};

export function detectConvertType(file: File): ConvertType | null {
  const parts = file.name.toLowerCase().split('.');
  const ext = parts[parts.length - 1] || '';
  const mime = file.type;
  const hasEncryptedAudio = parts.slice(1).some((part) => AUDIO_ENCRYPTED_EXTENSIONS.includes(part) || isQQMusicEncryptedExt(part));
  if (AUDIO_EXTENSIONS.includes(ext) || hasEncryptedAudio) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext) || mime.startsWith('video/')) return 'video';
  if (SHEET_EXTENSIONS.includes(ext)) return 'sheet';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return null;
}
