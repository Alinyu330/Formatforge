import { useRef, useState, useEffect } from 'react';
import { X, Download, Play, Pause } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { renderImageToCanvas } from '@/utils/image';
import { decodeForPreview, needsPreviewDecode } from '@/utils/preview';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

const audioFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'alac', 'ape', 'ac3', 'eac3', 'amr', 'aiff', 'au', 'caf', 'webm'];
const videoFormats = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ts', 'ogv', 'webm'];
const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico', 'tiff', 'tif'];
const sheetFormats = ['xlsx', 'xls', 'xlsb', 'xlsm', 'ods', 'fods', 'csv'];

export default function PreviewPanel() {
  const { tasks, previewTaskId, previewItemId, previewSource, setPreviewTask, toggleSidebar, sidebarOpen, downloadItem } = useConvertStore();
  const [content, setContent] = useState('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [rotatedUrl, setRotatedUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [decodedUrl, setDecodedUrl] = useState('');
  const [decoding, setDecoding] = useState(false);

  const task = tasks.find((t) => t.id === previewTaskId);
  const item = task?.items.find((i) => i.id === previewItemId);
  // 源文件预览：由「预览源文件」入口触发，此时没有转换项
  const isSource = previewSource && !!task;

  // 维护源文件的 object URL
  useEffect(() => {
    if (isSource && task?.sourceFile) {
      const url = URL.createObjectURL(task.sourceFile);
      setSourceUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSourceUrl('');
  }, [isSource, previewTaskId]);

  // 图片源文件旋转预览：按当前旋转角度渲染出预览图
  useEffect(() => {
    let cancelled = false;
    const rotation = task?.rotation ?? 0;
    if (isSource && task?.convertType === 'image' && rotation !== 0) {
      renderImageToCanvas(task.sourceFile, task.imageOptions, rotation)
        .then((canvas) => { if (!cancelled) setRotatedUrl(canvas.toDataURL('image/png')); })
        .catch(() => { if (!cancelled) setRotatedUrl(''); });
    } else {
      setRotatedUrl('');
    }
    return () => { cancelled = true; };
  }, [isSource, previewTaskId, task?.rotation]);

  // 当前预览的目标：结果或源文件
  const previewFormat = (isSource ? task.sourceFormat : item?.targetFormat || '').toLowerCase();
  const previewBlob: Blob | undefined = isSource ? task.sourceFile : item?.resultBlob;
  const previewUrl = isSource ? sourceUrl : item?.resultUrl || '';
  const needsDecode = !!previewBlob && needsPreviewDecode(previewFormat);
  const effectiveUrl = needsDecode ? decodedUrl : previewUrl;

  // Auto-select first completed item if none selected
  useEffect(() => {
    if (sidebarOpen && previewTaskId && !previewItemId && !previewSource) {
      const t = tasks.find((t) => t.id === previewTaskId);
      const firstDone = t?.items.find((i) => i.status === 'done');
      if (firstDone) {
        setPreviewTask(previewTaskId, firstDone.id);
      }
    }
  }, [tasks, previewTaskId, previewItemId, previewSource, sidebarOpen, setPreviewTask]);

  // 加载文本/表格/PDF 类内容
  useEffect(() => {
    if (!sidebarOpen || !previewBlob || !task) { setContent(''); setPdfPages([]); return; }
    loadContent(previewBlob, previewFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTaskId, previewItemId, previewSource, sidebarOpen]);

  // 浏览器无法原生解码的格式（WMA / TIFF），用 FFmpeg 转码成可预览的 WAV / PNG
  useEffect(() => {
    let cancelled = false;
    let url = '';
    setDecodedUrl('');
    setDecoding(false);
    if (!previewBlob || !previewFormat || !needsPreviewDecode(previewFormat)) return;
    setDecoding(true);
    decodeForPreview(previewBlob, previewFormat)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setDecodedUrl(url);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDecoding(false); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBlob, previewFormat]);

  if (!sidebarOpen || !task) return null;

  async function loadContent(blob: Blob, ext: string) {
    if (ext === 'pdf') {
      setLoading(true);
      setPdfPages([]);
      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const urls: string[] = [];
        const scale = 1.5;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const canvasContext = canvas.getContext('2d')!;
          await page.render({ canvas, canvasContext, viewport }).promise;
          urls.push(canvas.toDataURL('image/png'));
        }
        setPdfPages(urls);
      } catch { setPdfPages([]); }
      setLoading(false);
    } else if (sheetFormats.includes(ext)) {
      setLoading(true);
      try {
        const buffer = await blob.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
        setContent(`<style>table{border-collapse:collapse;width:100%;font-size:11px;}td,th{border:1px solid #333;padding:3px 6px;text-align:left;}th{background:#1e293b;color:#00d4ff;}</style>${html}`);
      } catch { setContent('<p class="text-[var(--text-muted)]">无法预览</p>'); }
      setLoading(false);
    } else if (['html', 'htm'].includes(ext)) {
      setLoading(true);
      try { setContent(await blob.text()); } catch { setContent(''); }
      setLoading(false);
    } else if (ext === 'txt') {
      setLoading(true);
      try {
        const text = await blob.text();
        setContent(`<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;line-height:1.6;color:var(--text);">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
      } catch { setContent(''); }
      setLoading(false);
    }
  }

  const mime = previewBlob?.type || '';
  const isVideo = !!previewBlob && previewFormat !== 'gif' && (task.convertType === 'video' || (previewFormat === 'webm' && mime.startsWith('video/')) || (videoFormats.includes(previewFormat) && !audioFormats.includes(previewFormat)));
  const isAudio = !!previewBlob && !isVideo && (task.convertType === 'audio' || audioFormats.includes(previewFormat));
  const isImage = !!previewBlob && imageFormats.includes(previewFormat);
  const isPdf = !!previewBlob && previewFormat === 'pdf';

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-medium text-[var(--text)] truncate flex-1">{isSource ? '预览源文件' : '预览'}</span>
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isSource && !item ? (
          <div className="flex items-center justify-center h-full text-[var(--text-faint)] text-xs">选择转换项以预览</div>
        ) : !isSource && item.status === 'converting' ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">转换中 {item.progress}%</p>
          </div>
        ) : !isSource && item.status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400/60 text-xs gap-1">
            <p>转换失败</p>
            <p>{item.error}</p>
          </div>
        ) : needsDecode && !decodedUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {decoding ? (
              <>
                <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                <p className="text-xs text-[var(--text-muted)]">正在解码预览...</p>
              </>
            ) : (
              <p className="text-xs text-[var(--text-faint)]">无法预览此格式</p>
            )}
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
            <span className="text-[10px] uppercase text-[#00d4ff]">{previewFormat}</span>
            <audio ref={audioRef} src={effectiveUrl} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} className="hidden" />
            <audio src={effectiveUrl} controls className="w-full mt-2" style={{ height: 32 }} />
          </div>
        ) : isVideo ? (
          <video src={previewUrl} controls className="w-full max-h-full rounded-lg" />
        ) : isImage ? (
          <div className="flex items-center justify-center h-full">
            <img src={isSource && rotatedUrl ? rotatedUrl : effectiveUrl} alt={task.fileName} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        ) : isPdf ? (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
              </div>
            ) : pdfPages.length > 0 ? (
              pdfPages.map((url, idx) => (
                <figure key={idx} className="rounded-lg overflow-hidden border border-[var(--border)] bg-white shadow-sm">
                  <img src={url} alt={`第 ${idx + 1} 页`} className="w-full h-auto block" />
                  <figcaption className="text-center text-[10px] text-[var(--text-muted)] py-1 bg-[var(--surface)]">{idx + 1} / {pdfPages.length}</figcaption>
                </figure>
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-[var(--text-faint)] text-xs">无法预览此 PDF</div>
            )}
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
      {!isSource && item?.status === 'done' && (
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