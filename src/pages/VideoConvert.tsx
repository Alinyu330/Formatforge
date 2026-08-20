import { useEffect } from 'react';
import { Play, Archive } from 'lucide-react';
import ConvertLayout from '@/components/ConvertLayout';
import FileUpload from '@/components/FileUpload';
import VideoOptions from '@/components/VideoOptions';
import ConvertQueue from '@/components/ConvertQueue';
import { useConvertStore } from '@/store/convertStore';
import { preloadMediaEngine } from '@/utils/media.adapter.factory';
import { VIDEO_EXTENSIONS } from '@/utils/format';

const VIDEO_ACCEPT = `video/*,${VIDEO_EXTENSIONS.map((extension) => `.${extension}`).join(',')}`;

export default function VideoConvert() {
  const { tasks, isProcessing, addFiles, clearTasks, startConversion, downloadAllAsZip, setCurrentType } = useConvertStore();
  useEffect(() => { setCurrentType('video'); }, [setCurrentType]);
  useEffect(() => { preloadMediaEngine(); }, []);
  const pendingCount = tasks.reduce((sum, t) => sum + t.items.filter(i => i.status === 'pending').length, 0);
  const doneCount = tasks.reduce((sum, t) => sum + t.items.filter(i => i.status === 'done').length, 0);
  return <ConvertLayout>
    <div className="space-y-4 sm:space-y-5">
      <div><h2 className="text-base sm:text-lg font-semibold text-[var(--text-strong)]">视频格式转换</h2><p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1">支持常见视频格式互相转换，全部在浏览器本地处理</p></div>
      <FileUpload type="video" onFilesAdd={files => addFiles(files, 'video')} accept={VIDEO_ACCEPT} disabled={isProcessing} />
      <VideoOptions />
      <ConvertQueue />
      {tasks.length > 0 && <div className="flex flex-wrap items-center gap-2 sm:gap-3"><button onClick={startConversion} disabled={isProcessing || pendingCount === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-[#00d4ff] text-[#0f1724] disabled:opacity-30"><Play className="w-4 h-4" fill="currentColor" />{isProcessing ? '转换中...' : `开始转换 (${pendingCount})`}</button>{doneCount > 0 && <button onClick={downloadAllAsZip} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff]"><Archive className="w-4 h-4" />打包下载全部 ({doneCount})</button>}<button onClick={clearTasks} disabled={isProcessing} className="px-3 py-2.5 text-xs text-[var(--text-muted)]">清空列表</button></div>}
    </div>
  </ConvertLayout>;
}