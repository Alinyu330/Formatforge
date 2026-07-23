// 酷狗音乐 KGM/KWM 加密格式解密

const KGM_SLOT_KEY = [
  0x6A, 0xAA, 0x01, 0xAE, 0x0E, 0x2E, 0x98, 0x41,
  0x7A, 0xBC, 0x14, 0xF0, 0x5B, 0x57, 0x24, 0x6C,
  0x56, 0xE9, 0x20, 0x7A, 0xBB, 0x62, 0x0E, 0xD6,
  0x2D, 0xCA, 0x00, 0x5A, 0xD3, 0x17, 0xAA, 0x29,
];

function createKGMTable(key: Uint8Array): Uint8Array {
  const table = new Uint8Array(1024);
  let v = 0;
  for (let i = 0; i < 1024; i++) {
    // Mix with slot key
    v = (v + KGM_SLOT_KEY[i % KGM_SLOT_KEY.length]) & 0xFFFF;
    const idx = (v * 0x100 + key[i % key.length]) & 0xFFFF;
    table[i] = ((idx >> 8) ^ (idx & 0xFF)) & 0xFF;
  }
  return table;
}

export async function decryptKGM(data: Uint8Array): Promise<{ data: Uint8Array; ext: string }> {
  // KGM header: "VPR" (3 bytes) + 1 byte + 4 bytes file key
  if (data.length < 8) {
    throw new Error('不是有效的 KGM 文件');
  }

  // Check VPR header
  const magic = String.fromCharCode(data[0], data[1], data[2]);
  if (magic !== 'VPR') {
    // Try KWM header (some KWM files start differently)
    // KWM may have different structure, try simple XOR approach
    return decryptKGMAlt(data);
  }

  const fileKey = data.slice(4, 8);

  // Create decryption table
  const table = createKGMTable(fileKey);

  // Audio starts at offset 8
  const audioData = data.slice(8);

  const decrypted = new Uint8Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    decrypted[i] = audioData[i] ^ table[i % table.length];
  }

  const ext = detectFormat(decrypted);

  return { data: decrypted, ext };
}

// KWM alternative - some KWM files have minimal XOR pattern
function decryptKGMAlt(data: Uint8Array): { data: Uint8Array; ext: string } {
  // KWM: typically XOR with pattern based on simple key
  // Many KWM files use a fixed XOR pattern
  const xorKey = new Uint8Array([0x6C, 0x3F, 0xAA, 0x5C, 0x91, 0xD7, 0x23, 0x78]);
  const audioData = data.slice(0);

  const decrypted = new Uint8Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    decrypted[i] = audioData[i] ^ xorKey[i % xorKey.length];
  }

  const ext = detectFormat(decrypted);

  return { data: decrypted, ext };
}

function detectFormat(data: Uint8Array): string {
  if (data.length < 4) return 'mp3';
  if (data[0] === 0x66 && data[1] === 0x4C && data[2] === 0x61 && data[3] === 0x43) return 'flac';
  if (data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return 'ogg';
  if ((data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) || (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33)) return 'mp3';
  if (data[0] === 0xFF && (data[1] & 0xF6) === 0xF0) return 'aac';
  return 'mp3';
}

export function isKGMFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['kgm', 'kgma', 'kwm', 'vpr'].includes(ext);
}
