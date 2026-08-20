import { useConvertStore } from '@/store/convertStore';

const ORIENTATIONS = [
  { value: 'auto', label: '自动' },
  { value: 'portrait', label: '纵向' },
  { value: 'landscape', label: '横向' },
] as const;

export default function PdfMergeOptions() {
  const { pdfMergeOptions, setPdfMergeOptions } = useConvertStore();

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">页面方向</span>
        <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPdfMergeOptions({ orientation: o.value })}
              className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs transition-colors ${
                pdfMergeOptions.orientation === o.value
                  ? 'bg-[#00d4ff] text-[#0f1724]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">边距</span>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={pdfMergeOptions.margin || ''}
          onChange={(e) => setPdfMergeOptions({ margin: e.target.value ? Math.max(0, Number(e.target.value)) : 0 })}
          className="w-16 sm:w-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)]
            focus:outline-none focus:border-[#00d4ff]/50 hover:border-[var(--border-strong)] transition-colors"
        />
        <span className="text-[9px] sm:text-[10px] text-[var(--text-faint)]">px</span>
      </div>
    </div>
  );
}