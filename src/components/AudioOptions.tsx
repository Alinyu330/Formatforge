import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useConvertStore } from '@/store/convertStore';
import { KUGOU_MUSIC_ENCRYPTED_EXTENSIONS, NETEASE_MUSIC_ENCRYPTED_EXTENSIONS, isQQMusicEncryptedExt } from '@/utils/format';
import { hasKugouKeyDb, getKugouKeyCount, importKugouKeyDb, exportKugouKeyMap, importKugouKeyMapFromText, listKugouKeyIds } from '@/utils/kgg';
import { getPlatform, isMobileDevice } from '@/utils/platform';
import { KugouNative, base64ToBytes } from '@/utils/kugou-native';

function readCookieValue(rawCookie: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]*)`));
  return match?.[1]?.trim() ?? '';
}

function copyTextFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export default function AudioOptions() {
  const { audioOptions, setAudioOptions, tasks } = useConvertStore();
  const qmCredentials = audioOptions.qmCredentials ?? { uin: '', authst: '', musicKey: '', rawCookie: '', loginType: '2' as const };
  const sourceFormats = new Set(tasks.map((task) => task.sourceFormat));
  const hasQQMusicFile = [...sourceFormats].some((format) => isQQMusicEncryptedExt(format));
  const hasKGG = sourceFormats.has('kgg');
  const hasKugouEncrypted = KUGOU_MUSIC_ENCRYPTED_EXTENSIONS.some((format) => sourceFormats.has(format) && format !== 'kgg');
  const localEncryptedPlatforms = [
    NETEASE_MUSIC_ENCRYPTED_EXTENSIONS.some((format) => sourceFormats.has(format)) ? '网易云音乐' : '',
    hasKugouEncrypted ? '酷狗音乐' : '',
  ].filter(Boolean);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [kggStatus, setKggStatus] = useState(() => (hasKugouKeyDb() ? `已加载 ${getKugouKeyCount()} 个密钥` : '尚未加载密钥库'));
  const [kggError, setKggError] = useState('');
  const [kggText, setKggText] = useState('');
  const [kggPasteError, setKggPasteError] = useState('');
  const [kggCopied, setKggCopied] = useState(false);
  const isAndroid = getPlatform() === 'android';
  const isMobile = isMobileDevice();
  const [rootStatus, setRootStatus] = useState<'unknown' | 'rooted' | 'noroot'>('unknown');
  const [rootReading, setRootReading] = useState(false);

  // Android 设备且未导入密钥库时，检测 root 状态，用于展示提示界面
  useEffect(() => {
    if (!isAndroid || !hasKGG || hasKugouKeyDb()) return;
    let cancelled = false;
    KugouNative.isRooted()
      .then(({ rooted }) => {
        if (!cancelled) setRootStatus(rooted ? 'rooted' : 'noroot');
      })
      .catch(() => {
        if (!cancelled) setRootStatus('noroot');
      });
    return () => { cancelled = true; };
  }, [isAndroid, hasKGG]);

  const handleRootRead = async () => {
    setRootReading(true);
    setKggError('');
    setKggPasteError('');
    try {
      const { data } = await KugouNative.readKugouKeyDb();
      if (!data) {
        setKggError('未找到酷狗密钥库，请确认已安装并登录酷狗音乐客户端');
        return;
      }
      const count = importKugouKeyDb(base64ToBytes(data));
      setKggStatus(`已自动读取 ${count} 个密钥`);
    } catch (err) {
      setKggError(err instanceof Error ? err.message : '自动读取密钥库失败');
    } finally {
      setRootReading(false);
    }
  };

  const handleKGGImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setKggError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const count = importKugouKeyDb(bytes);
      setKggStatus(`已加载 ${count} 个密钥`);
    } catch (err) {
      setKggStatus('密钥库解析失败');
      setKggError(err instanceof Error ? err.message : '密钥库解析失败');
    } finally {
      setImporting(false);
    }
  };

  /** 直接导入 KGMusicV3.db 文件（粘贴 / 拖拽进文本框时触发） */
  const handleKGGDbFile = async (file: File) => {
    setImporting(true);
    setKggError('');
    setKggPasteError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const count = importKugouKeyDb(bytes);
      setKggStatus(`已加载 ${count} 个密钥`);
      setKggText('');
    } catch (err) {
      setKggStatus('密钥库解析失败');
      setKggError(`文件「${file.name}」不是有效的 KGMusicV3.db：${err instanceof Error ? err.message : '解析失败'}`);
    } finally {
      setImporting(false);
    }
  };

  /** 粘贴事件：剪贴板里是 KGMusicV3.db 文件时直接导入，否则走默认文本粘贴 */
  const handleKGGTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files || []);
    const dbFile = files.find((f) => /\.db$/i.test(f.name) || /kgmusic/i.test(f.name));
    if (dbFile) {
      e.preventDefault();
      void handleKGGDbFile(dbFile);
    }
  };

  /** 拖拽 KGMusicV3.db 文件到文本框时直接导入 */
  const handleKGGTextareaDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const dbFile = files.find((f) => /\.db$/i.test(f.name) || /kgmusic/i.test(f.name));
    if (dbFile) {
      e.preventDefault();
      void handleKGGDbFile(dbFile);
    }
  };

  const handleKGGPasteImport = () => {
    setKggPasteError('');
    setKggError('');
    try {
      const count = importKugouKeyMapFromText(kggText);
      setKggStatus(`已加载 ${count} 个密钥`);
      setKggText('');
    } catch (err) {
      setKggStatus('密钥文本导入失败');
      setKggPasteError(err instanceof Error ? err.message : '密钥文本导入失败');
    }
  };

  const handleKGGCopy = async () => {
    setKggPasteError('');
    try {
      const text = exportKugouKeyMap();
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) copied = copyTextFallback(text);
      if (!copied) throw new Error('系统禁止访问剪贴板，请使用密钥文件传输');
      setKggCopied(true);
      setTimeout(() => setKggCopied(false), 2000);
    } catch (err) {
      setKggCopied(false);
      setKggPasteError(err instanceof Error ? err.message : '复制失败');
    }
  };

  const handleKGGClipboardImport = async () => {
    setKggPasteError('');
    try {
      if (!navigator.clipboard?.readText) throw new Error('当前环境不支持读取剪贴板，请长按文本框手动粘贴');
      const text = await navigator.clipboard.readText();
      setKggText(text);
      const count = importKugouKeyMapFromText(text);
      setKggStatus(`已加载 ${count} 个密钥`);
      setKggText('');
    } catch (err) {
      setKggStatus('剪贴板导入失败');
      setKggPasteError(err instanceof Error ? err.message : '剪贴板导入失败');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">比特率</span>
          <select value={audioOptions.bitrate} onChange={(e) => setAudioOptions({ bitrate: e.target.value })} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors">
            <option value="128k">128 kbps</option><option value="192k">192 kbps</option><option value="256k">256 kbps</option><option value="320k">320 kbps</option><option value="lossless">无损</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-muted)]">采样率</span>
          <select value={audioOptions.sampleRate} onChange={(e) => setAudioOptions({ sampleRate: Number(e.target.value) })} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[var(--text-strong)] focus:outline-none focus:border-[#00d4ff]/50 appearance-none cursor-pointer hover:border-[var(--border-strong)] transition-colors">
            <option value={44100}>44100 Hz</option><option value={48000}>48000 Hz</option><option value={96000}>96000 Hz</option>
          </select>
        </div>
      </div>

      {hasKGG && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <div>
            <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">检测到酷狗 KGG 加密格式，需要密钥库</p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1">KGG 需要本机酷狗客户端的密钥数据库才能解密。请在已登录酷狗音乐客户端的电脑上找到该文件导入（纯本地解析，不会上传）。</p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text)] mt-1 leading-relaxed">
              密钥库路径：
              <code className="mx-1 px-1.5 py-0.5 rounded bg-[var(--surface)] font-mono text-[#00d4ff] select-all">%APPDATA%\KuGou8\KGMusicV3.db</code>
              <span className="text-[var(--text-muted)]">（即 C:\Users\你的用户名\AppData\Roaming\KuGou8\KGMusicV3.db）</span>
            </p>
          </div>

          {isAndroid && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1.5">
              {rootStatus === 'rooted' ? (
                <>
                  <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">已检测到 Root 权限</p>
                  <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">可自动读取本机酷狗客户端（需已安装并登录）的密钥库完成解密，无需手动导入。</p>
                  <button onClick={handleRootRead} disabled={rootReading} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium bg-amber-500 text-[#0f1724] hover:bg-amber-500/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">{rootReading ? '读取中...' : '自动读取密钥库'}</button>
                </>
              ) : rootStatus === 'noroot' ? (
                <>
                  <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">未检测到 Root 权限，无法自动读取密钥库</p>
                  <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">请在下方「手机端导入密钥」处导入电脑端发送过来的 KGMusicV3.db 文件或密钥文本，否则 KGG 文件无法转换。</p>
                </>
              ) : (
                <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">正在检测 Root 权限…</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".db,.sqlite,application/octet-stream,application/x-sqlite3" className="hidden" onChange={handleKGGImport} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">{importing ? '解析中...' : '导入 KGMusicV3.db'}</button>
            <span className="text-[10px] sm:text-xs text-[var(--text)]">{kggStatus}</span>
          </div>
          {kggError && <p className="text-[10px] text-red-400 break-all">{kggError}</p>}

          <div className="border-t border-[var(--border)] pt-2 space-y-2">
            <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">手机端导入密钥</p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed">
              两种方式任选其一：
              <br />① 把电脑上的 <code className="px-1 rounded bg-[var(--surface)] font-mono text-[#00d4ff]">KGMusicV3.db</code> 文件直接发送到手机（微信 / QQ / 网盘均可），点击上方「导入 KGMusicV3.db」选择该文件；支持粘贴 / 拖拽 .db 文件到下方文本框。
              <br />② 在电脑端导入 KGMusicV3.db 后点击「复制密钥文本」，把密钥文本发送到手机粘贴导入。
            </p>
            <textarea
              value={kggText}
              onChange={(e) => setKggText(e.target.value)}
              onPaste={handleKGGTextareaPaste}
              onDrop={handleKGGTextareaDrop}
              placeholder='粘贴 FormatForge 密钥 JSON 文本，或粘贴 / 拖拽 KGMusicV3.db 文件'
              rows={4}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50 resize-y font-mono"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleKGGClipboardImport} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium bg-[#00d4ff] text-[#0f1724] hover:bg-[#00d4ff]/90 transition-all">从剪贴板读取</button>
              <button type="button" onClick={handleKGGPasteImport} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-all">导入文本框内容</button>
              <button type="button" onClick={handleKGGCopy} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-all">{kggCopied ? '已复制' : '复制密钥文本'}</button>
            </div>
            {kggPasteError && <p className="text-[10px] text-red-400 break-all">{kggPasteError}</p>}
          </div>

          <details className="border-t border-[var(--border)] pt-2">
            <summary className="cursor-pointer text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)] select-none">查看已加载密钥 ID（{getKugouKeyCount()} 个）</summary>
            <div className="mt-2 max-h-40 overflow-auto rounded bg-[var(--surface)] border border-[var(--border)] p-2 space-y-0.5">
              {(() => {
                const ids = listKugouKeyIds();
                return ids.length === 0
                  ? <p className="text-[9px] text-[var(--text-faint)]">暂无密钥</p>
                  : ids.map((id) => <div key={id} className="font-mono text-[9px] text-[var(--text)] break-all leading-relaxed">{id}</div>);
              })()}
            </div>
          </details>
        </div>
      )}

      {hasQQMusicFile ? (
        isMobile ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">检测到 QQ 音乐加密格式（MGG / MFLAC 等）</p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed">
              移动端暂不支持解密该格式。新版 QQ 音乐加密文件需要向官方接口请求解密密钥（ekey），
              所需访问权限为 <b className="text-[var(--text)]">QQ 音乐网页版登录 Cookie（UIN + authst 或 qqmusic_key）</b>，
              该凭证只能通过 PC 浏览器登录 y.qq.com 后在开发者工具中查看，手机浏览器无法获取。
            </p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed">
              解决方案（任选其一）：
              <br />① 在 PC 端打开本站（formatforge.asia），粘贴 QQ 音乐 Cookie 完成解密转换后，把转换好的 MP3 / FLAC 等普通格式传到手机；
              <br />② 在 PC 端 QQ 音乐客户端重新下载歌曲为普通格式。
            </p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-faint)]">旧版 QMC / MFLAC（不带数字后缀）等格式无需凭证，移动端可直接解密。</p>
          </div>
        ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <div><p className="text-[10px] sm:text-xs text-[var(--text-strong)]">检测到 QQ 音乐加密格式</p><p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1">仅 musicex 文件需要拉取 ekey 解密。可粘贴整段 QQ 音乐 Cookie；或填写 UIN 与 authst / qqmusic_key 之一，仅用于当前会话。</p></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={qmCredentials.uin} onChange={(e) => setAudioOptions({ qmCredentials: { ...qmCredentials, uin: e.target.value.trim() } })} placeholder="QQ 音乐 UIN" className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50" />
            <input value={qmCredentials.authst ?? ''} onChange={(e) => setAudioOptions({ qmCredentials: { ...qmCredentials, authst: e.target.value.trim() } })} placeholder="authst（可选）" className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50 sm:col-span-2" />
          </div>
          <input value={qmCredentials.musicKey ?? ''} onChange={(e) => setAudioOptions({ qmCredentials: { ...qmCredentials, musicKey: e.target.value.trim() } })} placeholder="qqmusic_key / qm_keyst（可选，缺少 authst 时可直接填）" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50" />
          <textarea value={qmCredentials.rawCookie ?? ''} onChange={(e) => {
            const rawCookie = e.target.value.trim().replace(/^cookie:\s*/i, '');
            const parsedLoginType = readCookieValue(rawCookie, 'tmeLoginType') || readCookieValue(rawCookie, 'login_type');
            setAudioOptions({ qmCredentials: { ...qmCredentials, rawCookie, uin: readCookieValue(rawCookie, 'uin') || readCookieValue(rawCookie, 'p_uin') || qmCredentials.uin, authst: readCookieValue(rawCookie, 'authst') || qmCredentials.authst, musicKey: readCookieValue(rawCookie, 'qqmusic_key') || readCookieValue(rawCookie, 'qm_keyst') || readCookieValue(rawCookie, 'qqmusickey') || qmCredentials.musicKey, loginType: parsedLoginType === '1' || parsedLoginType === '2' || parsedLoginType === '3' ? parsedLoginType : qmCredentials.loginType } });
          }} placeholder="整段 QQ 音乐 Cookie（可选，优先级最高）" rows={4} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50 resize-y" />
          <div className="flex items-center gap-3 text-[10px] sm:text-xs text-[var(--text)] flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="qm-login-type" checked={qmCredentials.loginType === '2'} onChange={() => setAudioOptions({ qmCredentials: { ...qmCredentials, loginType: '2' } })} />QQ 音乐网页</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="qm-login-type" checked={qmCredentials.loginType === '3'} onChange={() => setAudioOptions({ qmCredentials: { ...qmCredentials, loginType: '3' } })} />微信登录</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="qm-login-type" checked={qmCredentials.loginType === '1'} onChange={() => setAudioOptions({ qmCredentials: { ...qmCredentials, loginType: '1' } })} />QQ 登录</label>
          </div>
        </div>
        )
      ) : localEncryptedPlatforms.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[10px] sm:text-xs text-[var(--text-strong)]">检测到{localEncryptedPlatforms.join('、')}加密格式</p><p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1">该格式将使用本地解密，不需要输入 QQ 音乐 UIN、authst 或 qqmusic_key。</p></div>
      ) : null}
    </div>
  );
}
