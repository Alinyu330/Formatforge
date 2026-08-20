// 酷狗音乐 KGG 加密格式解密
// KGG（2023+ 新版）文件结构：
//   0x10 (16)  uint32 LE  headerLen —— 音频数据起始偏移
//   0x14 (20)  uint32 LE  mode      —— 固定为 5
//   0x44 (68)  chunk      keyId     —— uint32 LE 长度 + UTF-8 字符串
// 音频数据（headerLen 之后）使用 QMC2 加密（MapCipher / RC4），
// 密钥需从本机酷狗客户端密钥数据库 KGMusicV3.db 中按 keyId 查询到 EncryptionKey。

import { decryptQMC2WithKey, deriveQMC2KeyFromEkey, detectAudioFormat } from './qmc';
import { loadKugouKeyMap } from './kgg-db';

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

export function isKGGFile(filename: string): boolean {
  return filename.toLowerCase().split('.').slice(1).includes('kgg');
}

/** 验证文件头是否为合法的 KGG 加密文件（mode == 5） */
export function isValidKGGHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 24) return false;
  return readUint32LE(bytes, 0x14) === 5;
}

export interface KGGHeaderInfo {
  headerLen: number;
  keyId: string;
}

/** 解析 KGG 文件头，得到音频偏移与 keyId */
export function parseKGGHeader(data: Uint8Array): KGGHeaderInfo {
  if (data.length < 0x48) {
    throw new Error('KGG 文件头不完整');
  }
  const headerLen = readUint32LE(data, 0x10);
  const mode = readUint32LE(data, 0x14);
  if (mode !== 5) {
    throw new Error('不是有效的 KGG 文件（mode 不为 5）');
  }
  if (headerLen < 0x48 || headerLen > data.length) {
    throw new Error('KGG 文件头长度异常');
  }

  const keyIdLen = readUint32LE(data, 0x44);
  if (0x48 + keyIdLen > data.length) {
    throw new Error('KGG 文件 keyId 长度异常');
  }
  const keyId = new TextDecoder().decode(data.slice(0x48, 0x48 + keyIdLen));
  return { headerLen, keyId };
}

/** 提取 KGG 文件中的 keyId（用于向密钥库查询 EncryptionKey） */
export function extractKGGKeyId(data: Uint8Array): string {
  return parseKGGHeader(data).keyId;
}

/**
 * 使用从密钥库查询到的 EncryptionKey 解密 KGG 文件
 * @param data 完整 KGG 文件字节
 * @param encryptionKey 酷狗密钥库 ShareFileItems 表中的 EncryptionKey（base64 ekey 字符串）
 */
export function decryptKGG(data: Uint8Array, encryptionKey: string): { data: Uint8Array; ext: string } {
  const { headerLen } = parseKGGHeader(data);
  const audioData = data.slice(headerLen);

  const key = deriveQMC2KeyFromEkey(encryptionKey);
  if (key.length === 0) {
    throw new Error('KGG 密钥解析失败（EncryptionKey 无效）');
  }

  const decrypted = decryptQMC2WithKey(audioData, key, 0);
  return { data: decrypted, ext: detectAudioFormat(decrypted) };
}

// ==================== 密钥库 store（跨平台） ====================
// 通过导入并解析 KGMusicV3.db 得到 keyId → EncryptionKey 映射，
// 供网页端 / 安卓端在没有本机酷狗客户端的情况下离线解密 KGG。

const KGG_KEYMAP_STORAGE_KEY = 'formatforge:kgg-keymap';

let keyMapCache: Record<string, string> | null = null;

function readStoredKeyMap(): Record<string, string> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KGG_KEYMAP_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : null;
  } catch {
    return null;
  }
}

function ensureKeyMap(): Record<string, string> | null {
  if (keyMapCache) return keyMapCache;
  keyMapCache = readStoredKeyMap();
  return keyMapCache;
}

/** 导入酷狗密钥数据库（KGMusicV3.db），解密并解析密钥映射，返回密钥数量 */
export function importKugouKeyDb(bytes: Uint8Array): number {
  const map = loadKugouKeyMap(bytes);
  keyMapCache = map;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KGG_KEYMAP_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // 存储失败不阻断导入
  }
  return Object.keys(map).length;
}

/** 导出当前密钥库为 JSON 文本（用于电脑端导入后复制到手机端粘贴）。 */
export function exportKugouKeyMap(): string {
  const map = ensureKeyMap();
  if (!map) throw new Error('尚未加载密钥库，请先导入 KGMusicV3.db');
  return JSON.stringify(map);
}

/** 从粘贴的 JSON 文本导入密钥库，返回密钥数量。 */
export function importKugouKeyMapFromText(text: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error('密钥文本不是有效的 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('密钥文本格式不正确（应为 {"keyId":"EncryptionKey",...}）');
  }
  const map: Record<string, string> = {};
  for (const [keyId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > 0) map[keyId] = value;
  }
  if (Object.keys(map).length === 0) {
    throw new Error('密钥文本中没有有效密钥');
  }
  keyMapCache = map;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KGG_KEYMAP_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // 存储失败不阻断导入
  }
  return Object.keys(map).length;
}

/** 查询 keyId 对应的 EncryptionKey */
export function getKugouKey(keyId: string): string | null {
  return ensureKeyMap()?.[keyId] ?? null;
}

/** 是否已导入密钥库 */
export function hasKugouKeyDb(): boolean {
  return ensureKeyMap() !== null;
}

/** 已加载的密钥数量 */
export function getKugouKeyCount(): number {
  return Object.keys(ensureKeyMap() ?? {}).length;
}

/** 列出当前密钥库中的所有 keyId（用于诊断账号是否匹配） */
export function listKugouKeyIds(): string[] {
  const map = ensureKeyMap() ?? {};
  return Object.keys(map).sort();
}