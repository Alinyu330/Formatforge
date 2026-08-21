import { useEffect } from 'react';
import { Play, Archive, Layers } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import ImageOptions from '@/components/ImageOptions';
import PdfMergeOptions from '@/components/PdfMergeOptions';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';

export default function ImageConvert() {
  const { tasks, addFiles, clearTasks, startConversion, downloadAllAsZip, mergeImagesToPdf, setCurrentType } = useConvertStore();

  useEffect(() => { setCurrentType('image'); }, [setCurrentType]);

  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'pending').length, 0);
  const convertingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'converting').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'done').length, 0);

  return (
    <ConvertLayout>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">图片格式转换</h2>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">图片格式互转或转换为 PDF，支持调整尺寸和质量，可同时输出多种格式</p>
        </div>

        <FileUpload type="image" onFilesAdd={(f) => addFiles(f, 'image')}
          accept="image/*,.png,.jpg,.jpeg,.webp,.bmp,.ico,.tiff,.tif,.gif,.svg" />

        {tasks.length > 0 && (
          <>
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
            <button type="button" onClick={startConversion} onTouchEnd={(e) => { e.preventDefault(); startConversion(); }} disabled={pendingCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#f59e0b] text-[#0f1724] hover:bg-[#f59e0b]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
              {convertingCount > 0 ? '转换中...' : `开始转换 (${pendingCount})`}
            </button>
            {doneCount > 0 && (
              <button onClick={downloadAllAsZip}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-all">
                <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})
              </button>
            )}
            {tasks.length >= 2 && (
              <button onClick={mergeImagesToPdf}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />合并为 PDF
              </button>
            )}
            <button onClick={clearTasks}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">清空列表</button>
          </div>
        )}
      </div>
    </ConvertLayout>
  );
}