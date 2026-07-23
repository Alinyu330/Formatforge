import { useCallback, useRef, useState } from 'react';
import { Upload, FileAudio, FileSpreadsheet, FileImage, FileText } from 'lucide-react';
import type { ConvertType } from '@/types';

interface Props {
  type: ConvertType;
  onFilesAdd: (files: File[]) => void;
  accept: string;
  disabled?: boolean;
}

const iconMap: Record<ConvertType, typeof FileAudio> = {
  audio: FileAudio,
  sheet: FileSpreadsheet,
  image: FileImage,
  document: FileText,
};

const labelMap: Record<ConvertType, string> = {
  audio: '拖拽音频文件到此处，或点击选择',
  sheet: '拖拽表格文件到此处，或点击选择',
  image: '拖拽图片文件到此处，或点击选择',
  document: '拖拽文档文件到此处，或点击选择',
};

const formatMap: Record<ConvertType, string> = {
  audio: '支持 MP3, FLAC, WAV, AAC, OGG, M4A, WMA 等标准格式\n支持 QQ音乐(QMC/MFLAC) 网易云(NCM) 酷狗(KGM) 加密格式',
  sheet: '支持 XLSX, XLS, CSV, ODS, HTML 等格式',
  image: '支持 PNG, JPG, WEBP, BMP, GIF, SVG, ICO, TIFF 等格式',
  document: '支持 DOC, DOCX, PPT, PPTX 等办公文档格式',
};

export default function FileUpload({ type, onFilesAdd, accept, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = iconMap[type];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesAdd(files);
      }
    },
    [disabled, onFilesAdd]
  );

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesAdd(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative cursor-pointer rounded-xl sm:rounded-2xl border-2 border-dashed p-6 sm:p-10
        flex flex-col items-center justify-center gap-2 sm:gap-3
        transition-all duration-300
        ${isDragging
          ? 'border-[#00d4ff] bg-[#00d4ff]/10 scale-[1.02] shadow-[0_0_40px_rgba(0,212,255,0.15)]'
          : 'border-white/10 bg-white/[0.02] hover:border-[#00d4ff]/50 hover:bg-white/[0.04]'
        }
        ${disabled ? 'pointer-events-none opacity-40' : ''}
      `}
    >
      <div
        className={`
          w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
          transition-all duration-300
          ${isDragging
            ? 'bg-[#00d4ff]/20 shadow-[0_0_25px_rgba(0,212,255,0.3)]'
            : 'bg-white/[0.04]'
          }
        `}
      >
        {isDragging ? (
          <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-[#00d4ff] animate-bounce" />
        ) : (
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#00d4ff]/70" />
        )}
      </div>

      <div className="text-center">
        <p className="text-xs sm:text-sm text-white/80 font-medium">{labelMap[type]}</p>
        <p className="text-[10px] sm:text-xs text-white/35 mt-1.5 whitespace-pre-line">{formatMap[type]}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
