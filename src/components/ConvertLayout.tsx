import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Music, Grid3X3, Image, FileText, PanelRightClose, PanelRightOpen, AlertTriangle } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import PreviewPanel from './PreviewPanel';

const navItems = [
  { icon: Music, label: '音频', route: '/audio' },
  { icon: Grid3X3, label: '表格', route: '/sheet' },
  { icon: Image, label: '图片', route: '/image' },
  { icon: FileText, label: '文档', route: '/document' },
];

interface Props { children: React.ReactNode; }

export default function ConvertLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useConvertStore();

  return (
    <div className="min-h-screen bg-[#0f1724] flex flex-col">
      {/* Sticky 顶部容器：banner + 导航一起吸顶，避免手动计算偏移 */}
      <div className="sticky top-0 z-[60]">
        {/* Anti-commercial banner */}
        <div className="px-2 sm:px-4 py-1.5 bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-600/90 text-white text-[10px] sm:text-xs font-medium text-center flex items-center justify-center gap-1 sm:gap-2 shadow-lg">
          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>仅供个人使用，禁止商用 — 上限10个文件</span>
          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden sm:block" />
        </div>

        {/* Header nav */}
        <header className="bg-[#0f1724]/95 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="max-w-full mx-auto px-2 sm:px-4 h-12 flex items-center gap-1 sm:gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/70">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span onClick={() => navigate('/')} className="hidden sm:block text-xs font-bold tracking-wider text-white/50 hover:text-white/70 cursor-pointer shrink-0">FormatForge</span>
            {/* Always show nav items on desktop, show compact version on mobile */}
            <div className="flex items-center gap-0.5 sm:gap-1 ml-0 sm:ml-2">
              {navItems.map(({ icon: Icon, label, route }) => (
                <button key={route} onClick={() => navigate(route)}
                  className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all ${location.pathname === route ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'}`}>
                  <Icon className="w-3 h-3 sm:w-3 sm:h-3" />{label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/35 hover:text-white/60" title={sidebarOpen ? '关闭预览' : '打开预览'}>
              {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          </div>
        </header>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f1724]/95 backdrop-blur-xl border-t border-white/[0.04]">
        <div className="flex items-center justify-around h-14 pb-safe">
          {navItems.map(({ icon: Icon, label, route }) => (
            <button key={route} onClick={() => navigate(route)}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${location.pathname === route ? 'text-[#00d4ff]' : 'text-white/30'}`}>
              <Icon className="w-5 h-5" />{label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main + Sidebar */}
      <div className="flex flex-1">
        <main className="flex-1 min-w-0 px-3 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-6">
          {children}
        </main>
        <PreviewPanel />
      </div>

    </div>
  );
}
