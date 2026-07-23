import { useConvertStore } from '@/store/convertStore';

export default function ImageOptions() {
  const { imageOptions, setImageOptions } = useConvertStore();

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/35">质量</span>
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round(imageOptions.quality * 100)}
          onChange={(e) => setImageOptions({ quality: Number(e.target.value) / 100 })}
          className="w-20 sm:w-24 h-1.5 bg-white/[0.08] rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 sm:[&::-webkit-slider-thumb]:w-3.5 sm:[&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00d4ff]
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,212,255,0.5)]"
        />
        <span className="text-[10px] sm:text-xs text-[#00d4ff] w-8">{Math.round(imageOptions.quality * 100)}%</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/35">最大宽度</span>
        <input
          type="number"
          placeholder="不限"
          value={imageOptions.maxWidth || ''}
          onChange={(e) => setImageOptions({ maxWidth: e.target.value ? Number(e.target.value) : undefined })}
          className="w-16 sm:w-20 bg-white/[0.05] border border-white/10 rounded-lg px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs text-white/70
            focus:outline-none focus:border-[#00d4ff]/50 hover:border-white/20 transition-colors"
        />
        <span className="text-[9px] sm:text-[10px] text-white/25">px</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/35">最大高度</span>
        <input
          type="number"
          placeholder="不限"
          value={imageOptions.maxHeight || ''}
          onChange={(e) => setImageOptions({ maxHeight: e.target.value ? Number(e.target.value) : undefined })}
          className="w-16 sm:w-20 bg-white/[0.05] border border-white/10 rounded-lg px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs text-white/70
            focus:outline-none focus:border-[#00d4ff]/50 hover:border-white/20 transition-colors"
        />
        <span className="text-[9px] sm:text-[10px] text-white/25">px</span>
      </div>
    </div>
  );
}
