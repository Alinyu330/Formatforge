import { useEffect, useState } from 'react';
import { Play, Archive, Layers } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import FormatMultiSelector from '@/components/FormatMultiSelector';
import ImageOptions from '@/components/ImageOptions';
import PdfMergeOptions from '@/components/PdfMergeOptions';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';

const IMAGE_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
  { value: 'bmp', label: 'BMP' },
  { value: 'ico', label: 'ICO' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'pdf', label: 'PDF' },
];

export default function ImageConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, updateTaskFormats, startConversion, downloadAllAsZip, mergeImagesToPdf, setCurrentType } = useConvertStore();
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  useEffect(() => { setCurrentType('image'); }, [setCurrentType]);

  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'pending').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'done').length, 0);

  const applyFormats = (fmts: string[]) => {
    setSelectedFormats(fmts);
    tasks.forEach((t) => updateTaskFormats(t.id, fmts));
  };

  return (
    <ConvertLayout>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">图片格式转换</h2>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">图片格式互转或转换为 PDF，支持调整尺寸和质量，可同时输出多种格式</p>
        </div>

        <FileUpload type="image" onFilesAdd={(f) => addFiles(f, 'image')}
          accept="image/*,.png,.jpg,.jpeg,.webp,.bmp,.ico,.tiff,.tif,.gif,.svg"
          disabled={isProcessing} />

        {tasks.length > 0 && (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">目标格式（可多选）</p>
              <FormatMultiSelector formats={IMAGE_FORMATS} selected={selectedFormats} onChange={applyFormats} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">转换参数</p>
              <ImageOptions />
            </div>
            {tasks.length >= 2 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">合并 PDF 选项（统一页面方向 / 边距）</p>
                <PdfMergeOptions />
              </div>
            )}
          </>
        )}

        <ConvertQueue />

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onClick={startConversion} disabled={isProcessing || pendingCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#f59e0b] text-[#0f1724] hover:bg-[#f59e0b]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
              {isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}
            </button>
            {doneCount > 0 && (
              <button onClick={downloadAllAsZip}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-all">
                <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})
              </button>
            )}
            {tasks.length >= 2 && (
              <button onClick={mergeImagesToPdf} disabled={isProcessing}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />合并为 PDF
              </button>
            )}
            <button onClick={clearTasks} disabled={isProcessing}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30">清空列表</button>
          </div>
        )}
      </div>
    </ConvertLayout>
  );
}
