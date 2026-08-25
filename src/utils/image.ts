import type { ConvertTask, ImageOptions, PdfMergeOptions } from '@/types';

export async function convertImage(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(10);

  const canvas = await renderImageToCanvas(task.sourceFile, task.imageOptions, task.rotation ?? 0);
  onProgress(60);

  const quality = task.imageOptions?.quality ?? 0.92;
  const format = task.targetFormat as string;

  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const { width, height } = canvas;
    const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width, height] });
    pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, width, height);
    onProgress(100);
    return pdf.output('blob');
  }

  if (format === 'tiff' || format === 'tif') {
    // Canvas 原生不支持 TIFF 编码：先导出 PNG，再经 FFmpeg 真编码为 TIFF
    // （旧实现输出的是改了扩展名的 PNG 假 TIFF，专业软件无法识别）
    const pngBlob = await canvasToBlob(canvas, 'image/png', quality);
    onProgress(75);
    const { transcodeImage } = await import('./preview');
    const tiffBlob = await transcodeImage(pngBlob, 'png', format);
    onProgress(100);
    return tiffBlob;
  }

  let mimeType: string;
  if (format === 'jpeg' || format === 'jpg') {
    mimeType = 'image/jpeg';
  } else if (format === 'webp') {
    mimeType = 'image/webp';
  } else if (format === 'bmp') {
    mimeType = 'image/bmp';
  } else if (format === 'ico') {
    // ICO requires special handling - just convert to small PNG
    mimeType = 'image/png';
  } else {
    mimeType = 'image/png';
  }

  const blob = await canvasToBlob(canvas, mimeType, quality);

  onProgress(100);
  return blob;
}

/** 将多张图片按顺序渲染到画布，返回画布数组（每张应用尺寸约束） */
export function renderImageToCanvas(file: File, options?: ImageOptions, rotation = 0): Promise<HTMLCanvasElement> {
  return loadImage(file).then((img) => {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    if (options?.maxWidth && width > options.maxWidth) {
      height = Math.round((options.maxWidth / width) * height);
      width = options.maxWidth;
    }
    if (options?.maxHeight && height > options.maxHeight) {
      width = Math.round((options.maxHeight / height) * width);
      height = options.maxHeight;
    }

    const norm = ((rotation % 360) + 360) % 360;
    const swap = norm === 90 || norm === 270;
    canvas.width = swap ? height : width;
    canvas.height = swap ? width : height;
    const ctx = canvas.getContext('2d')!;
    if (norm !== 0) {
      const rad = (norm * Math.PI) / 180;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
    } else {
      ctx.drawImage(img, 0, 0, width, height);
    }
    return canvas;
  });
}

interface PdfPageLayout {
  page: [number, number];
  pageOrientation: 'l' | 'p';
  draw: { x: number; y: number; w: number; h: number };
}

/** 根据页面方向与边距计算每张图片在 PDF 中的页面尺寸和绘制位置 */
function computePdfPage(w: number, h: number, margin: number, orientation: PdfMergeOptions['orientation']): PdfPageLayout {
  if (orientation === 'auto') {
    return {
      page: [w + margin * 2, h + margin * 2],
      pageOrientation: w > h ? 'l' : 'p',
      draw: { x: margin, y: margin, w, h },
    };
  }

  const isPortrait = orientation === 'portrait';
  const pw = isPortrait ? Math.min(w, h) : Math.max(w, h);
  const ph = isPortrait ? Math.max(w, h) : Math.min(w, h);
  const availW = pw - margin * 2;
  const availH = ph - margin * 2;
  const scale = Math.min(availW / w, availH / h);
  const dw = w * scale;
  const dh = h * scale;

  return {
    page: [pw, ph],
    pageOrientation: isPortrait ? 'p' : 'l',
    draw: { x: (pw - dw) / 2, y: (ph - dh) / 2, w: dw, h: dh },
  };
}

/** 将图片等比缩放并居中绘制到统一的页面尺寸上 */
function fitIntoPage(w: number, h: number, page: [number, number], margin: number): PdfPageLayout {
  const [pw, ph] = page;
  const availW = pw - margin * 2;
  const availH = ph - margin * 2;
  const scale = Math.min(availW / w, availH / h);
  const dw = w * scale;
  const dh = h * scale;
  return {
    page: [pw, ph],
    pageOrientation: pw > ph ? 'l' : 'p',
    draw: { x: (pw - dw) / 2, y: (ph - dh) / 2, w: dw, h: dh },
  };
}

/** 将多张图片合并为一个多页 PDF 文件 */
export async function convertImagesToPdf(
  tasks: ConvertTask[],
  options: ImageOptions | undefined,
  pdfOptions: PdfMergeOptions,
  onProgress: (p: number) => void
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const quality = options?.quality ?? 0.92;
  const margin = Math.max(0, pdfOptions.margin ?? 0);
  const orientation = pdfOptions.orientation ?? 'auto';
  const uniformSize = pdfOptions.uniformSize ?? false;
  const total = tasks.length;

  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < total; i++) {
    canvases.push(await renderImageToCanvas(tasks[i].sourceFile, options, tasks[i].rotation ?? 0));
    onProgress(Math.round(((i + 1) / total) * 80));
  }

  // 统一尺寸：以所有图片的最大宽/高为基准，得到一致的页面尺寸
  let uniformPage: [number, number] | null = null;
  if (uniformSize && canvases.length > 0) {
    const maxW = Math.max(...canvases.map((c) => c.width));
    const maxH = Math.max(...canvases.map((c) => c.height));
    if (orientation === 'portrait') {
      uniformPage = [Math.min(maxW, maxH), Math.max(maxW, maxH)];
    } else if (orientation === 'landscape') {
      uniformPage = [Math.max(maxW, maxH), Math.min(maxW, maxH)];
    } else {
      uniformPage = [maxW, maxH];
    }
  }

  let pdf: InstanceType<typeof jsPDF> | null = null;

  canvases.forEach((canvas, idx) => {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const layout = uniformPage
      ? fitIntoPage(canvas.width, canvas.height, uniformPage, margin)
      : computePdfPage(canvas.width, canvas.height, margin, orientation);

    if (idx === 0) {
      pdf = new jsPDF({ orientation: layout.pageOrientation, unit: 'px', format: layout.page });
    } else {
      pdf!.addPage(layout.page, layout.pageOrientation);
    }
    pdf!.addImage(dataUrl, 'JPEG', layout.draw.x, layout.draw.y, layout.draw.w, layout.draw.h);
  });

  onProgress(100);
  return pdf!.output('blob');
}

/** Canvas 导出为指定 mime 的 Blob */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}