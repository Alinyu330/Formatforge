/**
 * 应用内更新检查器（仅 Electron / Android 客户端渲染）
 *
 * - 启动 1.5 秒后自动静默检查；发现新版本弹窗由用户决定是否更新
 * - 首页「检查更新」按钮通过 window 'ff:check-update' 事件触发手动检查
 *   （手动检查才提示「已是最新版本」/错误，自动检查完全静默）
 * - Web 端不渲染任何内容（PWA 由 Service Worker 自动更新）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  isUpdaterSupported,
  type UpdateInfo,
} from '@/utils/appUpdater';
import { getPlatform } from '@/utils/platform';

type UpdateState =
  | 'hidden'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'latest'
  | 'error';

export default function UpdateChecker() {
  const [state, setState] = useState<UpdateState>('hidden');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  /** 是否为手动检查（决定"已是最新/失败"是否提示） */
  const manualRef = useRef(false);
  /** 自动检查只提示一次，用户拒绝后本次会话不再打扰 */
  const dismissedRef = useRef(false);

  const runCheck = useCallback(async (manual: boolean) => {
    manualRef.current = manual;
    setState('checking');
    try {
      const update = await checkForUpdate();
      if (update) {
        setInfo(update);
        setState('available');
      } else {
        setState(manual ? 'latest' : 'hidden');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState(manual ? 'error' : 'hidden');
    }
  }, []);

  useEffect(() => {
    if (!isUpdaterSupported()) return;
    const timer = setTimeout(() => {
      if (!dismissedRef.current) runCheck(false);
    }, 1500);
    const onManual = () => runCheck(true);
    window.addEventListener('ff:check-update', onManual);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('ff:check-update', onManual);
    };
  }, [runCheck]);

  // 「已是最新 / 检查失败」轻提示 2.5 秒后自动消失
  useEffect(() => {
    if (state !== 'latest' && state !== 'error') return;
    const timer = setTimeout(() => setState('hidden'), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  const handleDownload = useCallback(async () => {
    setState('downloading');
    setPercent(0);
    try {
      await downloadUpdate((s) => {
        if (s.stage === 'downloading') setPercent(s.percent);
        else if (s.stage === 'done') setState(getPlatform() === 'electron' ? 'downloaded' : 'hidden');
        // Android 'installing'：系统安装器已唤起，交给系统流程
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, []);

  const handleInstall = useCallback(() => {
    installUpdate().catch(() => undefined);
  }, []);

  const handleDismiss = useCallback(() => {
    dismissedRef.current = true;
    setState('hidden');
  }, []);

  if (state === 'hidden' || state === 'checking') {
    if (state === 'checking') {
      return (
        <div className="fixed top-3 right-3 z-[200] flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] shadow-lg">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00d4ff]" />
          正在检查更新…
        </div>
      );
    }
    return null;
  }

  // 轻提示（已是最新 / 检查失败）
  if (state === 'latest' || state === 'error') {
    const ok = state === 'latest';
    return (
      <div className={`fixed top-3 right-3 z-[200] flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] shadow-lg ${
        ok
          ? 'border-emerald-500/30 bg-[var(--surface)] text-emerald-400'
          : 'border-red-500/30 bg-[var(--surface)] text-red-400'
      }`}>
        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
        {ok ? '已是最新版本' : `检查更新失败：${errorMsg}`}
      </div>
    );
  }

  // 更新弹窗（发现新版本 / 下载中 / 已下载）
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#00d4ff]/30 bg-[var(--surface)] p-5 sm:p-6 shadow-[0_0_48px_rgba(0,212,255,0.15)] animate-fade-in-up">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00d4ff]/10 text-[#00d4ff]">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">
              发现新版本 v{info?.version ?? ''}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">是否更新到最新版本？</p>
          </div>
        </div>

        {info?.notes?.length ? (
          <ul className="mb-4 max-h-44 overflow-y-auto space-y-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] p-3">
            {info.notes.map((note, i) => (
              <li key={i} className="flex gap-2 text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
                <span className="text-[#00d4ff] shrink-0">•</span>
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        {state === 'downloading' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 animate-pulse text-[#00d4ff]" />
                正在下载更新…
              </span>
              <span className="font-mono text-[#00d4ff]">{Math.round(percent)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] transition-all duration-300"
                style={{ width: `${Math.max(2, percent)}%` }}
              />
            </div>
          </div>
        ) : state === 'downloaded' ? (
          <div className="space-y-3">
            <p className="text-[11px] sm:text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              更新已下载完成，重启后即可安装
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 px-4 py-2 rounded-xl bg-[#00d4ff] text-[var(--bg)] text-xs font-semibold
                  hover:bg-[#00d4ff]/85 active:scale-[0.98] transition-all"
              >
                立即重启安装
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)]
                  hover:text-[var(--text-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all"
              >
                稍后（退出时自动装）
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 px-4 py-2 rounded-xl bg-[#00d4ff] text-[var(--bg)] text-xs font-semibold
                hover:bg-[#00d4ff]/85 active:scale-[0.98] transition-all
                shadow-[0_4px_16px_-4px_rgba(0,212,255,0.35)]"
            >
              立即更新
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)]
                hover:text-[var(--text-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all"
            >
              暂不更新
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
