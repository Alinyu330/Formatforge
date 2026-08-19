// 网易云音乐 NCM 加密格式解密

// Well-known static AES key used by NetEase
const NCM_CORE_KEY = new Uint8Array([
  0x68, 0x7A, 0x48, 0x52, 0x41, 0x6D, 0x73, 0x6F,
  0x35, 0x6B, 0x49, 0x6E, 0x62, 0x61, 0x78, 0x57,
]);

const NCM_META_KEY = new Uint8Array([
  0x23, 0x31, 0x34, 0x6C, 0x6A, 0x6B, 0x5F, 0x21,
  0x5C, 0x5D, 0x26, 0x30, 0x55, 0x3C, 0x27, 0x28,
]);

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/** 去除 PKCS7 填充 */
function unpad(data: Uint8Array): Uint8Array {
  const pad = data[data.length - 1];
  if (pad > 0 && pad <= 16) return data.slice(0, data.length - pad);
  return data;
}

// ===== AES-128-ECB 解密（纯 JS 实现，避免依赖 WebCrypto） =====
// 部分环境（如内嵌 webview）的 crypto.subtle.decrypt 会抛 OperationError，故这里自行实现。

function gfMul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function gfInv(x: number): number {
  if (x === 0) return 0;
  let result = 1;
  let base = x;
  let exp = 254;
  while (exp > 0) {
    if (exp & 1) result = gfMul(result, base);
    base = gfMul(base, base);
    exp >>= 1;
  }
  return result;
}

function rotl8(x: number, n: number): number {
  return ((x << n) | (x >>> (8 - n))) & 0xff;
}

function aesAffine(b: number): number {
  return (b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63) & 0xff;
}

const AES_SBOX = new Uint8Array(256);
const AES_INV_SBOX = new Uint8Array(256);
(() => {
  for (let i = 0; i < 256; i++) AES_SBOX[i] = aesAffine(gfInv(i));
  for (let i = 0; i < 256; i++) AES_INV_SBOX[AES_SBOX[i]] = i;
})();

function aesExpandKey(key: Uint8Array): Uint8Array[] {
  const rcon = new Uint8Array(11);
  rcon[1] = 0x01;
  for (let i = 2; i <= 10; i++) rcon[i] = gfMul(rcon[i - 1], 0x02);

  const w = new Uint8Array(176);
  for (let i = 0; i < 16; i++) w[i] = key[i];

  let gen = 16;
  while (gen < 176) {
    let temp = [w[gen - 4], w[gen - 3], w[gen - 2], w[gen - 1]];
    if (gen % 16 === 0) {
      temp = [temp[1], temp[2], temp[3], temp[0]];
      for (let i = 0; i < 4; i++) temp[i] = AES_SBOX[temp[i]];
      temp[0] ^= rcon[gen / 16];
    }
    for (let i = 0; i < 4; i++) {
      w[gen] = w[gen - 16] ^ temp[i];
      gen++;
    }
  }

  const roundKeys: Uint8Array[] = [];
  for (let r = 0; r < 11; r++) roundKeys.push(w.slice(r * 16, r * 16 + 16));
  return roundKeys;
}

function aesAddRoundKey(state: Uint8Array, rk: Uint8Array): void {
  for (let i = 0; i < 16; i++) state[i] ^= rk[i];
}

function aesInvSubBytes(state: Uint8Array): void {
  for (let i = 0; i < 16; i++) state[i] = AES_INV_SBOX[state[i]];
}

function aesInvShiftRows(state: Uint8Array): void {
  const t = state.slice();
  state[1] = t[13]; state[5] = t[1]; state[9] = t[5]; state[13] = t[9];
  state[2] = t[10]; state[6] = t[14]; state[10] = t[2]; state[14] = t[6];
  state[3] = t[7]; state[7] = t[11]; state[11] = t[15]; state[15] = t[3];
}

function aesInvMixColumns(state: Uint8Array): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
    state[i]     = gfMul(a0, 0x0e) ^ gfMul(a1, 0x0b) ^ gfMul(a2, 0x0d) ^ gfMul(a3, 0x09);
    state[i + 1] = gfMul(a0, 0x09) ^ gfMul(a1, 0x0e) ^ gfMul(a2, 0x0b) ^ gfMul(a3, 0x0d);
    state[i + 2] = gfMul(a0, 0x0d) ^ gfMul(a1, 0x09) ^ gfMul(a2, 0x0e) ^ gfMul(a3, 0x0b);
    state[i + 3] = gfMul(a0, 0x0b) ^ gfMul(a1, 0x0d) ^ gfMul(a2, 0x09) ^ gfMul(a3, 0x0e);
  }
}

function aesDecryptBlock(block: Uint8Array, roundKeys: Uint8Array[]): Uint8Array {
  const state = block.slice();
  aesAddRoundKey(state, roundKeys[10]);
  for (let round = 9; round >= 1; round--) {
    aesInvShiftRows(state);
    aesInvSubBytes(state);
    aesAddRoundKey(state, roundKeys[round]);
    aesInvMixColumns(state);
  }
  aesInvShiftRows(state);
  aesInvSubBytes(state);
  aesAddRoundKey(state, roundKeys[0]);
  return state;
}

