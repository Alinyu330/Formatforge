import { useEffect } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { getFileExtension, SHEET_EXTENSIONS, WORD_EXTENSIONS, POWERPOINT_EXTENSIONS } from '@/utils/format';

export default function DocConvert() {
  const { tasks, addFiles, clearTasks, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();

  useEffect(() => { setCurrentType('document'); }, [setCurrentType]);

  const pendingCount = tasks.reduce((sum, task) => sum + task.items.filter((item) => item.status === 'pending').length, 0);
  const convertingCount = tasks.reduce((sum, task) => sum + task.items.filter((item) => item.status === 'converting').length, 0);
  const doneCount = tasks.reduce((sum, task) => sum + task.items.filter((item) => item.status === 'done').length, 0);

  const handleFiles = (files: File[]) => {
    const sheets = files.filter((file) => SHEET_EXTENSIONS.includes(getFileExtension(file.name)));
    const words = files.filter((file) => WORD_EXTENSIONS.includes(getFileExtension(file.name)));
    const presentations = files.filter((file) => POWERPOINT_EXTENSIONS.includes(getFileExtension(file.name)));
    const pdfs = files.filter((file) => getFileExtension(file.name) === 'pdf');
    if (sheets.length) addFiles(sheets, 'sheet');
    if (words.length) addFiles(words, 'document');
    if (presentations.length) addFiles(presentations, 'document');
    if (pdfs.length) addFiles(pdfs, 'document');
  };

  return (
    <ConvertLayout>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">办公与 PDF 转换</h2>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">支持 PDF 转 PPT、Word、Excel、图片、TXT，以及图片转 PDF</p>
        </div>

        <FileUpload type="document" onFilesAdd={handleFiles}
          accept=".pdf,.xlsx,.xls,.csv,.ods,.html,.htm,.docx,.pptx" />

        <ConvertQueue />

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button type="button" onClick={startConversion} onTouchEnd={(e) => { e.preventDefault(); startConversion(); }} disabled={pendingCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#10b981] text-white hover:bg-[#10b981]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
              {convertingCount > 0 ? '转换中...' : `开始转换 (${pendingCount})`}
            </button>
            {doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-all"><Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})</button>}
            <button onClick={clearTasks} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">清空列表</button>
          </div>
        )}
      </div>
    </ConvertLayout>
  );
}