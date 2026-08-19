import { Check } from 'lucide-react';

interface FormatOption {
  value: string;
  label: string;
}

interface Props {
  formats: FormatOption[];
  selected: string[];
  onChange: (formats: string[]) => void;
}

export default function FormatMultiSelector({ formats, selected, onChange }: Props) {
  const toggle = (fmt: string) => {
    if (selected.includes(fmt)) {
      onChange(selected.filter((f) => f !== fmt));
    } else {
      onChange([...selected, fmt]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((fmt) => {
        const isSelected = selected.includes(fmt.value);
        return (
          <button
            key={fmt.value}
            onClick={() => toggle(fmt.value)}
            className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all duration-200
              ${isSelected
                ? 'bg-[#00d4ff]/15 border border-[#00d4ff]/40 text-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.1)]'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
              }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {fmt.label}
          </button>
        );
      })}
    </div>
  );
}
