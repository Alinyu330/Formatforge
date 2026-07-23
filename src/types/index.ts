export type ConvertType = 'audio' | 'sheet' | 'image' | 'document';

export type AudioTargetFormat = 'mp3' | 'flac' | 'wav' | 'aac' | 'ogg' | 'm4a' | 'wma';

export type SheetTargetFormat = 'xlsx' | 'csv' | 'ods' | 'html';

export type ImageTargetFormat = 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'tiff';

export type DocumentTargetFormat = 'docx' | 'txt' | 'html' | 'pdf' | 'pptx';

export type TaskStatus = 'pending' | 'converting' | 'done' | 'error';

export const MAX_CONCURRENT = 10;

export interface AudioOptions {
  bitrate: string;
  sampleRate: number;
}

export interface ImageOptions {
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ConvertItem {
  id: string;
  targetFormat: string;
  status: TaskStatus;
  progress: number;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
}

export interface ConvertTask {
  id: string;
  fileName: string;
  fileSize: number;
  sourceFormat: string;
  targetFormat: string;
  items: ConvertItem[];
  sourceFile: File;
  resultBlob?: Blob;
  resultUrl?: string;
  audioOptions?: AudioOptions;
  imageOptions?: ImageOptions;
}
