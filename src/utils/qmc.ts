// QQ音乐 QMC 加密格式解密
// 支持 QMCv1（旧版 XOR 种子密钥）和 QMCv2（ekey 驱动的 Map XOR / RC4）

import { isQQMusicEncryptedExt } from './format';

// ==================== TC-TEA 解密 ====================
const TEA_DELTA = 0x9E3779B9;
const TEA_ROUNDS = 16;
const TEA_INIT_SUM = 0xE3779B90;

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  ) >>> 0;
}

function teaDecryptBlock(block: Uint8Array, key: Uint32Array): void {
  let v0 = readUint32BE(block, 0);
  let v1 = readUint32BE(block, 4);
  let sum = TEA_INIT_SUM;

  for (let i = 0; i < TEA_ROUNDS; i++) {
    const v1Mix = ((((v0 << 4) >>> 0) + key[2]) ^ ((v0 + sum) >>> 0) ^ ((v0 >>> 5) + key[3])) >>> 0;
    v1 = (v1 - v1Mix) >>> 0;
    const v0Mix = ((((v1 << 4) >>> 0) + key[0]) ^ ((v1 + sum) >>> 0) ^ ((v1 >>> 5) + key[1])) >>> 0;
    v0 = (v0 - v0Mix) >>> 0;
    sum = (sum - TEA_DELTA) >>> 0;
  }

  block[0] = v0 >>> 24;
  block[1] = v0 >>> 16;
  block[2] = v0 >>> 8;
  block[3] = v0;
  block[4] = v1 >>> 24;
  block[5] = v1 >>> 16;
  block[6] = v1 >>> 8;
  block[7] = v1;
}

function teaDecrypt(data: Uint8Array, teaKey: Uint8Array): Uint8Array | null {
  if (data.length < 16 || data.length % 8 !== 0 || teaKey.length !== 16) {
    return null;
  }

  const key = new Uint32Array(4);
  for (let i = 0; i < key.length; i++) {
    key[i] = readUint32BE(teaKey, i * 4);
  }

  const decrypted = new Uint8Array(data.length);
  const previousCipher = new Uint8Array(8);
  const previousTeaBlock = new Uint8Array(8);
  const block = new Uint8Array(8);

  for (let offset = 0; offset < data.length; offset += 8) {
    for (let i = 0; i < 8; i++) {
      block[i] = data[offset + i] ^ previousTeaBlock[i];
    }
    teaDecryptBlock(block, key);
    for (let i = 0; i < 8; i++) {
      decrypted[offset + i] = block[i] ^ previousCipher[i];
      previousTeaBlock[i] = block[i];
      previousCipher[i] = data[offset + i];
    }
  }

  const payloadStart = (decrypted[0] & 0x07) + 3;
  const payloadEnd = decrypted.length - 7;
  if (payloadStart > payloadEnd) {
    return null;
  }
  for (let i = payloadEnd; i < decrypted.length; i++) {
    if (decrypted[i] !== 0) return null;
  }
  return decrypted.slice(payloadStart, payloadEnd);
}

// ==================== Base64 解码 ====================
function base64Decode(str: string): Uint8Array {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ==================== QMC2 密钥派生 ====================
function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    bytes[i] = value.charCodeAt(i);
  }
  return bytes;
}

function hasBytesPrefix(data: Uint8Array, prefix: Uint8Array): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (data[i] !== prefix[i]) return false;
  }
  return true;
}

function decodeAscii(data: Uint8Array): string | null {
  let value = '';
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0x7F) return null;
    value += String.fromCharCode(data[i]);
  }
  return value;
}

const ENC_V2_EKEY_PREFIX = asciiBytes('QQMusic EncV2,Key:');
const ENC_V2_FIRST_TEA_KEY = asciiBytes('386ZJY!@#*$%^&)(');
const ENC_V2_SECOND_TEA_KEY = asciiBytes('**#!(#$%&^a1cZ,T');

function unwrapQMC2EncV2Ekey(ekeyRaw: Uint8Array): Uint8Array {
  if (!hasBytesPrefix(ekeyRaw, ENC_V2_EKEY_PREFIX)) return ekeyRaw;

  const firstStage = teaDecrypt(ekeyRaw.slice(ENC_V2_EKEY_PREFIX.length), ENC_V2_FIRST_TEA_KEY);
  if (firstStage === null) return new Uint8Array();

  const secondStage = teaDecrypt(firstStage, ENC_V2_SECOND_TEA_KEY);
  if (secondStage === null) return new Uint8Array();

  const encodedEkey = decodeAscii(secondStage);
  if (encodedEkey === null) return new Uint8Array();

  try {
    return base64Decode(encodedEkey);
  } catch {
    return new Uint8Array();
  }
}

