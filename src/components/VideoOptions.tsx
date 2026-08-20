import { useConvertStore } from '@/store/convertStore';

const SPEED_OPTIONS = [
  { value: 'ultrafast', label: '极速' },
  { value: 'superfast', label: '高速' },
  { value: 'veryfast', label: '较快' },
  { value: 'fast', label: '快' },
  { value: 'medium', label: '均衡' },
];

const QUALITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const RESOLUTION_OPTIONS = [
  { value: 'original', label: '原始分辨率' },
  { value: '1080p', label: '1080p（1920×1080）' },
  { value: '720p', label: '720p（1280×720）' },
  { value: '480p', label: '480p（854×480）' },
];

const AUDIO_BITRATE_OPTIONS = [
  { value: '128k', label: '128 kbps' },
  { value: '160k', label: '160 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '256k', label: '256 kbps' },
];

export default function VideoOptions() {
  const { videoOptions, setVideoOptions } = useConvertStore();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-3 items-center">
        <label className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">速度</span>
          <select
            value={videoOptions.preset}
            onChange={(e) => setVideoOptions({ preset: e.target.value as any })}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors"
          >
            {SPEED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-[#0f1724]">{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">质量</span>
          <select
            value={videoOptions.quality}
            onChange={(e) => setVideoOptions({ quality: e.target.value as any })}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors"
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-[#0f1724]">{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">分辨率</span>
          <select
            value={videoOptions.resolution}
            onChange={(e) => setVideoOptions({ resolution: e.target.value as any })}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors"
          >
            {RESOLUTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-[#0f1724]">{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">音频码率</span>
          <select
            value={videoOptions.audioBitrate}
            onChange={(e) => setVideoOptions({ audioBitrate: e.target.value })}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors"
          >
            {AUDIO_BITRATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-[#0f1724]">{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">
        速度越快输出文件越大；质量「高」文件更大、转换更久，请根据需求取舍。分辨率仅缩小、不放大，避免小视频被拉伸变糊。
      </p>
    </div>
  );
}