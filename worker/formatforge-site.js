/**
 * FormatForge 站点反向代理 Worker
 *
 * 将自定义域名（formatforge.asia / www.formatforge.asia）反向代理到
 * GitHub Pages 站点（alinyu330.github.io/Formatforge），使自定义域名与
 * 原 GitHub 域名均可访问同一站点，且地址栏保持自定义域名。
 *
 * 站点为 React Router 应用，basename 固定为 /Formatforge，且构建 base 为
 * /Formatforge/（资源均为绝对 /Formatforge/... 路径）。因此：
 *   - 根路径 "/" 或非 /Formatforge 路径 → 重定向到 /Formatforge/...，
 *     使地址栏路径匹配 Router basename
 *   - 已含 /Formatforge 前缀的路径 → 原样反向代理到上游
 *
 * 部署：wrangler deploy --config worker/site-wrangler.toml
 */
const UPSTREAM = 'https://alinyu330.github.io';

addEventListener('fetch', (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 根路径或非 /Formatforge 路径先重定向到 /Formatforge/... 以匹配 Router basename
  if (path === '/' || !path.startsWith('/Formatforge')) {
    const target = '/Formatforge' + (path === '/' ? '/' : path) + url.search;
    return Response.redirect(new URL(target, url.origin).href, 302);
  }

  const headers = new Headers(request.headers);
  headers.delete('Host');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(UPSTREAM + path + url.search, init);

  // 下载文件与 404 页面禁止缓存，避免部署窗口期或版本更新后，
  // 客户端/CDN 仍命中旧缓存（如误把 APK 请求缓存的 404 页面）
  const isDownload = path.toLowerCase().endsWith('.apk');
  const is404 = response.status === 404;
  if (isDownload || is404) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (is404) newHeaders.set('Pragma', 'no-cache');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
}