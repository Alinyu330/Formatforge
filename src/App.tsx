import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Home from '@/pages/Home';
import AudioConvert from '@/pages/AudioConvert';
import SheetConvert from '@/pages/SheetConvert';
import ImageConvert from '@/pages/ImageConvert';
import DocConvert from '@/pages/DocConvert';

// 兼容 GitHub Pages 子路径部署（自动读取 vite base 路径）
const BASE_URL = import.meta.env.BASE_URL || '/';

export default function App() {
  return (
    <Router basename={BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audio" element={<AudioConvert />} />
        <Route path="/sheet" element={<SheetConvert />} />
        <Route path="/image" element={<ImageConvert />} />
        <Route path="/document" element={<DocConvert />} />
      </Routes>

      <div className="fixed left-0 right-0 bottom-16 sm:bottom-4 z-[110] flex justify-center px-3 pointer-events-none">
        <div className="group flex items-center gap-2 rounded-full border border-[#00d4ff]/20 bg-[#0f1724]/90 pl-2.5 pr-3 py-1.5 text-center shadow-[0_0_24px_rgba(0,212,255,0.12)] backdrop-blur-md pointer-events-auto transition-all hover:border-[#00d4ff]/40 hover:shadow-[0_0_28px_rgba(0,212,255,0.22)]">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] shrink-0">
            <Mail className="w-3 h-3" />
          </span>
          <span className="text-[11px] sm:text-xs text-white/60">
            反馈邮箱：
            <a href="mailto:xiaoyuyy3@gmail.com" className="text-[#00d4ff] hover:underline underline-offset-2 transition-opacity">xiaoyuyy3@gmail.com</a>
          </span>
        </div>
      </div>
    </Router>
  );
}
