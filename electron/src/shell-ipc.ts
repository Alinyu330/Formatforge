/**
 * 系统浏览器打开外部链接 IPC（Windows 客户端）
 *
 * 客户端内的信息型页面（使用说明、历史版本）改为在系统默认浏览器打开在线版，
 * 内容随网页部署自动更新，彻底摆脱客户端打包版本滞后的历史问题。
 */
import { ipcMain, shell } from 'electron';

/** 允许打开的域名白名单（仅本项目站点，防任意链接注入） */
const ALLOWED_HOSTS = ['formatforge.asia', 'www.formatforge.asia', 'alinyu330.github.io'];

export function setupShellIPC(): void {
  ipcMain.handle('shell:openExternal', async (_event, url: unknown) => {
    try {
      const target = typeof url === 'string' ? url : '';
      const parsed = new URL(target);
      if (parsed.protocol !== 'https:') {
        return { ok: false, error: '仅允许打开 https 链接' };
      }
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        return { ok: false, error: '链接域名不在允许列表内' };
      }
      await shell.openExternal(target);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}