import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Music, Video, Grid3X3, Image, PanelRightClose, PanelRightOpen, AlertTriangle } from 'lucide-react';
import { useConvertStore } from '@/store/convertStore';
import PreviewPanel from './PreviewPanel';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { icon: Music, label: '音频', route: '/audio' },
  { icon: Video, label: '视频', route: '/video' },
  { icon: Image, label: '图片', route: '/image' },
  { icon: Grid3X3, label: '办公转换', route: '/office' },
];

interface Props { children: React.ReactNode; }
export default function ConvertLayout({ children }: Props) {
  const navigate = useNavigate(); const location = useLocation(); const { sidebarOpen, toggleSidebar } = useConvertStore();
  return <div className="min-h-screen bg-[var(--bg)] flex flex-col">
    <div className="sticky top-0 z-[60]"><div className="px-2 sm:px-4 py-1.5 bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-600/90 text-white text-[10px] sm:text-xs font-medium text-center flex items-center justify-center gap-1 sm:gap-2 shadow-lg"><AlertTriangle className="w-3 h-3" /><span>仅供个人使用，禁止商用 — 上限50个文件</span></div>
      <header className="bg-[var(--bg)] backdrop-blur-xl border-b border-[var(--border)]"><div className="max-w-full mx-auto px-2 sm:px-4 h-12 flex items-center gap-1 sm:gap-3"><button onClick={() => navigate('/')} className="p-1.5 rounded-lg text-[var(--text-muted)]"><ArrowLeft className="w-4 h-4" /></button><span onClick={() => navigate('/')} className="hidden sm:block text-xs font-bold tracking-wider text-[var(--text)] cursor-pointer">FormatForge</span><div className="flex items-center gap-0.5 sm:gap-1 ml-0 sm:ml-2">{navItems.map(({ icon: Icon, label, route }) => { const active = route === '/office' ? ['/office', '/sheet', '/document'].includes(location.pathname) : location.pathname === route; return <button key={route} onClick={() => navigate(route)} className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium ${active ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-[var(--text-muted)]'}`}><Icon className="w-3 h-3" />{label}</button>; })}</div><div className="flex-1" /><ThemeToggle /><button onClick={toggleSidebar} className="p-1.5 text-[var(--text-muted)]">{sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}</button></div></header>
    </div>
    <div className="flex flex-1"><main className="flex-1 min-w-0 px-3 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-6">{children}</main><PreviewPanel /></div>
  </div>;
}
