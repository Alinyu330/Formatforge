import { useEffect, useState } from 'react';
import { Trash2, Download, CheckCircle2, AlertCircle, Loader2, Eye, GripVertical, Pin, RotateCcw, RotateCw } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import { formatFileSize, getAvailableTargetFormats, stripExtension } from '@/utils/format';
import FormatMultiSelector from '@/components/FormatMultiSelector';

export default function ConvertQueue() {
  const {
    tasks,
    removeTask,
    moveTask,
    pinTask,
    rotateTask,
    downloadItem,
    setPreviewTask,
    previewSourceFile,
    renameTask,
    setTaskSelected,
    setAllTasksSelected,
    setFormatsForSelected,
    updateTaskFormats,
  } = useConvertStore();

  const [batchFormat, setBatchFormat] = useState<string>('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const selectedCount = tasks.filter((t) => t.selected).length;
  const allSelected = selectedCount === tasks.length;
  const firstSelected = tasks.find((t) => t.selected);
  const batchFormats = firstSelected ? getAvailableTargetFormats(firstSelected) : [];

  useEffect(() => {
    if (firstSelected) {
      const formats = getAvailableTargetFormats(firstSelected);
      setBatchFormat((cur) => (formats.some((f) => f.value === cur) ? cur : formats[0]?.value || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstSelected?.id]);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 sm:px-4 py-2.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setAllTasksSelected(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#00d4ff] cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-[var(--text)]">全选</span>
        </label>
        <span className="text-[10px] sm:text-xs text-[var(--text-faint)]">已选 {selectedCount}/{tasks.length} 项</span>
      </div>

      {/* Batch apply: 指定格式 */}
      {selectedCount > 0 && firstSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 sm:px-4 py-2.5">
          <span className="text-[10px] sm:text-xs text-[var(--text-muted)]">将已选 {selectedCount} 项转换为</span>
          <select
            value={batchFormat}
            onChange={(e) => setBatchFormat(e.target.value)}
            className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-[11px] sm:text-xs text-[var(--text-strong)] outline-none focus:border-[#00d4ff]"
          >
            {batchFormats.map((f) => (
              <option key={f.value} value={f.value} className="text-[#0f1724] bg-white">{f.label}</option>
            ))}
          </select>
          <button
            onClick={() => batchFormat && setFormatsForSelected([batchFormat])}
            disabled={!batchFormat}
            className="px-3 py-1 rounded-lg text-[11px] sm:text-xs font-medium bg-[#00d4ff] text-[#0f1724] hover:bg-[#00d4ff]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            应用
          </button>
        </div>
      )}

      {tasks.map((task) => {
        const taskDone = task.items.some((i) => i.status === 'done');
        const taskError = task.items.some((i) => i.status === 'error');
        const taskConverting = task.items.some((i) => i.status === 'converting');
        const taskPending = task.items.some((i) => i.status === 'pending');
        const allDone = task.items.length > 0 && task.items.every((i) => i.status === 'done');
        const availableFormats = getAvailableTargetFormats(task);

        return (
          <div
            key={task.id}
            onDragOver={(e) => { if (dragId && dragId !== task.id) { e.preventDefault(); setDragOverId(task.id); } }}
            onDragLeave={() => setDragOverId((cur) => (cur === task.id ? null : cur))}
            onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== task.id) moveTask(dragId, task.id); setDragId(null); setDragOverId(null); }}
            className={`rounded-xl bg-[var(--surface)] border overflow-hidden transition-colors ${dragOverId === task.id ? 'border-[#00d4ff]' : 'border-[var(--border)]'} ${dragId === task.id ? 'opacity-40' : ''}`}
          >
            {/* Task header */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
              <button
                draggable
                onDragStart={(e) => { setDragId(task.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id); }}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                className="p-1 rounded cursor-grab active:cursor-grabbing text-[var(--text-faint)] hover:text-[var(--text)] shrink-0"
                title="拖动调整顺序"
              >
                <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <input
                type="checkbox"
                checked={task.selected}
                onChange={(e) => setTaskSelected(task.id, e.target.checked)}
                className="w-3.5 h-3.5 accent-[#00d4ff] cursor-pointer shrink-0"
              />
              {taskConverting ? (
                <Loader2 className="w-4 h-4 text-[#00d4ff] animate-spin shrink-0" />
              ) : allDone ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : taskError && !taskPending && !taskConverting ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-[var(--border-strong)] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <input
                  value={task.customName ?? stripExtension(task.fileName)}
                  onChange={(e) => renameTask(task.id, e.target.value)}
                  placeholder={stripExtension(task.fileName)}
                  className="w-full bg-transparent text-xs sm:text-sm text-[var(--text-strong)] truncate outline-none border-b border-transparent focus:border-[#00d4ff] transition-colors"
                  title="重命名输出文件"
                />
                <span className="text-[10px] text-[var(--text-faint)]">
                  {formatFileSize(task.fileSize)} · {task.sourceFormat}
                </span>
              </div>
              <button
                onClick={() => pinTask(task.id)}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors shrink-0 ${task.pinned ? 'text-[#f59e0b] hover:bg-[#f59e0b]/10' : 'text-[var(--text-faint)] hover:text-[#f59e0b] hover:bg-[#f59e0b]/10'}`}
                title={task.pinned ? '已置顶，点击提到最前' : '置顶'}
              >
                <Pin className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${task.pinned ? 'fill-current' : ''}`} />
              </button>
              {task.convertType === 'image' && (
                <>
                  <button onClick={() => rotateTask(task.id, 'ccw')} className="p-1 sm:p-1.5 rounded-lg hover:bg-[#00d4ff]/10 text-[var(--text-faint)] hover:text-[#00d4ff] transition-colors shrink-0" title="逆时针旋转 90°">
                    <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button onClick={() => rotateTask(task.id, 'cw')} className="p-1 sm:p-1.5 rounded-lg hover:bg-[#00d4ff]/10 text-[var(--text-faint)] hover:text-[#00d4ff] transition-colors shrink-0" title="顺时针旋转 90°">
                    <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  {(task.rotation ?? 0) !== 0 && (
                    <span className="text-[9px] text-[#00d4ff] font-medium shrink-0">{task.rotation}°</span>
                  )}
                </>
              )}
              <button onClick={() => previewSourceFile(task.id)} className="p-1 sm:p-1.5 rounded-lg hover:bg-[#00d4ff]/10 text-[var(--text-faint)] hover:text-[#00d4ff] transition-colors shrink-0" title="预览源文件">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button onClick={() => removeTask(task.id)} className="p-1 sm:p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-faint)] hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Per-task format selector */}
            {availableFormats.length > 0 && (
              <div className="px-3 sm:px-4 pb-2.5">
                <FormatMultiSelector
                  formats={availableFormats}
                  selected={task.items.map((i) => i.targetFormat)}
                  onChange={(formats) => updateTaskFormats(task.id, formats)}
                />
              </div>
            )}

            {/* Conversion items */}
            {task.items.length > 0 && (
              <div className="border-t border-[var(--border)] px-3 sm:px-4 py-2 space-y-1">
                {task.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-[10px] sm:text-[11px] flex-wrap">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    ) : item.status === 'error' ? (
                      <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    ) : item.status === 'converting' ? (
                      <Loader2 className="w-3 h-3 text-[#00d4ff] animate-spin shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-[var(--border)] shrink-0" />
                    )}

                    <span className="text-[var(--text-muted)] min-w-[3ch]">{task.sourceFormat}</span>
                    <span className="text-[var(--text-faint)]">&rarr;</span>
                    <span className={`uppercase font-medium ${item.status === 'done' ? 'text-[#00d4ff]' : 'text-[var(--text)]'}`}>
                      {item.targetFormat}
                    </span>

                    {item.status === 'converting' && (
                      <div className="flex-1 h-1 min-w-[40px] bg-[var(--surface)] rounded-full overflow-hidden ml-1 sm:ml-2">
                        <div className="h-full bg-[#00d4ff] rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}

                    {item.status === 'error' && item.error && (
                      <span className="text-red-400 truncate flex-1 text-[9px] sm:text-[10px]">{item.error}</span>
                    )}

                    <div className="flex-1 min-w-[20px]" />

                    {item.status === 'done' && (
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <span className="text-[9px] sm:text-[10px] text-[var(--text-faint)]">{formatFileSize(item.resultBlob?.size || 0)}</span>
                        <button onClick={() => setPreviewTask(task.id, item.id)} className="p-1 rounded hover:bg-[#7c3aed]/10 text-[var(--text-muted)] hover:text-[#a855f7]" title="预览">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={() => downloadItem(task.id, item.id)} className="p-1 rounded hover:bg-[#00d4ff]/10 text-[var(--text-muted)] hover:text-[#00d4ff]" title="下载">
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