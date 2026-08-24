import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Download,
  Monitor,
  Smartphone,
  Tag,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { VERSIONS } from '@/data/versions';
import { openGuide } from '@/utils/guide';

export default function History() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col relative overflow-hidden">
      {/* 装饰性背景层（与首页一致） */}
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-[#00d4ff]/10 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute top-40 -left-20 w-72 h-72 rounded-full bg-[#7c3aed]/10 blur-[100px] animate-float-slow" />

      {/* Header */}
      <header className="relative z-10 pt-8 sm:pt-10 pb-6 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回首页
            </button>
            <div className="flex-1" />
            <ThemeToggle />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-wider font-display text-center">
            <span className="text-shimmer">历史版本</span>
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-[var(--text-muted)]">
            全部版本更新记录 · 可下载对应历史版本安装包
          </p>
        </div>
      </header>

      {/* Version list */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 pb-16">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {VERSIONS.map((v, idx) => {
            const isLatest = idx === 0;
            return (
              <section
                key={v.version}
                className={`relative rounded-2xl border p-4 sm:p-5 animate-fade-in-up ${
                  isLatest
                    ? 'border-[#00d4ff]/40 bg-[#00d4ff]/[0.04] shadow-[0_0_32px_rgba(0,212,255,0.08)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                {/* 版本头行 */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold font-mono ${
                      isLatest
                        ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                        : 'bg-[var(--surface-hover)] text-[var(--text-strong)] border border-[var(--border)]'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {v.version}
                  </span>
                  {isLatest && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      最新版本
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-[var(--text-faint)]">
                    <CalendarDays className="w-3 h-3" />
                    {v.date}
                  </span>
                </div>

                <h2 className="text-sm sm:text-base font-semibold text-[var(--text-strong)] mb-2">
                  {v.title}
                </h2>

                <ul className="space-y-1 mb-3">
                  {v.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex gap-2 text-[11px] sm:text-[13px] text-[var(--text-muted)] leading-relaxed"
                    >
                      <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${isLatest ? 'bg-[#00d4ff]' : 'bg-[var(--text-faint)]'}`} />
                      {h}
                    </li>
                  ))}
                </ul>

                {/* 下载入口 */}
                {v.assets.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                    {v.assets.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors
                          border-[#00d4ff]/30 text-[#00d4ff] bg-[#00d4ff]/[0.06]
                          hover:bg-[#00d4ff]/15 hover:border-[#00d4ff]/50 active:scale-[0.98]"
                      >
                        {a.platform === 'windows' ? (
                          <Monitor className="w-3.5 h-3.5" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5" />
                        )}
                        {a.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="pt-2 border-t border-[var(--border)] text-[10px] sm:text-xs text-[var(--text-faint)]">
                    该版本无独立安装包（网页版直接更新）
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </main>

      <footer className="relative z-10 py-6 pb-24 sm:pb-20 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => openGuide()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            使用说明
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            返回下载客户端
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-faint)]">
          所有处理在浏览器本地完成 &middot; 无需上传服务器 &middot; 保护隐私安全
        </p>
      </footer>
    </div>
  );
}
