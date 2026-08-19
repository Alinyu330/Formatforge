import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Download } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import * as XLSX from 'xlsx';

interface Props {
  taskId: string;
  onClose: () => void;
}

export default function PreviewModal({ taskId, onClose }: Props) {
  const task = useConvertStore((s) => s.tasks.find((t) => t.id === taskId));
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const item = task?.items.find((i) => i.id === useConvertStore.getState().previewItemId);

  useEffect(() => {
    if (!task || !item?.resultBlob) return;
    loadPreview();
  }, [task, item]);
  if (!task || !item || !item.resultBlob) return null;

  const type = getPreviewType();

  function getPreviewType(): 'audio' | 'video' | 'image' | 'sheet' | 'document' | 'unknown' {
    const ext = (item.targetFormat || task.sourceFormat).toLowerCase();
    const audioFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'alac', 'ape', 'ac3', 'eac3', 'amr', 'aiff', 'au', 'caf', 'webm'];
    const videoFormats = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ts', 'ogv', 'webm'];
    const mime = item.resultBlob?.type || '';
    if (task.convertType === 'video' || (task.convertType !== 'audio' && videoFormats.includes(ext))) {
      return 'video';
    }
    if (task.convertType === 'audio' || audioFormats.includes(ext) || (ext === 'webm' && mime.startsWith('audio/'))) {
      return 'audio';
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'].includes(ext)) {
      return 'image';
    }
    if (['xlsx', 'csv', 'ods'].includes(ext)) {
      return 'sheet';
    }
    if (['html', 'htm', 'txt', 'docx', 'doc', 'pptx', 'ppt', 'pdf'].includes(ext)) {
      return 'document';
    }
    return 'unknown';
  }

  async function loadPreview() {
    setLoading(true);
    try {
      if (type === 'sheet') {
        const html = await renderSheet();
        setPreviewContent(html);
      } else if (type === 'document') {
        const text = await task!.resultBlob!.text();
        setPreviewContent(text);
      }
    } catch {
      setPreviewContent('');
    }
    setLoading(false);
  }

  async function renderSheet(): Promise<string> {
    try {
      const buffer = await task!.resultBlob!.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
      return `<style>table{border-collapse:collapse;width:100%;font-size:12px;}td,th{border:1px solid #444;padding:4px 8px;text-align:left;}th{background:#1e293b;color:#00d4ff;}</style>${html}`;
    } catch {
      return '';
    }
  }

  function handleDownload() {
    useConvertStore.getState().downloadTask(taskId);
  }

  const ext = (item.targetFormat || task.sourceFormat).toLowerCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--modal)] border border-[var(--border)] rounded-xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden mx-2 sm:mx-0">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)]">
          <span className="text-xs sm:text-sm text-[var(--text-strong)] truncate flex-1">{task.fileName}</span>
          <span className="text-[9px] sm:text-[10px] text-[#00d4ff] uppercase">{task.targetFormat}</span>
          <button onClick={handleDownload} className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors" title="下载">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors">
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-5">
          {type === 'audio' && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
                ${isPlaying ? 'bg-[#00d4ff]/20 shadow-[0_0_40px_rgba(0,212,255,0.2)] scale-110' : 'bg-[var(--surface)]'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center
                  ${isPlaying ? 'bg-[#00d4ff]/30' : 'bg-[var(--surface)]'}`}>
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-[#00d4ff]" />
                  ) : (
                    <Play className="w-6 h-6 text-[#00d4ff] ml-0.5" />
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--text)]">{task.fileName}</p>
              <button
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (isPlaying) { audio.pause(); setIsPlaying(false); }
                  else { audio.play(); setIsPlaying(true); }
                }}
                className="px-6 py-2.5 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm font-medium
                  hover:bg-[#00d4ff]/20 transition-colors"
              >
                {isPlaying ? '暂停' : '播放'}
              </button>
              <audio
                ref={audioRef}
                src={item.resultUrl || ''}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
              <audio src={item.resultUrl || ''} controls className="w-full max-w-md mt-4" />
            </div>
          )}

          {type === 'video' && (
            <video src={item.resultUrl || ''} controls className="w-full max-h-[60vh] rounded-lg" />
          )}

          {type === 'image' && (
            <div className="flex items-center justify-center min-h-[200px]">
              <img
                src={item.resultUrl || ''}
                alt={task.fileName}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          )}

          {(type === 'sheet' || type === 'document' || type === 'unknown') && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                </div>
              ) : type === 'unknown' && !['html', 'htm'].includes(ext) ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <p className="text-sm">暂不支持预览此格式</p>
                  <p className="text-xs mt-1">请下载后查看</p>
                </div>
              ) : (
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: type === 'sheet' ? previewContent :
                            ext === 'txt' ? `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.7;color:var(--text);">${escapeHtml(previewContent)}</pre>` :
                            previewContent
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
