import { useEffect, useState } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import FormatMultiSelector from '@/components/FormatMultiSelector';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { getFileExtension, SHEET_EXTENSIONS, WORD_EXTENSIONS, POWERPOINT_EXTENSIONS } from '@/utils/format';

const SHEET_FORMATS = ['xlsx', 'xls', 'xlsb', 'xlsm', 'ods', 'fods', 'csv', 'txt', 'html'].map((value) => ({ value, label: value.toUpperCase() }));
const WORD_FORMATS = ['docx', 'txt', 'html', 'pdf'].map((value) => ({ value, label: value.toUpperCase() }));
const PPT_FORMATS = ['pptx', 'txt', 'html'].map((value) => ({ value, label: value.toUpperCase() }));
const PDF_FORMATS = [
  { value: 'pptx', label: 'PPT' },
  { value: 'docx', label: 'Word' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'png', label: '图片 PNG' },
  { value: 'jpeg', label: '图片 JPG' },
  { value: 'txt', label: 'TXT' },
];

export default function DocConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, updateTaskFormats, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  const [sheetFormats, setSheetFormats] = useState<string[]>([]);
  const [wordFormats, setWordFormats] = useState<string[]>([]);
  const [pptFormats, setPptFormats] = useState<string[]>([]);
  const [pdfFormats, setPdfFormats] = useState<string[]>([]);

  useEffect(() => { setCurrentType('document'); }, [setCurrentType]);

  const pendingCount = tasks.reduce((sum, task) => sum + task.items.filter((item) => item.status === 'pending').length, 0);
  const doneCount = tasks.reduce((sum, task) => sum + task.items.filter((item) => item.status === 'done').length, 0);

  const hasSheets = tasks.some((task) => task.convertType === 'sheet');
  const hasWords = tasks.some((task) => task.convertType === 'document' && getFileExtension(task.fileName) === 'docx');
  const hasPpts = tasks.some((task) => task.convertType === 'document' && getFileExtension(task.fileName) === 'pptx');
  const hasPdfs = tasks.some((task) => task.convertType === 'document' && getFileExtension(task.fileName) === 'pdf');

  const handleFiles = (files: File[]) => {
    const sheets = files.filter((file) => SHEET_EXTENSIONS.includes(getFileExtension(file.name)));
    const words = files.filter((file) => WORD_EXTENSIONS.includes(getFileExtension(file.name)));
    const presentations = files.filter((file) => POWERPOINT_EXTENSIONS.includes(getFileExtension(file.name)));
    const pdfs = files.filter((file) => getFileExtension(file.name) === 'pdf');
    if (sheets.length) addFiles(sheets, 'sheet', sheetFormats);
    if (words.length) addFiles(words, 'document', wordFormats);
    if (presentations.length) addFiles(presentations, 'document', pptFormats);
    if (pdfs.length) addFiles(pdfs, 'document', pdfFormats);
  };

  const applyFormats = (category: 'sheet' | 'word' | 'ppt' | 'pdf', formats: string[]) => {
    if (category === 'sheet') setSheetFormats(formats);
    if (category === 'word') setWordFormats(formats);
    if (category === 'ppt') setPptFormats(formats);
    if (category === 'pdf') setPdfFormats(formats);
    tasks.filter((task) => category === 'sheet'
      ? task.convertType === 'sheet'
      : getFileExtension(task.fileName) === (category === 'word' ? 'docx' : category === 'ppt' ? 'pptx' : 'pdf'))
      .forEach((task) => updateTaskFormats(task.id, formats));
  };

  return (
    <ConvertLayout>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">办公与 PDF 转换</h2>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">支持 PDF 转 PPT、Word、Excel、图片、TXT，以及图片转 PDF</p>
        </div>

        <FileUpload type="document" onFilesAdd={handleFiles}
          accept=".pdf,.xlsx,.xls,.csv,.ods,.html,.htm,.docx,.pptx"
          disabled={isProcessing} />

        {tasks.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {hasPdfs && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">PDF 目标格式</p><FormatMultiSelector formats={PDF_FORMATS} selected={pdfFormats} onChange={(formats) => applyFormats('pdf', formats)} /></div>}
            {hasSheets && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">表格目标格式</p><FormatMultiSelector formats={SHEET_FORMATS} selected={sheetFormats} onChange={(formats) => applyFormats('sheet', formats)} /></div>}
            {hasWords && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Word DOCX 目标格式</p><FormatMultiSelector formats={WORD_FORMATS} selected={wordFormats} onChange={(formats) => applyFormats('word', formats)} /></div>}
            {hasPpts && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">PowerPoint PPTX 目标格式</p><FormatMultiSelector formats={PPT_FORMATS} selected={pptFormats} onChange={(formats) => applyFormats('ppt', formats)} /></div>}
          </div>
        )}

        <ConvertQueue />

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onClick={startConversion} disabled={isProcessing || pendingCount === 0}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#10b981] text-white hover:bg-[#10b981]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
              {isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}
            </button>
            {doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 transition-all"><Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})</button>}
            <button onClick={clearTasks} disabled={isProcessing} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30">清空列表</button>
          </div>
        )}
      </div>
    </ConvertLayout>
  );
}