function deriveQMC2Key(ekeyRaw: Uint8Array): Uint8Array {
  const unwrappedEkey = unwrapQMC2EncV2Ekey(ekeyRaw);
  if (unwrappedEkey.length < 8) return new Uint8Array();

  const hasEncV2 = hasBytesPrefix(ekeyRaw, ENC_V2_EKEY_PREFIX);
  const header = unwrappedEkey.slice(0, 8);
  const body = unwrappedEkey.slice(8);

  // 无 body 时，header 即完整密钥
  if (body.length === 0) {
    console.log('[diag] deriveQMC2Key: EncV2=', hasEncV2, 'keyLen=', header.length, 'key[0..7]=', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
    return header;
  }

  const simpleKey = new Uint8Array([0x69, 0x56, 0x46, 0x38, 0x2B, 0x20, 0x15, 0x0B]);
  const teaKey = new Uint8Array(16);
  for (let i = 0; i < simpleKey.length; i++) {
    teaKey[2 * i] = simpleKey[i];
    teaKey[2 * i + 1] = header[i];
  }

  const decryptedBody = teaDecrypt(body, teaKey);
  if (decryptedBody !== null) {
    const derivedKey = new Uint8Array(8 + decryptedBody.length);
    derivedKey.set(header);
    derivedKey.set(decryptedBody, 8);
    console.log('[diag] deriveQMC2Key: EncV2=', hasEncV2, 'TEA=OK bodyLen=', body.length, '→payloadLen=', decryptedBody.length, 'totalKeyLen=', derivedKey.length, 'key[0..7]=', Array.from(derivedKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    return derivedKey;
  }

  console.log('[diag] deriveQMC2Key: EncV2=', hasEncV2, 'TEA=FAIL fallback keyLen=', unwrappedEkey.length);
  // TC-TEA 解密失败：ekey 可能是原始密钥（如 QQ 音乐 API 直接返回的 raw key），整体作为密钥使用
  return unwrappedEkey.slice();
}

/**
 * 从 base64 ekey 字符串推导 QMC2 密钥（用于 KGG 等通过 EncryptionKey 提供的场景）
 * 等价于 C# 实现中的 Ekey.Decrypt。
 */
export function deriveQMC2KeyFromEkey(ekeyStr: string): Uint8Array {
  let ekeyRaw: Uint8Array;
  try {
    ekeyRaw = base64Decode(ekeyStr);
  } catch {
    return new Uint8Array();
  }
  return deriveQMC2Key(ekeyRaw);
}

export function decryptQMC2WithKey(data: Uint8Array, key: Uint8Array, startOffset: number = 0): Uint8Array {
  if (key.length <= 300) {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      // 参考实现（qmc2-rust MapCipher scramble_by_index）：
//   offset = startOffset + i；若 > 0x7FFF 则 offset %= 0x7FFF
//   keyIndex = (offset * offset + 71214) % key.length
//   shift = (keyIndex + 4) & 7
//   mask = (value << shift) | (value >> shift)（wrapping_shl | wrapping_shr）
      let offset = startOffset + i;
      if (offset > 0x7FFF) offset %= 0x7FFF;
      const keyIndex = (offset * offset + 71214) % key.length;
      const shift = (keyIndex + 4) & 7;
      const value = key[keyIndex];
      const mask = ((value << shift) & 0xFF) | (value >> shift);
      result[i] = data[i] ^ mask;
    }
    return result;
  }
  return decryptQMC2RC4(data, key, startOffset);
}

// ==================== QMC2 分段 RC4（key > 300） ====================

const QMC2_FIRST_SEGMENT_SIZE = 0x80;
const QMC2_OTHER_SEGMENT_SIZE = 0x1400;

function calcHashBase(data: Uint8Array): number {
  let hash = 1;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value === 0) continue;
    const nextHash = (hash * value) >>> 0; // u32 wrapping multiply
    if (nextHash === 0 || nextHash <= hash) break;
    hash = nextHash;
  }
  return hash >>> 0;
}

/**
 * 复现 Rust `(hash as f64) / ((id+1) * seed) as f64 * 100.0`（f64 浮点运算 → as u64）。
 * seed 为 0 时除数为 0，Rust 结果为 +inf → 饱和转换为 u64::MAX，
 * 用 -1 作为哨兵值表示。
 */
function calcSegmentKey(hash: number, id: number, seed: number): number {
  if (seed === 0) return -1;
  return Math.trunc((hash / ((id + 1) * seed)) * 100);
}

function segmentKeyModN(segKey: number, n: number): number {
  if (segKey === -1) {
    // Rust: +inf as u64 = u64::MAX, then u64::MAX % n
    // Use BigInt for u64::MAX to avoid precision loss
    return Number((0xFFFFFFFFFFFFFFFFn) % BigInt(n));
  }
  return segKey % n;
}

