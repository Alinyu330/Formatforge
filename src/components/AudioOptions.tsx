import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useConvertStore } from '@/store/convertStore';
import { KUGOU_MUSIC_ENCRYPTED_EXTENSIONS, NETEASE_MUSIC_ENCRYPTED_EXTENSIONS, isQQMusicEncryptedExt } from '@/utils/format';
import { hasKugouKeyDb, getKugouKeyCount, importKugouKeyDb, exportKugouKeyMap, importKugouKeyMapFromText } from '@/utils/kgg';

function readCookieValue(rawCookie: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]*)`));
  return match?.[1]?.trim() ?? '';
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
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".db" className="hidden" onChange={handleKGGImport} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">{importing ? '解析中...' : '导入 KGMusicV3.db'}</button>
            <span className="text-[10px] sm:text-xs text-[var(--text)]">{kggStatus}</span>
          </div>
          {kggError && <p className="text-[10px] text-red-400 break-all">{kggError}</p>}

          <div className="border-t border-[var(--border)] pt-2 space-y-2">
            <p className="text-[10px] sm:text-xs text-[var(--text-strong)]">手机端粘贴导入密钥</p>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">在已导入密钥库的电脑上点击「复制密钥文本」，把内容发送到手机后粘贴到下方即可。</p>
            <textarea value={kggText} onChange={(e) => setKggText(e.target.value)} placeholder='粘贴密钥 JSON 文本，如 {"keyId":"EncryptionKey",...}' rows={4} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[10px] sm:text-xs text-[var(--text-strong)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#00d4ff]/50 resize-y font-mono" />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handleKGGPasteImport} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium bg-[#00d4ff] text-[#0f1724] hover:bg-[#00d4ff]/90 transition-all">粘贴导入</button>
              <button onClick={handleKGGCopy} className="px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-all">{kggCopied ? '已复制' : '复制密钥文本'}</button>
            </div>
            {kggPasteError && <p className="text-[10px] text-red-400 break-all">{kggPasteError}</p>}
          </div>
        </div>
      )}

      {hasQQMusicFile ? (
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
      ) : localEncryptedPlatforms.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[10px] sm:text-xs text-[var(--text-strong)]">检测到{localEncryptedPlatforms.join('、')}加密格式</p><p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1">该格式将使用本地解密，不需要输入 QQ 音乐 UIN、authst 或 qqmusic_key。</p></div>
      ) : null}
    </div>
  );
}
