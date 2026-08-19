import { useEffect, useState } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import FormatMultiSelector from '@/components/FormatMultiSelector';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { preloadMediaEngine } from '@/utils/media.adapter.factory';

const VIDEO_FORMATS = ['mp4','mkv','webm','mov','avi','flv','wmv','mpeg','mpg','m4v','3gp','ts','ogv','gif'].map(value => ({ value, label: value.toUpperCase() }));
const VIDEO_EXTENSIONS = VIDEO_FORMATS.map(f => `.${f.value}`).join(',');

export default function VideoConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, updateTaskFormats, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  useEffect(() => { setCurrentType('video'); }, [setCurrentType]);
  // 进入页面时后台预加载 FFmpeg 引擎
  useEffect(() => { preloadMediaEngine(); }, []);
  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter(i => i.status === 'pending').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter(i => i.status === 'done').length, 0);
  const applyFormats = (formats: string[]) => { setSelectedFormats(formats); tasks.forEach(t => updateTaskFormats(t.id, formats)); };
  return <ConvertLayout>
    <div className="space-y-4 sm:space-y-5">
      <div><h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">视频格式转换</h2><p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">支持常见视频格式互相转换，全部在浏览器本地处理</p></div>
      <FileUpload type="video" onFilesAdd={files => addFiles(files, 'video')} accept={`video/*,${VIDEO_EXTENSIONS}`} disabled={isProcessing} />
      {tasks.length > 0 && <div><p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">目标格式（可多选）</p><FormatMultiSelector formats={VIDEO_FORMATS} selected={selectedFormats} onChange={applyFormats} /></div>}
      <ConvertQueue />
      {tasks.length > 0 && <div className="flex flex-wrap items-center gap-2 sm:gap-3"><button onClick={startConversion} disabled={isProcessing || pendingCount === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-[#00d4ff] text-[#0f1724] disabled:opacity-30"><Play className="w-4 h-4" fill="currentColor" />{isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}</button>{doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff]"><Archive className="w-4 h-4" />打包下载全部 ({doneCount})</button>}<button onClick={clearTasks} disabled={isProcessing} className="px-3 py-2.5 text-xs text-[var(--text-muted)]">清空列表</button></div>}
    </div>
  </ConvertLayout>;
}