function segmentKeyAndMask(segKey: number): number {
  if (segKey === -1) return 0x1FF;
  return segKey & 0x1FF;
}

function rc4Derive(n: number, s: Uint8Array, state: { j: number; k: number }): number {
  state.j = (state.j + 1) % n;
  state.k = (s[state.j] + state.k) % n;
  const tmp = s[state.j];
  s[state.j] = s[state.k];
  s[state.k] = tmp;
  return s[(s[state.j] + s[state.k]) % n];
}

function decryptQMC2RC4(data: Uint8Array, key: Uint8Array, startOffset: number = 0): Uint8Array {
  const n = key.length;
  const hash = calcHashBase(key);

  // S-box 初始化：s[i] = i % 256
  const s = new Uint8Array(n);
  for (let i = 0; i < n; i++) s[i] = i % 256;

  // KSA
  let j = 0;
  for (let i = 0; i < n; i++) {
    j = (j + s[i] + key[i]) % n;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }

  const result = new Uint8Array(data);

  const encodeFirstSegment = (offset: number, buf: Uint8Array, start: number, len: number): void => {
    for (let i = 0; i < len; i++) {
      const key1 = key[offset % n];
      const key2 = calcSegmentKey(hash, offset, key1);
      const maskIdx = segmentKeyModN(key2, n);
      const mask = key[maskIdx];
      buf[start + i] ^= mask;
      offset++;
    }
  };

  const encodeOtherSegment = (offset: number, buf: Uint8Array, start: number, len: number): void => {
    const segId = Math.floor(offset / QMC2_OTHER_SEGMENT_SIZE);
    const segIdSmall = segId & 0x1FF;
    let discardCount = segmentKeyAndMask(calcSegmentKey(hash, segId, key[segIdSmall]));
    discardCount += offset % QMC2_OTHER_SEGMENT_SIZE;

    const segS = s.slice();
    const state = { j: 0, k: 0 };
    for (let i = 0; i < discardCount; i++) {
      rc4Derive(n, segS, state);
    }
    for (let i = 0; i < len; i++) {
      buf[start + i] ^= rc4Derive(n, segS, state);
    }
  };

  let offset = startOffset;
  let len = data.length;
  let i = 0;

  // 首段（offset < 0x80）使用不同算法
  if (offset < QMC2_FIRST_SEGMENT_SIZE) {
    const processed = Math.min(len, QMC2_FIRST_SEGMENT_SIZE - offset);
    encodeFirstSegment(offset, result, i, processed);
    i += processed;
    len -= processed;
    offset += processed;
  }

  // 对齐到段边界
  const toAlign = offset % QMC2_OTHER_SEGMENT_SIZE;
  if (toAlign !== 0) {
    const processed = Math.min(len, QMC2_OTHER_SEGMENT_SIZE - toAlign);
    encodeOtherSegment(offset, result, i, processed);
    i += processed;
    len -= processed;
    offset += processed;
  }

  // 处理完整段
  while (len > QMC2_OTHER_SEGMENT_SIZE) {
    encodeOtherSegment(offset, result, i, QMC2_OTHER_SEGMENT_SIZE);
    i += QMC2_OTHER_SEGMENT_SIZE;
    len -= QMC2_OTHER_SEGMENT_SIZE;
    offset += QMC2_OTHER_SEGMENT_SIZE;
  }

  // 剩余字节
  if (len > 0) {
    encodeOtherSegment(offset, result, i, len);
  }

  return result;
}

// ==================== QMCv1 解密（旧版种子密钥） ====================
const QMC1_STATIC_CIPHER = new Uint8Array(128);
(() => {
  const raw = [
    0x77, 0x48, 0x32, 0x73, 0xDE, 0xF2, 0xC0, 0xC8,
    0x95, 0xEC, 0x30, 0xB2, 0x51, 0xC3, 0xE1, 0xA0,
    0x9E, 0xE6, 0x9D, 0xCF, 0xFA, 0x7F, 0x14, 0xD1,
    0xCE, 0xB8, 0xDC, 0xC3, 0x4A, 0x67, 0x93, 0xD6,
    0x28, 0xC2, 0x91, 0x70, 0xCA, 0x8D, 0xA2, 0xA4,
    0xF0, 0x08, 0x61, 0x90, 0x7E, 0x6F, 0xA2, 0xE0,
    0xEB, 0xAE, 0x3B, 0xA4, 0x46, 0xBD, 0x61, 0x4E,
    0xE9, 0x97, 0x77, 0x9F, 0x86, 0xEF, 0x21, 0x17,
    0x24, 0xDB, 0x7A, 0xA2, 0xD0, 0x61, 0x71, 0x49,
    0x47, 0xC3, 0x85, 0x68, 0x22, 0x5D, 0x2A, 0x3C,
    0x49, 0xD5, 0x3B, 0x1A, 0xAA, 0x11, 0x73, 0x06,
    0x36, 0xD7, 0x73, 0xAF, 0x66, 0xA7, 0xB0, 0x75,
    0x4E, 0xF1, 0x23, 0x48, 0x6F, 0xE8, 0xE7, 0x65,
    0xC9, 0xB7, 0x5B, 0xA4, 0x2D, 0x45, 0xDD, 0x69,
    0x0A, 0x42, 0x09, 0xDD, 0x8E, 0xEE, 0x1B, 0xC6,
    0xFE, 0xB5, 0xA6, 0xA0, 0xC4, 0x9E, 0x75, 0x42,
  ];
  for (let i = 0; i < 128; i++) QMC1_STATIC_CIPHER[i] = raw[i];
})();

