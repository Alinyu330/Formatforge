interface Props {
  formats: { value: string; label: string }[];
  selected: string;
  onChange: (format: string) => void;
}

export default function FormatSelector({ formats, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {formats.map((fmt) => (
        <button
          key={fmt.value}
          onClick={() => onChange(fmt.value)}
          className={`
            px-4 py-2 rounded-xl text-xs font-medium tracking-wider uppercase
            transition-all duration-200 border
            ${
              selected === fmt.value
                ? 'bg-[#00d4ff]/15 border-[#00d4ff] text-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.15)]'
                : 'bg-white/[0.03] border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
            }
          `}
        >
          {fmt.label}
        </button>
      ))}
    </div>
  );
}
