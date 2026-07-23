import * as XLSX from 'xlsx';
import type { ConvertTask } from '@/types';

export async function convertSheet(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(10);

  const data = await task.sourceFile.arrayBuffer();
  onProgress(30);

  const workbook = XLSX.read(data, { type: 'array' });
  onProgress(50);

  const targetFormat = task.targetFormat as 'xlsx' | 'csv' | 'ods' | 'html';

  let output: Uint8Array | string;
  let mimeType: string;

  switch (targetFormat) {
    case 'csv': {
      const sheetName = workbook.SheetNames[0];
      output = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      mimeType = 'text/csv';
      break;
    }
    case 'html': {
      const sheetName = workbook.SheetNames[0];
      output = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]);
      mimeType = 'text/html';
      break;
    }
    case 'ods': {
      output = XLSX.write(workbook, { bookType: 'ods', type: 'array' });
      mimeType = 'application/vnd.oasis.opendocument.spreadsheet';
      break;
    }
    case 'xlsx':
    default: {
      output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    }
  }

  onProgress(90);

  const blob = new Blob(
    [output instanceof Uint8Array ? output : new TextEncoder().encode(output)],
    { type: mimeType }
  );

  onProgress(100);
  return blob;
}
