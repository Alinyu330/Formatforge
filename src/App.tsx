import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Mail, ChevronLeft } from 'lucide-react';
import Home from '@/pages/Home';
import AudioConvert from '@/pages/AudioConvert';
import VideoConvert from '@/pages/VideoConvert';
import ImageConvert from '@/pages/ImageConvert';
import DocConvert from '@/pages/DocConvert';
import History from '@/pages/History';
import UpdateChecker from '@/components/UpdateChecker';
import { useConvertStore } from '@/store/convertStore';
import { LATEST } from '@/data/versions';
import { isNativePlatform } from '@/utils/platform';
import { guideOnlineUrl } from '@/utils/guide';

const BASE_URL = import.meta.env.BASE_URL || '/';

// 原生 App（Capacitor）构建使用相对路径 './'，Router 必须用默认根路径，
// 否则 basename 会变成 '.' 导致所有路由匹配失败（界面空白）
const routerBasename = BASE_URL.startsWith('/')
  ? (BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL)
  : undefined;

/**
 * 使用说明应用内全屏视图（客户端 /guide 路由入口 + 网页端旧 SW 劫持兜底）。
 *
 * 客户端（Electron / Android）：iframe 优先加载在线版文档（内容随网页部署
 * 实时更新），离线或加载失败回退本地打包副本；iframe 为子资源请求，不会被
 * Service Worker 的 NavigationRoute 拦截。
 * 网页端：加载同源站内文件（与部署内容一致）。
 * 顶部提供「返回主页」栏；文档内嵌时会自动隐藏自带返回按钮。
 */
function GuideDocFrame() {
  const navigate = useNavigate();
  const native = isNativePlatform();
  const localSrc = `${BASE_URL}使用说明.html?v=${LATEST.version}`;
  const [src, setSrc] = useState<string>(native ? '' : localSrc);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!native) return;
    let alive = true;
    // 探测在线版可用性（no-cors HEAD，5s 超时则回退本地副本）
    const online = guideOnlineUrl();
    const timer = setTimeout(() => { if (alive) setSrc(localSrc); }, 5000);
    fetch(online, { method: 'HEAD', mode: 'no-cors' })
      .then(() => { if (alive) { clearTimeout(timer); setSrc(online); setOnline(true); } })
      .catch(() => { if (alive) { clearTimeout(timer); setSrc(localSrc); } });
    return () => { alive = false; clearTimeout(timer); };
  }, [native, localSrc]);

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg)] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)]
            text-[11px] sm:text-xs font-medium text-[var(--text-muted)]
            hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]
            transition-colors cursor-pointer active:scale-[0.97]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          返回主页
        </button>
        <span className="text-xs sm:text-sm font-semibold text-[var(--text-strong)]">FormatForge 使用说明</span>
        {native && (
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${online ? 'text-[#10b981] border-[#10b981]/30' : 'text-[var(--text-faint)] border-[var(--border)]'}`}>
            {online ? '在线版 · 实时最新' : src ? '本地副本' : '加载中…'}
          </span>
        )}
      </div>
      <div className="flex-1 bg-white relative">
        {src ? (
          <iframe src={src} title="FormatForge 使用说明" className="w-full h-full border-0" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white">
            <span className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#00d4ff] animate-spin" />
            <span className="text-xs text-slate-400">正在加载使用说明…</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // 移动端预览为全屏浮层，打开时隐藏底部反馈条避免叠压
  const sidebarOpen = useConvertStore((s) => s.sidebarOpen);
  return (
    <Router basename={routerBasename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        {/* 客户端应用内使用说明入口 */}
        <Route path="/guide" element={<GuideDocFrame />} />
        {/* 旧版 SW 劫持兜底：使用说明.html 导航被劫持为 SPA 时由此接管 */}
        <Route path="/使用说明.html" element={<GuideDocFrame />} />
        <Route path="/audio" element={<AudioConvert />} />
        <Route path="/video" element={<VideoConvert />} />
        <Route path="/office" element={<DocConvert />} />
        <Route path="/sheet" element={<DocConvert />} />
        <Route path="/image" element={<ImageConvert />} />
        <Route path="/document" element={<DocConvert />} />
      </Routes>
      <div className={`fixed left-0 right-0 bottom-16 sm:bottom-4 z-[110] justify-center px-3 pointer-events-none ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        <div className="group flex items-center gap-2 rounded-full border border-[#00d4ff]/20 bg-[var(--bg)] pl-2.5 pr-3 py-1.5 text-center shadow-[0_0_24px_rgba(0,212,255,0.12)] backdrop-blur-md pointer-events-auto">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff]"><Mail className="w-3 h-3" /></span>
          <span className="text-[11px] sm:text-xs text-[var(--text)]">反馈邮箱：<a href="mailto:xiaoyuyy3@gmail.com" className="text-[#00d4ff] hover:underline">xiaoyuyy3@gmail.com</a></span>
        </div>
      </div>
      {/* 原生客户端（Electron / Android）应用内更新检查弹窗 */}
      <UpdateChecker />
    </Router>
  );
}