function getKeyFromSeed(seed: number): Uint8Array {
  const keyLen = 1024;
  const key = new Uint8Array(keyLen);
  for (let i = 0; i < keyLen; i++) {
    seed = (seed * 299 + 43) & 0xFFFF;
    key[i] = seed & 0xFF;
  }
  return key;
}

function decryptQMC1Stream(data: Uint8Array, seed: number): Uint8Array {
  const key = getKeyFromSeed(seed);
  const decrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ key[i % key.length];
  }
  return decrypted;
}

// ==================== ekey 提取 ====================

/**
 * 尝试从文件提取内嵌的 ekey（base64 编码字符串）
 * 新版 musicex 格式的 ekey 不在文件中，返回 null
 */
function tryExtractEkey(data: Uint8Array): string | null {
  // 方式1：搜索 "QTag" 标记（旧版 QMC2）
  const qtagMarker = new TextEncoder().encode('QTag');
  const qtagIdx = findLast(data, qtagMarker);
  if (qtagIdx >= 0) {
    // ekey 在 QTag 之前，向后搜索到不再可打印的 base64 字符边界
    const end = qtagIdx - 1;
    let start = end;
    const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_-';
    while (start >= 0 && b64chars.includes(String.fromCharCode(data[start]))) {
      start--;
    }
    start++;
    if (start < end) {
      return new TextDecoder().decode(data.slice(start, end + 1));
    }
  }

  // 方式2：搜索 "STag" 标记（某些旧版本）
  const stagMarker = new TextEncoder().encode('STag');
  const stagIdx = findLast(data, stagMarker);
  if (stagIdx >= 0) {
    const end = stagIdx - 1;
    let start = end;
    const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_-';
    while (start >= 0 && b64chars.includes(String.fromCharCode(data[start]))) {
      start--;
    }
    start++;
    if (start < end) {
      return new TextDecoder().decode(data.slice(start, end + 1));
    }
  }

  // 方式3：搜索文件末尾的 base64 ekey（V1 格式：key_size + ekey 在尾部）
  // 从后往前搜索一个较短的 base64 字符串
  const tailSize = Math.min(data.length, 2048);
  const tail = data.slice(data.length - tailSize);
  const tailStr = new TextDecoder().decode(tail);

  // 搜索 base64 模式（长度 ≥ 16）
  const b64Match = tailStr.match(/[A-Za-z0-9+/=_-]{32,1024}/);
  if (b64Match) {
    // 验证这确实是 base64
    const candidate = b64Match[0];
    try {
      const decoded = base64Decode(candidate);
      if (decoded.length >= 8 && decoded.length % 8 === 0) {
        return candidate;
      }
    } catch {
      // 无效 base64，忽略
    }
  }

  return null;
}

function findLast(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = haystack.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// ==================== musicex 格式检测 ====================

export interface MusicexInfo {
  songId: number;
  mediaMid: string;
  filename: string;
}

export class MusicexNeedsEkeyError extends Error {
  readonly info?: MusicexInfo;

  constructor(message: string, info?: MusicexInfo) {
    super(message);
    this.name = 'MusicexNeedsEkeyError';
    this.info = info;
  }
}

export function isMusicexFormat(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  const magic = new TextDecoder().decode(data.slice(data.length - 8));
  return magic === 'musicex\0';
}

// UTF-16LE 字符串解码
function readUtf16LE(buf: Uint8Array, offset: number, byteLen: number): string {
  const chars: number[] = [];
  const end = Math.min(buf.length, offset + byteLen);
  for (let i = offset; i + 1 < end; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8);
    if (code === 0) break;
    chars.push(code);
  }
  return String.fromCharCode(...chars);
}

function normalizeFooterText(text: string): string {
  // eslint-disable-next-line no-control-regex -- 显式剔除 footer 文本中的 NUL 填充
  return text.replace(/[\u0000]/g, '').trim();
}

