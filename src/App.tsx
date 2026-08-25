import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Home from '@/pages/Home';
import AudioConvert from '@/pages/AudioConvert';
import VideoConvert from '@/pages/VideoConvert';
import ImageConvert from '@/pages/ImageConvert';
import DocConvert from '@/pages/DocConvert';
import History from '@/pages/History';
import UpdateChecker from '@/components/UpdateChecker';
import { useConvertStore } from '@/store/convertStore';
import { LATEST } from '@/data/versions';

const BASE_URL = import.meta.env.BASE_URL || '/';

// 原生 App（Capacitor）构建使用相对路径 './'，Router 必须用默认根路径，
// 否则 basename 会变成 '.' 导致所有路由匹配失败（界面空白）
const routerBasename = BASE_URL.startsWith('/')
  ? (BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL)
  : undefined;

/**
 * 旧版 Service Worker 兼容垫片：
 * 旧 SW 的 NavigationRoute 会把带 ?v= 参数的「使用说明.html」导航劫持为
 * index.html（SPA 外壳无匹配路由，表现为黑色背景无内容）。此路由在 SPA 内
 * 接管该路径，用全屏 iframe 以「子资源请求」加载在线说明文档——子资源不会
 * 被 NavigationRoute 拦截，任何版本的 SW 下都能正确显示最新内容。
 * 新 SW（denylist 已含 .html）下导航直达静态文档，不会进入此路由。
 */
function GuideDocFrame() {
  return (
    <div className="fixed inset-0 z-[200] bg-white">
      <iframe
        src={`${BASE_URL}使用说明.html?v=${LATEST.version}`}
        title="FormatForge 使用说明"
        className="w-full h-full border-0"
      />
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
