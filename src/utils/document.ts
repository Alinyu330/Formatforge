import mammoth from 'mammoth';
import type { ConvertTask } from '@/types';

async function docxToTxt(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return new Blob([result.value], { type: 'text/plain;charset=utf-8' });
}

async function docxToHtml(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.6;}img{max-width:100%;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:8px;}</style></head><body>${result.value}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const character of text) {
    const nextLine = line + character;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = nextLine;
    }
  }
  lines.push(line);
  return lines;
}

async function docxToPdf(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const result = await mammoth.extractRawText({ arrayBuffer });
  const pageWidth = 1240;
  const pageHeight = 1754;
  const margin = 90;
  const lineHeight = 46;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  let isFirstPage = true;
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let y: number;

  const createPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageWidth, pageHeight);
    context.fillStyle = '#111111';
    context.font = '30px sans-serif';
    context.textBaseline = 'top';
    y = margin;
  };

  const savePage = () => {
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    isFirstPage = false;
  };

  createPage();
  const paragraphs = result.value.replace(/\r\n/g, '\n').split('\n');
  for (const paragraph of paragraphs) {
    const lines = paragraph ? wrapText(context, paragraph, pageWidth - margin * 2) : [''];
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        savePage();
        createPage();
      }
      if (line) context.fillText(line, margin, y);
      y += lineHeight;
    }
  }
  savePage();
  return pdf.output('blob');
}

function decodeXmlText(text: string): string {
  const doc = new DOMParser().parseFromString(`<root>${text}</root>`, 'application/xml');
  return doc.documentElement.textContent || '';
}

async function getPptxSlides(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));

  const slides: string[][] = [];
  for (const path of slideFiles) {
    const xml = await zip.file(path)!.async('string');
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlText(match[1]));
    slides.push(texts.filter((text) => text.trim()));
  }
  return slides;
}

async function pptxToTxt(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const slides = await getPptxSlides(arrayBuffer);
  const text = slides.map((lines, index) => `=== 幻灯片 ${index + 1} ===\n${lines.join('\n')}`).join('\n\n');
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function pptxToHtml(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const slides = await getPptxSlides(arrayBuffer);
  const content = slides.map((lines, index) => `<section class="slide"><div class="slide-num">幻灯片 ${index + 1}</div>${lines.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}</section>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:960px;margin:0 auto;padding:20px;background:#111;color:#eee}.slide{border:1px solid #333;border-radius:12px;padding:32px;margin:20px 0;min-height:300px;background:#1a1a2e}.slide p{line-height:1.8}.slide-num{color:#888;font-size:12px}</style></head><body>${content}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

export async function convertDocument(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const sourceExt = task.sourceFormat.toLowerCase();
  const targetFmt = task.targetFormat.toLowerCase();
  if (!['docx', 'pptx'].includes(sourceExt)) {
    throw new Error(`不支持解析 ${sourceExt.toUpperCase()}，仅支持 DOCX 和 PPTX`);
  }
  const targetFormats = sourceExt === 'docx' ? ['txt', 'html', 'pdf', sourceExt] : ['txt', 'html', sourceExt];
  if (!targetFormats.includes(targetFmt)) {
    throw new Error(`${sourceExt.toUpperCase()} 不支持转换为 ${targetFmt.toUpperCase()}`);
  }

  const buffer = await task.sourceFile.arrayBuffer();
  onProgress(30);
  if (targetFmt === sourceExt) {
    onProgress(100);
    const mime = sourceExt === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return new Blob([buffer], { type: mime });
  }

  onProgress(60);
  const blob = sourceExt === 'docx'
    ? targetFmt === 'txt' ? await docxToTxt(buffer) : targetFmt === 'html' ? await docxToHtml(buffer) : await docxToPdf(buffer)
    : targetFmt === 'txt' ? await pptxToTxt(buffer) : await pptxToHtml(buffer);
  onProgress(100);
  return blob;
}

export function isDocFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['docx', 'pptx'].includes(ext);
}