function looksLikeMediaMid(value: string): boolean {
  return /^[A-Za-z0-9]{8,32}$/.test(value);
}

function looksLikeResourceName(value: string): boolean {
  return /\.(mgg|mflac|mp3|flac|ogg)$/i.test(value);
}

function findUtf16Strings(buf: Uint8Array): string[] {
  const results: string[] = [];
  let start = -1;

  for (let i = 0; i + 1 < buf.length; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8);
    const printable = code === 0 || (code >= 0x20 && code <= 0x7E);
    if (printable) {
      if (start < 0) start = i;
      if (code === 0 && start >= 0) {
        const value = normalizeFooterText(readUtf16LE(buf, start, i - start + 2));
        if (value.length >= 4) results.push(value);
        start = -1;
      }
    } else if (start >= 0) {
      const value = normalizeFooterText(readUtf16LE(buf, start, i - start));
      if (value.length >= 4) results.push(value);
      start = -1;
    }
  }

  if (start >= 0) {
    const value = normalizeFooterText(readUtf16LE(buf, start, buf.length - start));
    if (value.length >= 4) results.push(value);
  }

  return results;
}

export function parseMusicexFooter(data: Uint8Array): MusicexInfo | null {
  if (!isMusicexFormat(data) || data.length < 16) return null;

  const footerSize = new DataView(data.buffer, data.byteOffset + data.length - 16, 4).getUint32(0, true);
  if (footerSize < 16 || footerSize > data.length) return null;

  const footerStart = data.length - footerSize;
  const footer = data.slice(footerStart, footerStart + footerSize);
  if (footer.length < 4) return null;

  const songId = new DataView(footer.buffer, footer.byteOffset, 4).getUint32(0, true);

  let mediaMid = normalizeFooterText(readUtf16LE(footer, 0x0C, 60));
  let filename = normalizeFooterText(readUtf16LE(footer, 0x48, 68));

  if (!looksLikeMediaMid(mediaMid) || !looksLikeResourceName(filename)) {
    const candidates = findUtf16Strings(footer);
    if (!looksLikeMediaMid(mediaMid)) {
      mediaMid = candidates.find(looksLikeMediaMid) || mediaMid;
    }
    if (!looksLikeResourceName(filename)) {
      filename = candidates.find(looksLikeResourceName) || filename;
    }
  }

  return { songId, mediaMid, filename };
}

/** 提取 musicex 文件中 QMC2 加密的音频数据（去掉 footer） */
export function extractMusicexAudioData(data: Uint8Array): Uint8Array | null {
  if (!isMusicexFormat(data) || data.length < 16) return null;
  const footerSize = new DataView(data.buffer, data.byteOffset + data.length - 16, 4).getUint32(0, true);
  if (footerSize < 16 || footerSize > data.length) return null;
  const audioEnd = data.length - footerSize;
  console.log('[diag] extractMusicexAudioData: totalLen=', data.length, 'footerSize=', footerSize, 'audioEnd=', audioEnd, 'audioStart=0');
  return data.slice(0, audioEnd);
}

