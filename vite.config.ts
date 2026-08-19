import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 仓库名，如果部署到 username.github.io 则设为 '/'
// 如果部署到 username.github.io/repo-name 则设为 '/repo-name/'
// 原生 App 打包时使用相对路径，Web 部署时使用指定 base 路径
const BASE_PATH = process.env.CAPACITOR ? './' : (process.env.BASE_PATH || '/');

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
    VitePWA({
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
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024, // 40MB for ffmpeg wasm
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css|html|svg|png|wasm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
