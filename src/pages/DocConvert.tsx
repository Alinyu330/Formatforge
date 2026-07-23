import { useEffect, useState } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import FormatMultiSelector from '@/components/FormatMultiSelector';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';

const DOC_FORMATS = [
  { value: 'docx', label: 'DOCX' },
  { value: 'pptx', label: 'PPTX' },
  { value: 'txt', label: 'TXT' },
  { value: 'html', label: 'HTML' },
  { value: 'pdf', label: 'PDF' },
];

export default function DocConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, updateTaskFormats, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  useEffect(() => { setCurrentType('document'); }, [setCurrentType]);

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
          <h2 className="text-base sm:text-lg font-semibold text-white/85">文档格式转换</h2>
          <p className="text-[10px] sm:text-xs text-white/35 mt-1">Word、PPT 文档互转及提取为 TXT/HTML/PDF，支持多格式输出</p>
        </div>

        <FileUpload type="document" onFilesAdd={(f) => addFiles(f, 'document')}
          accept=".doc,.docx,.ppt,.pptx,.rtf,.odt,.odp"
          disabled={isProcessing} />

        {tasks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">目标格式（可多选）</p>
            <FormatMultiSelector formats={DOC_FORMATS} selected={selectedFormats} onChange={applyFormats} />
          </div>
        )}

        <ConvertQueue />

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onClick={startConversion} disabled={isProcessing || pendingCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium
                bg-[#10b981] text-white hover:bg-[#10b981]/90
                disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
              {isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}
            </button>
            {doneCount > 0 && (
              <button onClick={downloadAllAsZip}
                className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium
                  border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-all">
                <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})
              </button>
            )}
            <button onClick={clearTasks} disabled={isProcessing}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition-colors disabled:opacity-30">清空列表</button>
          </div>
        )}
      </div>
    </ConvertLayout>
  );
}