/** 使用 ekey 解密 musicex 文件 */
export async function decryptMusicexWithEkey(
  data: Uint8Array,
  ekeyStr: string
): Promise<{ data: Uint8Array; ext: string }> {
  if (!isMusicexFormat(data)) {
    throw new Error('不是有效的 musicex 格式文件');
  }

  // 提取音频数据
  const audioData = extractMusicexAudioData(data);
  if (!audioData || audioData.length < 4) {
    throw new Error('musicex 文件音频数据异常');
  }

  const footerInfo = parseMusicexFooter(data);
  console.log('[diag] decryptMusicexWithEkey: audioLen=', audioData.length, 'encryptedFirst16=', Array.from(audioData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '), 'footer=', footerInfo);

  // Base64 解码 ekey → TC-TEA 解密 → 得到密钥
  console.log('[diag] decryptMusicexWithEkey: ekeyStrLen=', ekeyStr.length, 'ekeyStrPrefix=', ekeyStr.substring(0, 50));
  const ekeyRaw = base64Decode(ekeyStr);
  console.log('[diag] decryptMusicexWithEkey: ekeyRawLen=', ekeyRaw.length, 'ekeyRawFirst16=', Array.from(ekeyRaw.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  const derivedKey = deriveQMC2Key(ekeyRaw);

  if (derivedKey.length === 0) {
    throw new Error('ekey 解密失败，密钥为空');
  }

  // musicex 音频数据（去掉 footer 后）从偏移 0 开始即为 QMC2 加密流，无需跳过头部
  const decrypted = decryptQMC2WithKey(audioData, derivedKey, 0);
  const ext = detectAudioFormat(decrypted);

  console.log('[diag] decryptMusicexWithEkey: keyLen=', derivedKey.length, 'algo=', derivedKey.length <= 300 ? 'MapCipher' : 'RC4', 'ext=', ext, 'first16=', Array.from(decrypted.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  return { data: decrypted, ext };
}

// ==================== GetEVkey API ====================

// 开发环境走 Vite 代理；生产 Web 部署通过 VITE_QQMUSIC_PROXY_URL（Cloudflare Worker 代理）规避 CORS。
// PC/Android 客户端（本地构建，未注入该环境变量）直连 u.y.qq.com 同样会被 WebView 拦截，
// 因此原生平台默认走官方部署的代理 qq.formatforge.asia。
import { getPlatform } from './platform';

const QM_EKEY_PROXY_FALLBACK = 'https://qq.formatforge.asia/cgi-bin/musicu.fcg';

function resolveQmEkeyApi(): { api: string; usingProxy: boolean } {
  if (import.meta.env.DEV) {
    return { api: '/api/qqmusic/cgi-bin/musicu.fcg', usingProxy: true };
  }
  if (import.meta.env.VITE_QQMUSIC_PROXY_URL) {
    return { api: import.meta.env.VITE_QQMUSIC_PROXY_URL, usingProxy: true };
  }
  const platform = getPlatform();
  if (platform === 'electron' || platform === 'android') {
    // 原生客户端直连必然被 CORS 拦截，默认走代理
    return { api: QM_EKEY_PROXY_FALLBACK, usingProxy: true };
  }
  return { api: 'https://u.y.qq.com/cgi-bin/musicu.fcg', usingProxy: false };
}

const QM_EKEY_API_RESOLVED = resolveQmEkeyApi();
const QM_EKEY_API = QM_EKEY_API_RESOLVED.api;

/** 当前 ekey 请求是否经过代理（代理需要透传 Cookie，直连则由浏览器自行携带） */
const isUsingQmProxy = QM_EKEY_API_RESOLVED.usingProxy;

export interface QMCredentials {
  uin: string;
  authst?: string;
  musicKey?: string;
  rawCookie?: string;
  loginType?: string; // '1' = QQ, '2' = QQ音乐, '3' = 微信
}

export interface EkeyResult {
  ekey: string;
  songMid: string;
  filename: string;
}

function parseCookieValue(rawCookie: string | undefined, key: string): string {
  if (!rawCookie) return '';
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]*)`));
  return match?.[1]?.trim() || '';
}

/**
 * 调用 QQ 音乐 GetEVkey API 获取 ekey
 * @param cred 用户凭据（uin + authst）
 * @param songMid 歌曲 media_mid
 * @param filename 资源文件名（含 .mgg/.mflac 后缀）
 * @param platform 平台标识：'20' = macOS, '27' = Windows
 */

// ekey 缓存，避免同一文件多次转换时重复请求 API
const ekeyCache = new Map<string, { ekey: string; purl: string }>();

export async function fetchEkeyFromAPI(
  cred: QMCredentials,
  songMid: string,
  filename: string,
  platform: string = '20',
): Promise<EkeyResult> {
  const cacheKey = `${songMid}:${filename}:${platform}`;
  const cached = ekeyCache.get(cacheKey);
  if (cached) {
    return { ekey: cached.ekey, songMid, filename };
  }

  const cookieHeader = cred.rawCookie?.trim() || '';
  const uin = cred.uin || parseCookieValue(cookieHeader, 'uin');
  const authst = cred.authst || parseCookieValue(cookieHeader, 'authst');
  const musicKey = cred.musicKey || parseCookieValue(cookieHeader, 'qqmusic_key') || parseCookieValue(cookieHeader, 'qm_keyst');
  const loginType = cred.loginType || parseCookieValue(cookieHeader, 'tmeLoginType') || parseCookieValue(cookieHeader, 'login_type') || '2';
  const guid = parseCookieValue(cookieHeader, 'pgv_pvid') || '10000';

  if (!uin) {
    throw new Error('缺少 QQ 音乐 UIN');
  }
  if (!cookieHeader && !authst && !musicKey) {
    throw new Error('缺少 authst 或 qqmusic_key');
  }

  const body = {
    comm: {
      authst: authst || '',
      ct: '19',
      cv: '1859',
      uin,
      tmeLoginType: loginType,
    },
    req_1: {
      module: 'music.vkey.GetEVkey',
      method: 'CgiGetEVkey',
      param: {
        filename: [filename],
        guid,
        songmid: [songMid],
        songtype: [0],
        uin,
        loginflag: 1,
        platform,
        ctx: 1,
      },
    },
  };

  const normalizedCookieHeader = cookieHeader || (() => {
    const cookieParts = [`uin=${uin}`];
    if (authst) cookieParts.push(`authst=${authst}`);
    if (musicKey) {
      cookieParts.push(`qqmusic_key=${musicKey}`);
      cookieParts.push(`qm_keyst=${musicKey}`);
    }
    if (loginType) {
      cookieParts.push(`login_type=${loginType}`);
      cookieParts.push(`tmeLoginType=${loginType}`);
    }
    return cookieParts.join('; ');
  })();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // 走代理时通过自定义头透传 Cookie（浏览器禁止跨域自定义 Cookie 头）；
  // 直连 u.y.qq.com 时浏览器会自动携带同域 Cookie，无需也不允许手动设置。
  if (isUsingQmProxy) {
    headers['X-QQMusic-Cookie'] = normalizedCookieHeader;
  }

  let resp: Response;
  try {
    resp = await fetch(QM_EKEY_API, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[diag] fetchEkeyFromAPI: fetch failed, isUsingQmProxy=', isUsingQmProxy, 'api=', QM_EKEY_API, 'err=', err);
    if (!isUsingQmProxy) {
      throw new Error('获取 ekey 失败：直连 QQ 音乐接口被浏览器拦截（CORS）。请配置 VITE_QQMUSIC_PROXY_URL 使用代理，或使用桌面端应用。');
    }
    throw new Error(`获取 ekey 失败：网络请求异常（${err instanceof Error ? err.message : String(err)}）`);
  }

  if (!resp.ok) {
    throw new Error(`API 请求失败：HTTP ${resp.status}`);
  }

  const json = await resp.json();
  console.log('[diag] fetchEkeyFromAPI: fullResponse=', JSON.stringify(json).substring(0, 2000));

  if (json.code !== 0) {
    throw new Error(`API 错误：code=${json.code}`);
  }

  const data = json.req_1?.data;
  if (!data || json.req_1?.code !== 0) {
    throw new Error(`GetEVkey 失败：req_1 code=${json.req_1?.code}`);
  }

  console.log('[diag] fetchEkeyFromAPI: authStatus=', JSON.stringify({ uin: data.uin, verify_type: data.verify_type, retcode: data.retcode, login_key_length: data.login_key?.length || 0 }));

  const info = data.midurlinfo?.[0];
  if (!info || !info.ekey) {
    throw new Error(`未获取到 ekey：result=${info?.result ?? '未知'}（可能需要 VIP 或登录状态已过期）`);
  }

  if (info.result !== 0) {
    const errMap: Record<number, string> = {
      104005: '需要 VIP 才能下载该音质，或请求参数错误',
    };
    throw new Error(`GetEVkey 返回错误：${errMap[info.result] ?? `result=${info.result}`}`);
  }

  console.log('[diag] fetchEkeyFromAPI: midurlinfo[0]=', JSON.stringify({ ekey: info.ekey, songmid: info.songmid, filename: info.filename, result: info.result, purl: info.purl }));

  ekeyCache.set(cacheKey, { ekey: info.ekey, purl: info.purl });
  return { ekey: info.ekey, songMid: info.songmid, filename: info.filename };
}

// ==================== 主解密函数 ====================

export async function decryptQMC(data: Uint8Array): Promise<{ data: Uint8Array; ext: string }> {
  console.log('[diag] decryptQMC: len=', data.length, 'head=', Array.from(data.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join(' '), 'tail=', Array.from(data.slice(-8)).map((b) => b.toString(16).padStart(2, '0')).join(' '), 'isMusicex=', isMusicexFormat(data));
  // 1. 检测 musicex 格式 —— 需要外部提供 ekey
  if (isMusicexFormat(data)) {
    const info = parseMusicexFooter(data);
    const songInfo = info
      ? `歌曲 ID ${info.songId}`
      : '未知歌曲';
    throw new MusicexNeedsEkeyError(
      `该文件为 musicex 加密格式（${songInfo}），需提供 ekey 解密。`,
      info ?? undefined
    );
  }

  // 2. 检测 QMCv2 格式（文件头以 "mgg" / "mfl" / "#!" 开头）
  const isQmc2Header =
    data.length > 4 && (
      (data[0] === 0x6D && data[1] === 0x67 && data[2] === 0x67) || // mgg
      (data[0] === 0x6D && data[1] === 0x66 && data[2] === 0x6C) || // mfl
      (data[0] === 0x23 && data[1] === 0x21 && data[2] === 0x51 && data[3] === 0x6B) // #!Qk（新版 QMC2）
    );

  let offset = 4;
  let ext = 'mp3';

  if (isQmc2Header) {
    ext = (data[0] === 0x6D && data[1] === 0x66) ? 'flac' : 'ogg';

    // 尝试提取内嵌 ekey
    const ekey = tryExtractEkey(data);
    if (ekey) {
      try {
        const ekeyRaw = base64Decode(ekey);
        const derivedKey = deriveQMC2Key(ekeyRaw);
        if (derivedKey.length > 0) {
          // 参考实现：从 offset 0 解密整个加密区（含头部魔术字节），不跳过头部
          const decrypted = decryptQMC2WithKey(data, derivedKey, 0);
          ext = detectAudioFormat(decrypted);
          return { data: decrypted, ext };
        }
      } catch {
        // ekey 解析失败，继续报错提示
      }
    }

    // 无内嵌 ekey：新版 QMCv2（手机/新版客户端）密钥为外部存储，静态密码表无法解密
    throw new Error('该文件为无内嵌密钥的 QMCv2 加密（手机/新版客户端），需要外部 QMCv2 密钥才能解密');
  }

  // 3. QMCv1 格式
  if (data[0] === 0x51 && (data[1] & 0xFC) === 0x4D) {
    // QMC0/QMC3/QMCflac: 4-byte header
    offset = 4;
  } else if (data[0] === 0x51 && data[1] === 0x4D && data[2] === 0x43) {
    // QMC 头
    offset = 4;
  }

  const audioData = data.slice(offset);
  let seed = 0;
  if (data.length > 0) {
    seed = data[offset - 1] || 0;
  }

  // 尝试用静态密码表解密（对 QMCv1 更通用）
  const result1 = decryptQMC1Stream(audioData, seed);
  ext = detectAudioFormat(result1);

  // 如果静态密码表结果无效，尝试 ekey 方式
  if (ext === 'mp3' && !isValidAudioHeader(result1)) {
    const ekey = tryExtractEkey(data);
    if (ekey) {
      try {
        const ekeyRaw = base64Decode(ekey);
        const derivedKey = deriveQMC2Key(ekeyRaw);
        if (derivedKey.length > 0) {
          const decrypted = decryptQMC2WithKey(data, derivedKey, 0);
          ext = detectAudioFormat(decrypted);
          return { data: decrypted, ext };
        }
      } catch {
        // 忽略
      }
    }
    return { data: result1, ext };
  }

  return { data: result1, ext };
}

// ==================== 格式检测 ====================

export function detectAudioFormat(data: Uint8Array): string {
  if (data.length < 4) return 'mp3';
  // FLAC: fLaC
  if (data[0] === 0x66 && data[1] === 0x4C && data[2] === 0x61 && data[3] === 0x43) return 'flac';
  // OGG: OggS
  if (data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return 'ogg';
  // WAV: RIFF
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'wav';
  // MP3: 0xFF sync or ID3
  if ((data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) || (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33)) return 'mp3';
  // AAC/ADTS: 0xFF 0xF1 / 0xFF 0xF9
  if (data[0] === 0xFF && (data[1] & 0xF6) === 0xF0) return 'aac';
  // M4A: ftyp
  if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return 'm4a';
  return 'mp3';
}

function isValidAudioHeader(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  // FLAC
  if (data[0] === 0x66 && data[1] === 0x4C && data[2] === 0x61 && data[3] === 0x43) return true;
  // OGG
  if (data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return true;
  // RIFF
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return true;
  // ID3
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  // MP3 sync
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  // AAC
  if (data[0] === 0xFF && (data[1] & 0xF6) === 0xF0) return true;
  // M4A
  if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  return false;
}

// ==================== 文件类型识别 ====================

export function isQMCFile(filename: string): boolean {
  return filename.toLowerCase().split('.').slice(1).some((part) => isQQMusicEncryptedExt(part));
}

/** 验证文件头是否为合法的 QMC 加密文件 */
export function isValidQMCHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // QMCv2 (MGG/MFLAC/new): magic bytes "mgg", "mfl", or "#!Qk"
  if (bytes[0] === 0x6D && bytes[1] === 0x67 && bytes[2] === 0x67) return true; // mgg
  if (bytes[0] === 0x6D && bytes[1] === 0x66 && bytes[2] === 0x6C) return true; // mfl
  if (bytes[0] === 0x23 && bytes[1] === 0x21 && bytes[2] === 0x51 && bytes[3] === 0x6B) return true; // #!Qk
  // QMCv1: "QMC" or "QM" + flag
  if (bytes[0] === 0x51 && bytes[1] === 0x4D && bytes[2] === 0x43) return true; // QMC
  if (bytes[0] === 0x51 && (bytes[1] & 0xFC) === 0x4D) return true; // QM + flag
  // musicex footer check
  if (bytes.length >= 8) {
    const last8 = bytes.slice(bytes.length - 8);
    const magic = new TextDecoder().decode(last8);
    if (magic === 'musicex\0') return true;
  }
  return false;
}

export function getQMCExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext.includes('flac') || ext === 'bkcflac') return 'flac';
  if (ext === 'mgg' || ext === 'mgg1') return 'ogg';
  return 'mp3';
}
