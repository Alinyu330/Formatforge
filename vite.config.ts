import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 仓库名，如果部署到 username.github.io 则设为 '/'
// 如果部署到 username.github.io/repo-name 则设为 '/repo-name/'
// 原生 App 打包时使用相对路径，Web 部署时使用指定 base 路径
const BASE_PATH = process.env.CAPACITOR ? './' : (process.env.BASE_PATH || '/');

// 通过 VITE_FFMPEG_WASM_URL 将 ffmpeg 的 wasm 托管到外部（如 Cloudflare R2 / GitHub Pages）时，
// 构建产物中剔除该 wasm，规避 Cloudflare Pages 25 MiB 单文件上限。
const stripFfmpegWasm = (): Plugin => ({
  name: 'strip-ffmpeg-wasm',
  apply: 'build',
  generateBundle(_options, bundle) {
    if (!process.env.VITE_FFMPEG_WASM_URL) return;
    for (const key of Object.keys(bundle)) {
      if (key.endsWith('.wasm')) delete bundle[key];
    }
  },
});

// GitHub Pages 静态托管不重写 SPA 深链接（如 /history、/audio），
// 直接访问或刷新会 404。输出一份 index.html 的副本作为 404.html，
// 让 React Router 在客户端接管路径。
const spa404Fallback = (): Plugin => ({
  name: 'spa-404-fallback',
  apply: 'build',
  // enforce: 'post' 保证在 Vite 内部 HTML 插件产出 index.html 之后再读取 bundle
  enforce: 'post',
  generateBundle(_options, bundle) {
    const index = bundle['index.html'];
    if (index?.type === 'asset') {
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: index.source,
      });
    }
  },
});

export default defineConfig({
  base: BASE_PATH,
  server: {
    proxy: {
      '/api/qqmusic': {
        target: 'https://u.y.qq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/qqmusic/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers['x-qqmusic-cookie'];
            if (typeof cookie === 'string') {
              proxyReq.setHeader('Cookie', cookie);
              proxyReq.setHeader('Referer', 'https://y.qq.com/');
            }
            proxyReq.removeHeader('x-qqmusic-cookie');
          });
        },
      },
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util'],
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths({ ignoreConfigErrors: true }),
    stripFfmpegWasm(),
    spa404Fallback(),
    // 原生 App（Capacitor）直接从本地资源加载，无需 Service Worker；
    // 且 SW 在 WebView 内可能劫持导航导致异常，故原生构建禁用 PWA
    ...(process.env.CAPACITOR ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FormatForge - 格式转换工具',
        short_name: 'FormatForge',
        description: '本地离线格式转换工具 - 音频、表格、图片、文档格式互转',
        theme_color: '#0f1724',
        background_color: '#0f1724',
        display: 'standalone',
        orientation: 'any',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        categories: ['utilities', 'productivity'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024, // 40MB for ffmpeg wasm
        // 禁止清理旧版本 precache。否则旧标签页仍引用旧 chunk 时，chunk 已被删除，
        // 会触发「Failed to fetch dynamically imported module」。
        cleanupOutdatedCaches: false,
        navigateFallback: 'index.html',
        // /api/ 走代理；.apk/.zip/.exe/.pdf 等下载文件必须绕过 SW，
        // 否则导航到下载链接会被劫持为 index.html（表现为"只显示背景和反馈邮箱"）
        // .html 同理：使用说明.html 带 ?v= 版本参数后不匹配 precache 条目，
        // 会落入 NavigationRoute 被劫持为 index.html（表现为"只有黑色背景无内容"），
        // 必须放行走网络；SPA 路由（/history 等）无 .html 后缀不受影响
        // ⚠️ workbox 对 pathname+search 整体做正则匹配（见 workbox-routing
        // NavigationRoute._match），带查询串的 URL 不以 .html 结尾，
        // 故必须用 (\?|$) 兼容 "?v=xxx" 形式，否则 denylist 永不命中
        navigateFallbackDenylist: [/^\/api\//, /\.(apk|zip|exe|dmg|ipa|pdf|html)(\?|$)/],
        runtimeCaching: [
          {
            // 仅缓存未被 globPatterns 预缓存的 ffmpeg wasm。
            // js/css/html 已由 globPatterns 按内容哈希预缓存，这里再用 CacheFirst
            // 会导致重新部署后仍命中旧版本资源，进而动态 import 加载失败。
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffmpeg-wasm',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    })]),
  ],
});
