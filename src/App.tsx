import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Home from '@/pages/Home';
import AudioConvert from '@/pages/AudioConvert';
import VideoConvert from '@/pages/VideoConvert';
import ImageConvert from '@/pages/ImageConvert';
import DocConvert from '@/pages/DocConvert';

const BASE_URL = import.meta.env.BASE_URL || '/';

export default function App() {
  return (
    <Router basename={BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audio" element={<AudioConvert />} />
        <Route path="/video" element={<VideoConvert />} />
        <Route path="/office" element={<DocConvert />} />
        <Route path="/sheet" element={<DocConvert />} />
        <Route path="/image" element={<ImageConvert />} />
        <Route path="/document" element={<DocConvert />} />
      </Routes>
      <div className="fixed left-0 right-0 bottom-16 sm:bottom-4 z-[110] flex justify-center px-3 pointer-events-none">
        <div className="group flex items-center gap-2 rounded-full border border-[#00d4ff]/20 bg-[var(--bg)] pl-2.5 pr-3 py-1.5 text-center shadow-[0_0_24px_rgba(0,212,255,0.12)] backdrop-blur-md pointer-events-auto">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff]"><Mail className="w-3 h-3" /></span>
          <span className="text-[11px] sm:text-xs text-[var(--text)]">反馈邮箱：<a href="mailto:xiaoyuyy3@gmail.com" className="text-[#00d4ff] hover:underline">xiaoyuyy3@gmail.com</a></span>
        </div>
      </div>
    </Router>
  );
}
