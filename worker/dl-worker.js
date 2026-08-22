/**
 * FormatForge 下载分发 Worker（dl.formatforge.asia）
 *
 * 从 Cloudflare R2 桶（formatforge-2）直接分发安装包（EXE / APK 等），
 * 供国内用户高速直链下载，GitHub Release 作为备用下载源。
 *
 * 特性：
 *   - 支持 GET / HEAD
 *   - 支持 Range 断点续传（206 / Content-Range）
 *   - Content-Disposition 强制附件下载
 *   - no-store 禁止缓存，避免版本更新后 CDN/浏览器命中旧文件
 *   - 允许跨域（下载管理器 / 第三方工具直链拉取）
 *
 * 部署：wrangler deploy --config dl-wrangler.toml
 */

const MIME = {
  exe: 'application/octet-stream',
  apk: 'application/vnd.android.package-archive',
  zip: 'application/zip',
  dmg: 'application/octet-stream',
  ipa: 'application/octet-stream',
  msi: 'application/octet-stream',
  blockmap: 'application/octet-stream',
};

function contentTypeFor(key) {
  const ext = key.split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    // 取根路径下的对象名，忽略查询串（链接带 ?v= 版本号做缓存穿透）
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!key || key.includes('..')) {
      return new Response('Not Found', { status: 404 });
    }

    const rangeHeader = request.headers.get('range');
    // R2 直接从请求 Headers 解析 Range（官方推荐方式），非 GET/HEAD 已在上方拦截
    const object = await env.BUCKET.get(key, { range: request.headers });
    if (object === null) {
      return new Response('Object Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Content-Type', contentTypeFor(key));
    headers.set('Content-Disposition', `attachment; filename="${key}"`);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    if (object.range) {
      const end = object.range.end ?? object.size - 1;
      headers.set(
        'Content-Range',
        `bytes ${object.range.offset}-${end}/${object.size}`,
      );
    }

    const status = rangeHeader ? 206 : 200;
    return new Response(request.method === 'HEAD' ? null : object.body, {
      status,
      headers,
    });
  },
};
