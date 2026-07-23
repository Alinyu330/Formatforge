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

async function aesEcbDecrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-ECB' }, false, ['decrypt']
  );

  // Pad to block size
  const paddedLen = Math.ceil(data.length / 16) * 16;
  const paddedData = new Uint8Array(paddedLen);
  paddedData.set(data);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-ECB' }, cryptoKey, paddedData
  );

  return new Uint8Array(decrypted).slice(0, data.length);
}

async function buildKeyBox(key: Uint8Array): Promise<Uint8Array> {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (box[i] + j + key[i % key.length]) & 0xFF;
    [box[i], box[j]] = [box[j], box[i]];
  }

  return box;
}

export async function decryptNCM(data: Uint8Array): Promise<{ data: Uint8Array; ext: string }> {
  // Check magic header "CTENFDAM"
  const header = new TextDecoder().decode(data.slice(0, 8));
  if (header !== 'CTENFDAM') {
    throw new Error('不是有效的 NCM 文件');
  }

  // Parse NCM header structure (little-endian)
  // Offset 10: key length (4 bytes)
  const keyLen = new DataView(data.buffer, data.byteOffset, data.length).getUint32(10, true);
  const keyData = data.slice(14, 14 + keyLen);

  // Decrypt the RC4 key using AES-128-ECB
  const rc4Key = await aesEcbDecrypt(keyData, NCM_CORE_KEY);

  // Remove padding (PKCS5 padding)
  let keyEnd = rc4Key.length;
  while (keyEnd > 0 && rc4Key[keyEnd - 1] <= 0x10) keyEnd--;
  const actualKey = rc4Key.slice(0, keyEnd);

  // Build RC4 key box
  const keyBox = await buildKeyBox(actualKey);

  // Offset after key: keyLen bytes, then 4 bytes for metadata length
  const metaOffset = 14 + keyLen;
  const metaLen = new DataView(data.buffer, data.byteOffset, data.length).getUint32(metaOffset, true);

  // Decrypt metadata
  const metaData = data.slice(metaOffset + 4, metaOffset + 4 + metaLen);
  const metaDecrypted: number[] = [];
  let x = 0, y = 0;
  for (let i = 0; i < metaLen; i++) {
    x = (x + 1) & 0xFF;
    y = (keyBox[x] + y) & 0xFF;
    [keyBox[x], keyBox[y]] = [keyBox[y], keyBox[x]];
    metaDecrypted.push(metaData[i] ^ keyBox[(keyBox[x] + keyBox[y]) & 0xFF]);
  }

  // Parse metadata JSON to get format
  let ext = 'mp3';
  const metaJson = new TextDecoder().decode(new Uint8Array(metaDecrypted));
  try {
    const meta = JSON.parse(metaJson);
    if (meta.format) {
      ext = meta.format.toLowerCase();
    }
  } catch {}

  // Image/cover data follows meta (5 bytes CRC + 4 bytes image size + image data)
  const imageOffset = metaOffset + 4 + metaLen + 5; // 5 bytes CRC
  const imageLen = new DataView(data.buffer, data.byteOffset, data.length).getUint32(imageOffset, true);
  const musicOffset = imageOffset + 4 + imageLen;

  // Audio data starts at musicOffset, decrypt with RC4
  const audioData = data.slice(musicOffset);

  // Need fresh key box for audio decryption
  const audioBox = await buildKeyBox(actualKey);

  const decrypted = new Uint8Array(audioData.length);
  x = 0; y = 0;
  for (let i = 0; i < audioData.length; i++) {
    x = (x + 1) & 0xFF;
    y = (audioBox[x] + y) & 0xFF;
    [audioBox[x], audioBox[y]] = [audioBox[y], audioBox[x]];
    decrypted[i] = audioData[i] ^ audioBox[(audioBox[x] + audioBox[y]) & 0xFF];
  }

  return { data: decrypted, ext };
}

export function isNCMFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'ncm';
}