function aesEcbDecrypt(data: Uint8Array, key: Uint8Array, label: string): Uint8Array {
  if (data.length === 0 || data.length % 16 !== 0) {
    throw new Error(`${label}: 待解密数据长度不是 16 字节的倍数 (len=${data.length})`);
  }
  const roundKeys = aesExpandKey(key);
  const out = new Uint8Array(data.length);
  for (let offset = 0; offset < data.length; offset += 16) {
    out.set(aesDecryptBlock(data.slice(offset, offset + 16), roundKeys), offset);
  }
  return out;
}

// ===== NCM 定制的 RC4 KSA（生成音频解密用的 S 盒） =====

function buildKeyBox(key: Uint8Array): Uint8Array {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;

  let c = 0;
  let lastByte = 0;
  let keyOffset = 0;
  for (let i = 0; i < 256; i++) {
    const swap = box[i];
    c = (swap + lastByte + key[keyOffset]) & 0xFF;
    keyOffset++;
    if (keyOffset >= key.length) keyOffset = 0;
    box[i] = box[c];
    box[c] = swap;
    lastByte = c;
  }

  return box;
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function detectAudioExt(data: Uint8Array): string {
  if (data.length >= 4 && data[0] === 0x66 && data[1] === 0x4C && data[2] === 0x61 && data[3] === 0x43) return 'flac';
  return 'mp3';
}

export async function decryptNCM(data: Uint8Array): Promise<{ data: Uint8Array; ext: string }> {
  console.log('[NCM] 开始解密，文件大小=', data.length, 'bytes');

  // Check magic header "CTENFDAM"
  const header = new TextDecoder().decode(data.slice(0, 8));
  if (header !== 'CTENFDAM') {
    console.warn('[NCM] 文件头不匹配，期望 CTENFDAM，实际=', header);
    throw new Error('不是有效的 NCM 文件');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.length);

  // ===== 解密 RC4 核心密钥 =====
  // 结构：8 字节 magic + 2 字节 gap + 4 字节 key length（小端）
  const keyLen = view.getUint32(10, true);
  console.warn('[NCM] keyLen=', keyLen, 'keyLen%16=', keyLen % 16);
  const keyData = data.slice(14, 14 + keyLen);

  // 第一层：逐字节与 0x64 异或
  for (let i = 0; i < keyData.length; i++) keyData[i] ^= 0x64;

  // 第二层：AES-128-ECB 解密（CORE_KEY）
  const decryptedKey = unpad(aesEcbDecrypt(keyData, NCM_CORE_KEY, '密钥'));
  console.warn('[NCM] decryptedKey.length=', decryptedKey.length, 'first=', hex(decryptedKey.slice(0, 32)));

  // 去掉前缀 "neteasecloudmusic"（17 字节），得到 RC4 密钥
  const rc4Key = decryptedKey.slice(17);
  console.warn('[NCM] rc4Key.length=', rc4Key.length);
  const keyBox = buildKeyBox(rc4Key);

  // ===== 解密元数据（JSON） =====
  const metaOffset = 14 + keyLen;
  const metaLen = view.getUint32(metaOffset, true);
  console.warn('[NCM] metaLen=', metaLen);
  const metaData = data.slice(metaOffset + 4, metaOffset + 4 + metaLen);

  // 第一层：逐字节与 0x63 异或
  for (let i = 0; i < metaData.length; i++) metaData[i] ^= 0x63;

  let ext = '';
  try {
    // 去掉前缀 "163 key(Don't modify):"（22 字节）后 base64 解码
    const metaB64 = base64Decode(new TextDecoder().decode(metaData.slice(22)));
    console.warn('[NCM] metaB64.length=', metaB64.length, 'metaB64%16=', metaB64.length % 16);
    // 第二层：AES-128-ECB 解密（META_KEY）
    const metaRaw = unpad(aesEcbDecrypt(metaB64, NCM_META_KEY, '元数据'));
    // 去掉前缀 "music:"（6 字节）后解析 JSON
    const meta = JSON.parse(new TextDecoder().decode(metaRaw.slice(6)));
    if (meta.format) ext = meta.format.toLowerCase();
    console.warn('[NCM] 元数据 format=', meta.format, '→ ext=', ext);
  } catch (err) {
    console.warn('[NCM] 元数据解析失败，回退为按音频头检测:', err);
  }

  // ===== 定位音频数据 =====
  // 元数据之后依次是：crc32(4) + gap(5) + image size(4) + image data
  let musicOffset = metaOffset + 4 + metaLen;
  musicOffset += 4; // crc32
  musicOffset += 5; // gap
  const imageSize = view.getUint32(musicOffset, true);
  musicOffset += 4 + imageSize;

  const audioData = data.slice(musicOffset);
  console.warn('[NCM] musicOffset=', musicOffset, 'imageSize=', imageSize, 'audioData.length=', audioData.length);

  // ===== 解密音频（NCM 定制无状态 PRGA） =====
  const decrypted = new Uint8Array(audioData.length);
  for (let i = 1; i <= audioData.length; i++) {
    const j = i & 0xFF;
    decrypted[i - 1] = audioData[i - 1] ^ keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xFF]) & 0xFF];
  }

  if (!ext) ext = detectAudioExt(decrypted);
  console.warn('[NCM] 解密完成，ext=', ext, 'first16=', hex(decrypted.slice(0, 16)));

  return { data: decrypted, ext };
}

export function isNCMFile(filename: string): boolean {
  return filename.toLowerCase().split('.').slice(1).includes('ncm');
}

/** 验证文件头是否为合法的 NCM 加密文件 */
export function isValidNCMHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  return header === 'CTENFDAM';
}
