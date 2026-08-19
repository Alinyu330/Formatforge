import { useRef, useState, useEffect } from 'react';
import { X, Download, Play, Pause } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import * as XLSX from 'xlsx';

export default function PreviewPanel() {
  const { tasks, previewTaskId, previewItemId, setPreviewTask, toggleSidebar, sidebarOpen, downloadItem } = useConvertStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const task = tasks.find((t) => t.id === previewTaskId);
  const item = task?.items.find((i) => i.id === previewItemId);

  // Auto-select first completed item if none selected
  useEffect(() => {
    if (sidebarOpen && previewTaskId && !previewItemId) {
      const t = tasks.find((t) => t.id === previewTaskId);
      const firstDone = t?.items.find((i) => i.status === 'done');
      if (firstDone) {
        setPreviewTask(previewTaskId, firstDone.id);
      }
    }
  }, [tasks, previewTaskId, previewItemId, sidebarOpen, setPreviewTask]);

  useEffect(() => {
    if (!sidebarOpen || !item?.resultBlob) { setContent(''); return; }
    loadContent();
  }, [item?.id, sidebarOpen]);

  if (!sidebarOpen || !task) return null;

  async function loadContent() {
    if (!item) return;
    const ext = item?.targetFormat.toLowerCase() || '';

    if (['xlsx', 'xls', 'xlsb', 'xlsm', 'ods', 'fods', 'csv'].includes(ext)) {
      setLoading(true);
      try {
        const buffer = await item.resultBlob!.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
        setContent(`<style>table{border-collapse:collapse;width:100%;font-size:11px;}td,th{border:1px solid #333;padding:3px 6px;text-align:left;}th{background:#1e293b;color:#00d4ff;}</style>${html}`);
      } catch { setContent('<p class="text-[var(--text-muted)]">无法预览</p>'); }
      setLoading(false);
    } else if (['html', 'htm'].includes(ext)) {
      setLoading(true);
      try { setContent(await item.resultBlob!.text()); } catch { setContent(''); }
      setLoading(false);
    } else if (ext === 'txt') {
      setLoading(true);
      try {
        const text = await item.resultBlob!.text();
        setContent(`<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;line-height:1.6;color:var(--text);">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`);
      } catch { setContent(''); }
      setLoading(false);
    }
  }

  const audioFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'alac', 'ape', 'ac3', 'eac3', 'amr', 'aiff', 'au', 'caf', 'webm'];
  const videoFormats = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ts', 'ogv', 'webm'];
  const mime = item?.resultBlob?.type || '';
  const isVideo = !!item && (task.convertType === 'video' || (item.targetFormat === 'webm' && mime.startsWith('video/')) || (videoFormats.includes(item.targetFormat) && !audioFormats.includes(item.targetFormat)));
  const isAudio = !!item && !isVideo && (task.convertType === 'audio' || audioFormats.includes(item.targetFormat));
  const isImage = item && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'].includes(item.targetFormat);

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-medium text-[var(--text)] truncate flex-1">预览</span>
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!item ? (
          <div className="flex items-center justify-center h-full text-[var(--text-faint)] text-xs">选择转换项以预览</div>
        ) : item.status === 'converting' ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">转换中 {item.progress}%</p>
          </div>
        ) : item.status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400/60 text-xs gap-1">
            <p>转换失败</p>
            <p>{item.error}</p>
          </div>
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              playing ? 'bg-[#00d4ff]/20 shadow-[0_0_30px_rgba(0,212,255,0.2)] scale-110' : 'bg-[var(--surface)]'
            }`}>
              <button onClick={() => {
                const a = audioRef.current; if (!a) return;
                playing ? a.pause() : a.play();
                setPlaying(!playing);
              }}>
                {playing ? <Pause className="w-7 h-7 text-[#00d4ff]" /> : <Play className="w-7 h-7 text-[#00d4ff] ml-0.5" />}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text)] text-center truncate max-w-full">{task.fileName}</p>
            <span className="text-[10px] uppercase text-[#00d4ff]">{item.targetFormat}</span>
            <audio ref={audioRef} src={item.resultUrl || ''} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} className="hidden" />
            <audio src={item.resultUrl || ''} controls className="w-full mt-2" style={{ height: 32 }} />
          </div>
        ) : isVideo ? (
          <video src={item.resultUrl || ''} controls className="w-full max-h-full rounded-lg" />
        ) : isImage ? (
          <div className="flex items-center justify-center h-full">
            <img src={item.resultUrl || ''} alt={task.fileName} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" /></div>
        ) : content ? (
          <div className="text-xs prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-faint)] text-xs text-center">暂不支持此格式预览</div>
        )}
      </div>

      {/* Footer */}
      {item?.status === 'done' && (
        <div className="p-2 border-t border-[var(--border)] shrink-0">
          <button
            onClick={() => downloadItem(task.id, item.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />下载 .{item.targetFormat}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 lg:w-96 shrink-0 bg-[var(--panel)] border-l border-[var(--border)] flex-col h-[calc(100vh-3.5rem)] sticky top-14">
        {panelContent}
      </div>

      {/* Mobile full-screen overlay */}
      <div className="md:hidden fixed inset-0 z-[70] bg-[var(--panel)] flex flex-col">
        {panelContent}
      </div>
    </>
  );
}
