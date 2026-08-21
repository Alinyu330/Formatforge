import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { getPlatform } from './utils/platform'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker 自动更新：
// 新版 SW（skipWaiting + clientsClaim）接管页面时自动刷新，确保用户不会长期停留在旧缓存代码上
// （历史问题：注入的 registerSW.js 只注册不刷新，部署新版本后旧标签页/PWA 会一直运行旧代码，
//  表现为"按钮无响应、多文件丢失"等已在旧版本修复的问题反复出现）。
// 仅生产环境 + Web 平台生效（原生构建无 SW，开发环境无 SW）。
if (import.meta.env.PROD && 'serviceWorker' in navigator && getPlatform() === 'web') {
  let hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 首次安装 SW 接管页面时无需刷新；仅当旧 SW 被新版本替换时刷新一次
    if (!hadController) { hadController = true; return; }
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.ready.then((registration) => {
    // 页面加载后立即检查一次更新，之后每小时后台检查，长驻 PWA 会话也能及时升级
    registration.update().catch(() => {});
    setInterval(() => { registration.update().catch(() => {}); }, 60 * 60 * 1000);
  }).catch(() => {});
}
