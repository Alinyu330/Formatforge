/**
 * QQ 音乐 GetEVkey CORS 代理 Worker
 *
 * 背景：生产环境（GitHub Pages 静态站点）在前端直接跨域 POST u.y.qq.com 时，
 * 预检响应缺少 Access-Control-Allow-Origin，浏览器以 net::ERR_FAILED 拦截。
 * 本 Worker 在服务端转发请求并透传用户 Cookie，从而规避 CORS。
 *
 * 前端通过构建环境变量 VITE_QQMUSIC_PROXY_URL 指向本 Worker，
 * 并以自定义请求头 X-QQMusic-Cookie 传递用户粘贴的 QQ 音乐 Cookie。
 *
 * 部署：wrangler deploy 或通过 Cloudflare API 上传（script name: qqmusic-proxy）
 */
const TARGET = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

addEventListener('fetch', (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-QQMusic-Cookie',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'POST') {
    const cookie = request.headers.get('X-QQMusic-Cookie') || '';
    const body = await request.text();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (cookie) {
      headers.set('Cookie', cookie);
      headers.set('Referer', 'https://y.qq.com/');
    }
    const resp = await fetch(TARGET, { method: 'POST', headers, body });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': resp.headers.get('Content-Type') || 'application/json; charset=utf-8',
      },
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
