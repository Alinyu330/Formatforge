/**
 * FormatForge 站点反向代理 Worker
 *
 * 将自定义域名（formatforge.asia / www.formatforge.asia）反向代理到
 * GitHub Pages 站点（alinyu330.github.io/Formatforge），使自定义域名与
 * 原 GitHub 域名均可访问同一站点，且地址栏保持自定义域名。
 *
 * 站点构建 base 为 /Formatforge/，资源均为绝对 /Formatforge/... 路径：
 *   - 根路径 "/" 重写到 "/Formatforge/"
 *   - 已含 "/Formatforge" 前缀的路径原样转发
 *   - 其余路径补全 "/Formatforge" 前缀
 *
 * 部署：wrangler deploy --config worker/site-wrangler.toml
 */
const UPSTREAM = 'https://alinyu330.github.io';

addEventListener('fetch', (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  let path = url.pathname;

  if (path === '/') {
    path = '/Formatforge/';
  } else if (!path.startsWith('/Formatforge')) {
    path = '/Formatforge' + path;
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

  return fetch(UPSTREAM + path + url.search, init);
}