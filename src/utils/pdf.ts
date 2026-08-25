import { pdfjsLib } from './pdfjs';
import type { ConvertTask } from '@/types';

async function loadPdf(file: File) {
  return pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function getPdfText(file: File, onProgress: (progress: number) => void): Promise<string[]> {
  const pdf = await loadPdf(file);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' ').trim());
    onProgress(Math.round(15 + (pageNumber / pdf.numPages) * 55));
  }
  return pages;
}

async function pdfToImages(file: File, format: 'png' | 'jpeg', onProgress: (progress: number) => void): Promise<Blob> {
  const pdf = await loadPdf(file);
  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext, viewport }).promise;
    images.push(canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92));
    onProgress(Math.round(15 + (pageNumber / pdf.numPages) * 70));
  }
  if (images.length === 1) return (await fetch(images[0])).blob();

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  await Promise.all(images.map(async (image, index) => zip.file(`page-${index + 1}.${format === 'jpeg' ? 'jpg' : 'png'}`, await (await fetch(image)).blob())));
  return zip.generateAsync({ type: 'blob' });
}

async function pdfToDocx(pages: string[]): Promise<Blob> {
  const { Document, Packer, Paragraph } = await import('docx');
  const document = new Document({ sections: [{ children: pages.flatMap((text, index) => [
    new Paragraph({ text: `第 ${index + 1} 页`, heading: 'Heading1' }),
    ...text.split(/\n+/).filter(Boolean).map((line) => new Paragraph(line)),
  ]) }] });
  return Packer.toBlob(document);
}

async function pdfToPptx(pages: string[]): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const presentation = new PptxGenJS();
  presentation.layout = 'LAYOUT_WIDE';
  pages.forEach((text, index) => {
    const slide = presentation.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addText(`第 ${index + 1} 页`, { x: 0.6, y: 0.4, w: 12, h: 0.4, fontSize: 20, bold: true, color: '1F2937' });
    slide.addText(text || '（此页未提取到可编辑文本）', { x: 0.7, y: 1.1, w: 11.9, h: 5.7, fontSize: 15, color: '374151', margin: 0.08, valign: 'top', fit: 'shrink' });
  });
  return presentation.write({ outputType: 'blob' }) as Promise<Blob>;
}

async function pdfToXlsx(pages: string[]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['页码', '文本'], ...pages.map((text, index) => [index + 1, text])]);
  sheet['!cols'] = [{ wch: 10 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'PDF 内容');
  return new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function convertPdf(task: ConvertTask, onProgress: (progress: number) => void): Promise<Blob> {
  const target = task.targetFormat.toLowerCase();
  onProgress(5);
  if (target === 'png' || target === 'jpeg') {
    const result = await pdfToImages(task.sourceFile, target, onProgress);
    onProgress(100);
    return result;
  }

  const pages = await getPdfText(task.sourceFile, onProgress);
  if (target === 'txt') return new Blob([pages.map((text, index) => `=== 第 ${index + 1} 页 ===\n${text}`).join('\n\n')], { type: 'text/plain;charset=utf-8' });
  if (target === 'docx') return pdfToDocx(pages);
  if (target === 'pptx') return pdfToPptx(pages);
  if (target === 'xlsx') return pdfToXlsx(pages);
  throw new Error(`PDF 不支持转换为 ${target.toUpperCase()}`);
}
