/**
 * 在线内容页打开工具（使用说明 / 历史版本）
 *
 * 使用说明（v25 起）：客户端（Electron / Android）在应用内打开——SPA /guide
 * 路由全屏内嵌文档，在线版优先（内容随网页部署实时更新）、离线回退本地打包
 * 副本，顶部「返回主页」回到客户端主页，不再跳转系统浏览器。
 *
 * 历史版本（v26 起）：客户端同样在应用内打开——直接走站内 /history 路由
 * （原生页面，离线可用），不再跳系统浏览器。
 *
 * 网页端使用说明（v26 起）：新窗口打开时附带 from 参数（来源页地址），
 * 说明页「返回」优先关闭窗口回到来源页；关闭失败则跳回来源页而非主页。
 *
 * 在线地址统一处理：
 *   1. encodeURI 对路径中的中文文件名做百分号编码，避免 Electron shell 或
 *      Android Intent 解析未编码 URL 时出错；
 *   2. 附带版本查询参数 ?v=<LATEST.version>，每次发版自动穿透浏览器 / CDN
 *      缓存，保证历史版本与使用说明始终展示最新内容。
 */
import { getPlatform } from './platform';
import { LATEST } from '@/data/versions';

/** 主站地址（Cloudflare 部署，国内可达） */
const SITE_ORIGIN = 'https://formatforge.asia/Formatforge';

/** 使用说明在线地址（App 内 iframe 优先加载，内容随网页部署实时更新） */
export function guideOnlineUrl(): string {
  return encodeURI(`${SITE_ORIGIN}/使用说明.html?v=${LATEST.version}`);
}

function isNativePlatform(): boolean {
  return getPlatform() === 'electron' || getPlatform() === 'android';
}

type NavigateFn = (path: string) => void;

/**
 * 打开使用说明：客户端在应用内打开（SPA /guide 全屏视图，不跳浏览器），
 * 网页端新窗口打开站内文件，并附带 from 参数（来源页地址）——说明页
 * 「返回」据此回到来源页（关闭新窗口或跳回来源页），不再跳到主页
 */
export function openGuide(navigate?: NavigateFn): void {
  if (isNativePlatform()) {
    // 应用内路由跳转（调用方传入 react-router navigate；兜底整页导航）
    if (navigate) {
      navigate('/guide');
      return;
    }
    window.location.href = `${import.meta.env.BASE_URL}guide`;
    return;
  }
  const from = encodeURIComponent(window.location.href);
  // 注意：不加 noopener —— 保留 opener 引用使说明页可 window.close() 自闭，
  // 关闭失败时再依据 from 参数跳回来源页
  window.open(
    `${import.meta.env.BASE_URL}使用说明.html?v=${LATEST.version}&from=${from}`,
    '_blank'
  );
}

/** 打开历史版本页（客户端与网页端统一站内 /history 路由，应用内原生页面） */
export function openHistory(navigate?: NavigateFn): void {
  if (navigate) {
    navigate('/history');
    return;
  }
  window.location.href = `${import.meta.env.BASE_URL}history`;
}