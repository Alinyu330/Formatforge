import { useNavigate } from 'react-router-dom';
import { Music, Grid3X3, Image, FileText, Shield, Zap, Smartphone, AlertTriangle, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Music,
    title: '音频转换',
    description: '主流音频格式互转，支持QQ音乐/网易云/酷狗加密格式解密',
    formats: ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG', 'M4A', 'WMA', 'QMC', 'NCM'],
    route: '/audio',
    from: '#00d4ff',
    to: '#0ea5e9',
    glow: 'rgba(0,212,255,0.22)',
  },
  {
    icon: Grid3X3,
    title: '表格转换',
    description: 'XLSX、CSV、ODS、HTML 等电子表格格式互相转换',
    formats: ['XLSX', 'CSV', 'ODS', 'HTML'],
    route: '/sheet',
    from: '#7c3aed',
    to: '#a855f7',
    glow: 'rgba(124,58,237,0.22)',
  },
  {
    icon: Image,
    title: '图片转换',
    description: 'PNG、JPG、WEBP、BMP、GIF、ICO 等图片格式互转',
    formats: ['PNG', 'JPG', 'WEBP', 'BMP', 'GIF', 'ICO'],
    route: '/image',
    from: '#f59e0b',
    to: '#f97316',
    glow: 'rgba(245,158,11,0.22)',
  },
  {
    icon: FileText,
    title: '文档转换',
    description: 'Word、PPT 文档互转及提取为 TXT/HTML/PDF 格式',
    formats: ['DOCX', 'PPTX', 'TXT', 'HTML', 'PDF'],
    route: '/document',
    from: '#10b981',
    to: '#34d399',
    glow: 'rgba(16,185,129,0.22)',
  },
];

const highlights = [
  { icon: Shield, label: '完全离线', desc: '无需联网，数据不离开设备' },
  { icon: Zap, label: '批量处理', desc: '支持多文件同时转换' },
  { icon: Smartphone, label: '跨平台', desc: 'PC / 安卓均可安装使用' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1724] flex flex-col relative overflow-hidden">
      {/* 装饰性背景层 */}
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-[#00d4ff]/10 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute top-40 -left-20 w-72 h-72 rounded-full bg-[#7c3aed]/10 blur-[100px] animate-float-slow" />
      <div className="pointer-events-none absolute top-20 -right-20 w-72 h-72 rounded-full bg-[#f59e0b]/8 blur-[100px] animate-float-slow" style={{ animationDelay: '2s' }} />

      {/* Anti-commercial banner */}
      <div className="sticky top-0 z-[60] px-4 py-1.5 bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-600/90 text-white text-[11px] sm:text-xs font-medium text-center flex items-center justify-center gap-2 shadow-lg">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>仅供个人使用，禁止商用盈利行为 — 同时转换上限10个文件</span>
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
      </div>

      {/* Header */}
      <header className="relative z-10 py-8 sm:py-12 px-4 sm:px-6 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00d4ff]/20 bg-[#00d4ff]/5 text-[10px] sm:text-[11px] text-[#00d4ff]/80 mb-4 sm:mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
          本地离线 · 隐私优先 · 无需上传
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-wider font-display">
          <span className="text-shimmer">FormatForge</span>
        </h1>
        <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
          一站式本地格式转换工具，音频 / 表格 / 图片 / 文档
          <br className="hidden sm:block" />
          全部在浏览器内完成，数据安全可控
        </p>
      </header>

      {/* Feature Cards */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-5xl">
          {features.map(({ icon: Icon, title, description, formats, route, from, to, glow }, idx) => (
            <button
              key={route}
              onClick={() => navigate(route)}
              style={{ animationDelay: `${idx * 80}ms` }}
              className="group relative p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]
                hover:bg-white/[0.04] hover:border-white/[0.14] hover:-translate-y-1
                transition-all duration-300 text-left cursor-pointer active:scale-[0.98] animate-fade-in-up opacity-0 overflow-hidden"
            >
              {/* 序号角标 */}
              <span className="absolute top-3 right-3 text-[10px] font-mono text-white/15 group-hover:text-white/30 transition-colors">
                0{idx + 1}
              </span>

              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 6px 20px -4px ${glow}` }}
              >
                <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
              </div>

              <h3 className="text-xs sm:text-sm font-semibold text-white/90 mb-1 group-hover:text-white transition-colors">{title}</h3>
              <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed mb-2 sm:mb-3">{description}</p>

              <div className="flex flex-wrap gap-1">
                {formats.map((f) => (
                  <span
                    key={f}
                    className="px-1 py-0.5 sm:px-1.5 sm:py-0.5 text-[8px] sm:text-[9px] rounded-md bg-white/[0.04] text-white/30
                      group-hover:text-white/50 group-hover:bg-white/[0.08] transition-colors"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* 进入箭头 */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all duration-300">
                <ArrowRight className="w-3.5 h-3.5" style={{ color: from }} />
              </div>

              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500
                pointer-events-none"
                style={{ background: `radial-gradient(400px circle at center, ${glow}, transparent 70%)` }}
              />
            </button>
          ))}
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-8 sm:mt-12 w-full max-w-2xl">
          {highlights.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center sm:items-start sm:flex-row sm:gap-3 gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#00d4ff]/8 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00d4ff]/70" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs font-medium text-white/70">{label}</p>
                <p className="text-[9px] sm:text-[10px] text-white/25 hidden sm:block">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 py-6 pb-24 sm:pb-20 text-center">
        <p className="text-[10px] text-white/15">
          所有处理在浏览器本地完成 &middot; 无需上传服务器 &middot; 保护隐私安全
        </p>
      </footer>
    </div>
  );
}
