import { Trash2, Download, CheckCircle2, AlertCircle, Loader2, Eye } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import { formatFileSize } from '@/utils/format';

export default function ConvertQueue() {
  const { tasks, removeTask, downloadItem, setPreviewTask } = useConvertStore();
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const taskDone = task.items.some((i) => i.status === 'done');
        const taskError = task.items.some((i) => i.status === 'error');
        const taskConverting = task.items.some((i) => i.status === 'converting');
        const taskPending = task.items.some((i) => i.status === 'pending');
        const allDone = task.items.length > 0 && task.items.every((i) => i.status === 'done');

        return (
          <div key={task.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
            {/* Task header */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
              {taskConverting ? (
                <Loader2 className="w-4 h-4 text-[#00d4ff] animate-spin shrink-0" />
              ) : allDone ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : taskError && !taskPending && !taskConverting ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/15 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm text-white/80 truncate block">{task.fileName}</span>
                <span className="text-[10px] text-white/25">{formatFileSize(task.fileSize)}</span>
              </div>
              <button onClick={() => removeTask(task.id)} className="p-1 sm:p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Conversion items */}
            {task.items.length > 0 && (
              <div className="border-t border-white/[0.03] px-3 sm:px-4 py-2 space-y-1">
                {task.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-[10px] sm:text-[11px] flex-wrap">
                    {/* Status icon */}
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    ) : item.status === 'error' ? (
                      <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    ) : item.status === 'converting' ? (
                      <Loader2 className="w-3 h-3 text-[#00d4ff] animate-spin shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-white/10 shrink-0" />
                    )}

                    {/* Format info */}
                    <span className="text-white/40 min-w-[3ch]">{task.sourceFormat}</span>
                    <span className="text-white/15">&rarr;</span>
                    <span className={`uppercase font-medium ${item.status === 'done' ? 'text-[#00d4ff]' : 'text-white/50'}`}>
                      {item.targetFormat}
                    </span>

                    {/* Progress bar */}
                    {item.status === 'converting' && (
                      <div className="flex-1 h-1 min-w-[40px] bg-white/[0.06] rounded-full overflow-hidden ml-1 sm:ml-2">
                        <div className="h-full bg-[#00d4ff] rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}

                    {/* Error */}
                    {item.status === 'error' && item.error && (
                      <span className="text-red-400 truncate flex-1 text-[9px] sm:text-[10px]">{item.error}</span>
                    )}

                    <div className="flex-1 min-w-[20px]" />

                    {/* Actions */}
                    {item.status === 'done' && (
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <span className="text-[9px] sm:text-[10px] text-white/20">{formatFileSize(item.resultBlob?.size || 0)}</span>
                        <button onClick={() => setPreviewTask(task.id, item.id)} className="p-1 rounded hover:bg-[#7c3aed]/10 text-white/30 hover:text-[#a855f7]" title="预览">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={() => downloadItem(task.id, item.id)} className="p-1 rounded hover:bg-[#00d4ff]/10 text-white/30 hover:text-[#00d4ff]" title="下载">
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
