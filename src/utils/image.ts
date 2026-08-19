import type { ConvertTask } from '@/types';

export async function convertImage(task: ConvertTask, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(10);

  const img = await loadImage(task.sourceFile);
  onProgress(30);

  const canvas = document.createElement('canvas');
  let { width, height } = img;

  // Apply size constraints
  if (task.imageOptions?.maxWidth && width > task.imageOptions.maxWidth) {
    height = Math.round((task.imageOptions.maxWidth / width) * height);
    width = task.imageOptions.maxWidth;
  }
  if (task.imageOptions?.maxHeight && height > task.imageOptions.maxHeight) {
    width = Math.round((task.imageOptions.maxHeight / height) * width);
    height = task.imageOptions.maxHeight;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  onProgress(60);

  const quality = task.imageOptions?.quality ?? 0.92;
  const format = task.targetFormat as string;

  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width, height] });
    pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, width, height);
    onProgress(100);
    return pdf.output('blob');
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
  } else if (format === 'tiff' || format === 'tif') {
    // TIFF not natively supported by Canvas; fallback to PNG
    mimeType = 'image/png';
  } else {
    mimeType = 'image/png';
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });

  onProgress(100);
  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
