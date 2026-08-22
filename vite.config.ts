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
        navigateFallbackDenylist: [/^\/api\//, /\.(apk|zip|exe|dmg|ipa|pdf)$/],
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
