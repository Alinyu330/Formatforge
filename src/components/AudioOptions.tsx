import { useConvertStore } from '@/store/convertStore';

export default function AudioOptions() {
  const { audioOptions, setAudioOptions } = useConvertStore();

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/35">比特率</span>
        <select
          value={audioOptions.bitrate}
          onChange={(e) => setAudioOptions({ bitrate: e.target.value })}
          className="bg-white/[0.05] border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-white/70
            focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer
            hover:border-white/20 transition-colors"
        >
          <option value="128k">128 kbps</option>
          <option value="192k">192 kbps</option>
          <option value="256k">256 kbps</option>
          <option value="320k">320 kbps</option>
          <option value="lossless">无损</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/35">采样率</span>
        <select
          value={audioOptions.sampleRate}
          onChange={(e) => setAudioOptions({ sampleRate: Number(e.target.value) })}
          className="bg-white/[0.05] border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-white/70
            focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer
            hover:border-white/20 transition-colors"
        >
          <option value={44100}>44100 Hz</option>
          <option value={48000}>48000 Hz</option>
          <option value={96000}>96000 Hz</option>
        </select>
      </div>
    </div>
  );
}
