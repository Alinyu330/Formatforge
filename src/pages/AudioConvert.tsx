import { useEffect, useState } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import FormatMultiSelector from '@/components/FormatMultiSelector';
import AudioOptions from '@/components/AudioOptions';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { ALL_AUDIO_EXTENSIONS } from '@/utils/format';
import { preloadMediaEngine } from '@/utils/media.adapter.factory';

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' }, { value: 'flac', label: 'FLAC' }, { value: 'wav', label: 'WAV' }, { value: 'aac', label: 'AAC' }, { value: 'ogg', label: 'OGG' }, { value: 'm4a', label: 'M4A' }, { value: 'wma', label: 'WMA' }, { value: 'opus', label: 'OPUS' }, { value: 'webm', label: 'WebM' },
];
const AUDIO_ACCEPT = `audio/*,${ALL_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(',')}`;

export default function AudioConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, updateTaskFormats, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  useEffect(() => { setCurrentType('audio'); }, [setCurrentType]);
  useEffect(() => { preloadMediaEngine(); }, []);
  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'pending').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'done').length, 0);
  const applyFormats = (fmts: string[]) => { setSelectedFormats(fmts); tasks.forEach((t) => updateTaskFormats(t.id, fmts)); };

  return <ConvertLayout><div className="space-y-4 sm:space-y-5">
    <div><h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">音频格式转换</h2><p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">标准格式及 QQ音乐旧版/新版(QMC/MFLAC/musicex)、网易云(NCM)、酷狗(KGM) 加密格式解密转换</p></div>
    <FileUpload type="audio" onFilesAdd={(f) => addFiles(f, 'audio')} accept={AUDIO_ACCEPT} disabled={isProcessing} />
    {tasks.length > 0 && <><div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">目标格式（可多选）</p><FormatMultiSelector formats={AUDIO_FORMATS} selected={selectedFormats} onChange={applyFormats} /></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">转换参数</p><AudioOptions /></div></>}
    <ConvertQueue />
    {tasks.length > 0 && <div className="flex flex-wrap items-center gap-2 sm:gap-3"><button onClick={startConversion} disabled={isProcessing || pendingCount === 0} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#00d4ff] text-[#0f1724] hover:bg-[#00d4ff]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(0,212,255,0.2)]"><Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />{isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}</button>{doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-all"><Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})</button>}<button onClick={clearTasks} disabled={isProcessing} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30">清空列表</button></div>}
  </div></ConvertLayout>;
}
