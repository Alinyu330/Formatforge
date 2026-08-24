/**
 * 应用内更新 IPC（Windows 客户端）
 *
 * 更新源：https://dl.formatforge.asia/update/latest.yml（Cloudflare R2，国内直连）
 * 由 electron-builder 构建时生成的 latest.yml + blockmap 驱动，支持差量下载。
 *
 * 原则：更新与否完全由用户决定——
 *   autoDownload = false       检测到新版本不自动下载，等用户在界面选择
 *   autoInstallOnAppQuit = true 用户选择「稍后」时，退出应用自动安装已下载的更新
 */
import type { BrowserWindow } from 'electron';
import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

const FEED_URL = 'https://dl.formatforge.asia/update/';

export function setupUpdaterIPC(getMainWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  // 开发环境没有打包产物 app-update.yml，手动指向更新源
  if (!app.isPackaged) {
    autoUpdater.setFeedURL({ provider: 'generic', url: FEED_URL });
  }

  const send = (channel: string, data?: unknown): void => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  };

  autoUpdater.on('update-available', (info) => {
    send('updater:available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    send('updater:not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    send('updater:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('updater:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    send('updater:error', { message: err?.message ?? String(err) });
  });

  ipcMain.handle('updater:get-version', () => app.getVersion());
  ipcMain.handle('updater:check', async () => {
    const result = await autoUpdater.checkForUpdates();
    return { version: result?.updateInfo?.version ?? app.getVersion() };
  });
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}
