import { useEffect } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import AudioOptions from '@/components/AudioOptions';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { ALL_AUDIO_EXTENSIONS } from '@/utils/format';
import { preloadMediaEngine } from '@/utils/media.adapter.factory';

const AUDIO_ACCEPT = `audio/*,${ALL_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(',')}`;

export default function AudioConvert() {
  const { tasks, addFiles, clearTasks, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  useEffect(() => { setCurrentType('audio'); }, [setCurrentType]);
  useEffect(() => { preloadMediaEngine(); }, []);
  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'pending').length, 0);
  const convertingCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'converting').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter((i) => i.status === 'done').length, 0);

  return <ConvertLayout><div className="space-y-4 sm:space-y-5">
    <div><h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">音频格式转换</h2><p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">标准格式及 QQ音乐旧版/新版(QMC/MFLAC/musicex)、网易云(NCM)、酷狗(KGM) 加密格式解密转换</p></div>
    <FileUpload type="audio" onFilesAdd={(f) => addFiles(f, 'audio')} accept={AUDIO_ACCEPT} />
    {tasks.length > 0 && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">转换参数</p><AudioOptions /></div>}
    <ConvertQueue />
    {tasks.length > 0 && <div className="flex flex-wrap items-center gap-2 sm:gap-3"><button onClick={startConversion} disabled={pendingCount === 0} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#00d4ff] text-[#0f1724] hover:bg-[#00d4ff]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(0,212,255,0.2)]"><Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />{convertingCount > 0 ? '转换中...' : `开始转换 (${pendingCount})`}</button>{doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-all"><Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />打包下载全部 ({doneCount})</button>}<button onClick={clearTasks} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">清空列表</button></div>}
  </div></ConvertLayout>;
}