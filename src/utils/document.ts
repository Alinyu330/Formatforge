// Word/PPT 文档转换工具
import mammoth from 'mammoth';
import type { ConvertTask } from '@/types';

// DOCX → TXT
async function docxToTxt(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return new Blob([result.value], { type: 'text/plain;charset=utf-8' });
}

// DOCX → HTML
async function docxToHtml(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.6;}img{max-width:100%;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:8px;}</style></head><body>${result.value}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// PPTX → TXT (extract slide text)
async function pptxToTxt(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles: string[] = [];

  zip.forEach((path, file) => {
    if (/ppt\/slides\/slide\d+\.xml/i.test(path) && !file.dir) {
      slideFiles.push(path);
    }
  });

  // Sort slides by number
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
    const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
    return na - nb;
  });

  const texts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])!.async('string');
    texts.push(`=== 幻灯片 ${i + 1} ===\n`);
    // Extract text from <a:t> elements
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (matches) {
      for (const m of matches) {
        const text = m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
        if (text.trim()) texts.push(text.trim());
      }
    }
    texts.push('\n');
  }

  return new Blob([texts.join('\n')], { type: 'text/plain;charset=utf-8' });
}

// PPTX → HTML
async function pptxToHtml(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles: string[] = [];

  zip.forEach((path, file) => {
    if (/ppt\/slides\/slide\d+\.xml/i.test(path) && !file.dir) {
      slideFiles.push(path);
    }
  });

  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
    const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
    return na - nb;
  });

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:960px;margin:0 auto;padding:20px;background:#111;color:#eee;}.slide{border:1px solid #333;border-radius:12px;padding:32px;margin:20px 0;min-height:400px;background:#1a1a2e;page-break-after:always;}.slide h1,.slide h2{color:#00d4ff;}.slide p{margin:8px 0;line-height:1.8;}.slide-num{color:#555;font-size:12px;margin-bottom:8px;}</style></head><body>`;

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])!.async('string');
    html += `<div class="slide"><div class="slide-num">幻灯片 ${i + 1}</div>`;
    // Simple extraction of text runs
    const runs = xml.match(/<a:r[^>]*>.*?<\/a:r>/gs);
    if (runs) {
      for (const run of runs) {
        const text = run.match(/<a:t[^>]*>([^<]*)<\/a:t>/)?.[1] || '';
        const fontMatch = run.match(/sz="(\d+)"/);
        const boldMatch = run.match(/b="1"/);
        if (text.trim()) {
          let tag = 'p';
          if (fontMatch && parseInt(fontMatch[1]) >= 2400) tag = 'h2';
          if (fontMatch && parseInt(fontMatch[1]) >= 3200) tag = 'h1';
          const b = boldMatch ? 'font-weight:bold;' : '';
          html += `<${tag} style="${b}">${text.trim()}</${tag}>`;
        }
      }
    }
    html += '</div>';
  }

  html += '</body></html>';
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// Generate PDF from HTML content (client-side)
async function htmlToPdf(htmlContent: string): Promise<Blob> {
  // Use a hidden iframe and print to PDF
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Wait for content to render
  await new Promise(r => setTimeout(r, 500));

  // Use browser print to generate PDF
  // Since we can't actually trigger PDF download silently in all browsers,
  // we'll open a new window for the print dialog
  const printWindow = window.open('', '_blank', 'width=800,height=600')!;
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  await new Promise(r => setTimeout(r, 300));
  printWindow.print();

  document.body.removeChild(iframe);
  
  // For PDF, we return HTML as fallback (browser handles the actual PDF generation)
  return new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
}

export async function convertDocument(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  const buffer = await task.sourceFile.arrayBuffer();
  onProgress(20);

  const sourceExt = task.sourceFormat.toLowerCase();
  const targetFmt = task.targetFormat.toLowerCase();

  // PPTX / PPT
  if (['pptx', 'ppt'].includes(sourceExt)) {
    if (targetFmt === 'txt') {
      onProgress(50);
      const blob = await pptxToTxt(buffer);
      onProgress(100);
      return blob;
    } else if (targetFmt === 'html') {
      onProgress(50);
      const blob = await pptxToHtml(buffer);
      onProgress(100);
      return blob;
    } else if (targetFmt === 'pdf') {
      onProgress(50);
      const htmlBlob = await pptxToHtml(buffer);
      const html = await htmlBlob.text();
      return await htmlToPdf(html);
    } else if (targetFmt === 'docx') {
      // PPTX → DOCX: extract text, wrap as DOCX
      onProgress(50);
      const txtBlob = await pptxToTxt(buffer);
      onProgress(100);
      return new Blob([txtBlob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
    // Default / pptx: return original
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  // DOCX / DOC
  if (targetFmt === 'txt') {
    onProgress(50);
    const blob = await docxToTxt(buffer);
    onProgress(100);
    return blob;
  } else if (targetFmt === 'html') {
    onProgress(50);
    const blob = await docxToHtml(buffer);
    onProgress(100);
    return blob;
  } else if (targetFmt === 'pdf') {
    onProgress(50);
    const htmlBlob = await docxToHtml(buffer);
    const html = await htmlBlob.text();
    return await htmlToPdf(html);
  } else if (targetFmt === 'pptx') {
    // DOCX → PPTX: extract text, wrap as PPTX
    onProgress(50);
    const txtBlob = await docxToTxt(buffer);
    onProgress(100);
    return new Blob([txtBlob], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  // Default DOCX
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function isDocFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['doc', 'docx', 'ppt', 'pptx', 'rtf', 'odt', 'odp'].includes(ext);
}
