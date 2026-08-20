export type ConvertType = 'audio' | 'video' | 'sheet' | 'image' | 'document';

export type AudioTargetFormat = 'mp3' | 'flac' | 'wav' | 'aac' | 'ogg' | 'm4a' | 'wma' | 'opus' | 'alac' | 'ape' | 'ac3' | 'eac3' | 'amr' | 'aiff' | 'au' | 'caf' | 'webm';
export type VideoTargetFormat = 'mp4' | 'mkv' | 'webm' | 'mov' | 'avi' | 'flv' | 'wmv' | 'mpeg' | 'mpg' | 'm4v' | '3gp' | 'ts' | 'ogv' | 'gif';
export type SheetTargetFormat = 'xlsx' | 'xls' | 'xlsb' | 'xlsm' | 'ods' | 'fods' | 'csv' | 'txt' | 'html';
export type ImageTargetFormat = 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'tiff' | 'pdf';
export type DocumentTargetFormat = 'docx' | 'pptx' | 'txt' | 'html' | 'pdf';

export type TaskStatus = 'pending' | 'converting' | 'done' | 'error';
export const MAX_CONCURRENT = 50;

export interface QmAudioCredentials {
  uin: string;
  authst?: string;
  musicKey?: string;
  rawCookie?: string;
  loginType: '1' | '2' | '3';
}

export interface AudioOptions {
  bitrate: string;
  sampleRate: number;
  qmCredentials?: QmAudioCredentials;
}
export interface VideoOptions {
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  width?: number;
  height?: number;
}
export interface ImageOptions { quality: number; maxWidth?: number; maxHeight?: number; }
export interface PdfMergeOptions { orientation: 'auto' | 'portrait' | 'landscape'; margin: number; }

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
  convertType: ConvertType;
  items: ConvertItem[];
  sourceFile: File;
  resultBlob?: Blob;
  resultUrl?: string;
  audioOptions?: AudioOptions;
  imageOptions?: ImageOptions;
  videoOptions?: VideoOptions;
}
