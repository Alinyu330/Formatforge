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

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'ape', 'wv', 'aiff', 'alac'];
export const AUDIO_ENCRYPTED_EXTENSIONS = ['qmc0', 'qmc3', 'qmc4', 'qmc6', 'qmc8', 'qmcflac', 'mgg', 'mgg1', 'mflac', 'mflac0', 'bkcmp3', 'bkcflac', 'tkm', 'tkm3', 'tkm4', 'ncm', 'kgm', 'kgma', 'kwm', 'vpr'];
export const ALL_AUDIO_EXTENSIONS = [...AUDIO_EXTENSIONS, ...AUDIO_ENCRYPTED_EXTENSIONS];
export const SHEET_EXTENSIONS = ['xlsx', 'xls', 'csv', 'ods', 'html', 'htm'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'gif', 'svg'];
export const DOC_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'rtf', 'odt', 'odp'];

export const AUDIO_MIME_MAP: Record<string, string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  flac: ['audio/flac', 'audio/x-flac'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  aac: ['audio/aac', 'audio/x-aac'],
  ogg: ['audio/ogg', 'audio/opus'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  wma: ['audio/x-ms-wma'],
};

export const SHEET_MIME_MAP: Record<string, string[]> = {
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  csv: ['text/csv'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  html: ['text/html'],
};

export const IMAGE_MIME_MAP: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  bmp: ['image/bmp'],
  ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
  tiff: ['image/tiff'],
  tif: ['image/tiff'],
  gif: ['image/gif'],
  svg: ['image/svg+xml'],
};

export function detectConvertType(file: File): ConvertType | null {
  const ext = getFileExtension(file.name);
  const mime = file.type;

  if (AUDIO_EXTENSIONS.includes(ext) || AUDIO_ENCRYPTED_EXTENSIONS.includes(ext)) return 'audio';
  if (SHEET_EXTENSIONS.includes(ext)) return 'sheet';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (DOC_EXTENSIONS.includes(ext)) return 'document';

  // Try MIME-based detection
  for (const [format, mimes] of Object.entries(AUDIO_MIME_MAP)) {
    if (mimes.some(m => mime.startsWith(m.split('/')[0] + '/') || mime === m)) return 'audio';
  }
  for (const [format, mimes] of Object.entries(SHEET_MIME_MAP)) {
    if (mimes.some(m => mime === m)) return 'sheet';
  }
  for (const [format, mimes] of Object.entries(IMAGE_MIME_MAP)) {
    if (mimes.some(m => mime === m)) return 'image';
  }

  return null;
}
