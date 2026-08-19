import * as XLSX from 'xlsx';
import type { ConvertTask, SheetTargetFormat } from '@/types';

const MIME_TYPES: Record<SheetTargetFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  fods: 'application/vnd.oasis.opendocument.spreadsheet-flat-xml',
  csv: 'text/csv;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  html: 'text/html;charset=utf-8',
};

export async function convertSheet(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(10);
  const data = await task.sourceFile.arrayBuffer();
  onProgress(30);
  const workbook = XLSX.read(data, { type: 'array' });
  onProgress(50);

  const targetFormat = task.targetFormat as SheetTargetFormat;
  if (!(targetFormat in MIME_TYPES)) {
    throw new Error(`不支持表格转换为 ${targetFormat.toUpperCase()}`);
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  let output: ArrayBuffer | string;
  if (targetFormat === 'csv') {
    output = XLSX.utils.sheet_to_csv(firstSheet);
  } else if (targetFormat === 'txt') {
    output = XLSX.utils.sheet_to_txt(firstSheet);
  } else if (targetFormat === 'html') {
    output = XLSX.utils.sheet_to_html(firstSheet);
  } else {
    output = XLSX.write(workbook, { bookType: targetFormat, type: 'array' });
  }

  onProgress(90);
  const blob = new Blob([output], { type: MIME_TYPES[targetFormat] });
  onProgress(100);
  return blob;
}
