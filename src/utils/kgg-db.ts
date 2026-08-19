/**
 * 酷狗 KGG 密钥数据库（KGMusicV3.db）跨平台解析模块
 * 纯 JavaScript 实现（无 Node crypto / Buffer 依赖），可在浏览器、Android(WebView)、Electron 渲染进程中使用。
 *
 * KGMusicV3.db 是魔改 SQLCipher（AES-128-CBC + MD5 派生每页 key/iv）加密的 SQLite 数据库，
 * 解密后从 ShareFileItems 表读取 EncryptionKeyId → EncryptionKey 映射，供 KGG 文件解密使用。
 */

// ============== 常量 ==============

const SQLITE_HEADER: number[] = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
];

const MASTER_KEY: number[] = [
  0x1d, 0x61, 0x31, 0x45, 0xb2, 0x47, 0xbf, 0x7f,
  0x3d, 0x18, 0x96, 0x72, 0x14, 0x4f, 0xe4, 0xbf,
];

const ENCRYPTED_PAGE_SIZE = 1024;

// ============== 字节工具 ==============

function readUint32LE(d: Uint8Array, o: number): number {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
}

function writeUint32LE(d: Uint8Array, o: number, v: number): void {
  d[o] = v & 0xff;
  d[o + 1] = (v >>> 8) & 0xff;
  d[o + 2] = (v >>> 16) & 0xff;
  d[o + 3] = (v >>> 24) & 0xff;
}

function readUint16BE(d: Uint8Array, o: number): number {
  return (d[o] << 8) | d[o + 1];
}

function readUint32BE(d: Uint8Array, o: number): number {
  return ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
}

function readIntBE(d: Uint8Array, o: number, n: number): number {
  let v = d[o];
  for (let i = 1; i < n; i++) v = v * 256 + d[o + i];
  if (d[o] & 0x80) v -= Math.pow(2, 8 * n);
  return v;
}

function readInt64BE(d: Uint8Array, o: number): bigint {
  let u = 0n;
  for (let i = 0; i < 8; i++) u = (u << 8n) | BigInt(d[o + i]);
  return u >= 0x8000000000000000n ? u - 0x10000000000000000n : u;
}

function readFloat64BE(d: Uint8Array, o: number): number {
  const dv = new DataView(d.buffer, d.byteOffset + o, 8);
  return dv.getFloat64(0);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

// ============== MD5（RFC 1321，纯 JS） ==============

function md5(input: Uint8Array): Uint8Array {
  const len = input.length;
  const bitLen = len * 8;
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(input);
  msg[len] = 0x80;

  const dv = new DataView(msg.buffer);
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }
  const s: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (i < 16) s.push([7, 12, 17, 22][i % 4]);
    else if (i < 32) s.push([5, 9, 14, 20][i % 4]);
    else if (i < 48) s.push([4, 11, 16, 23][i % 4]);
    else s.push([6, 10, 15, 21][i % 4]);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let blk = 0; blk < paddedLen; blk += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      const off = blk + j * 4;
      M[j] = (msg[off] | (msg[off + 1] << 8) | (msg[off + 2] << 16) | (msg[off + 3] << 24)) >>> 0;
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  writeUint32LE(out, 0, a0);
  writeUint32LE(out, 4, b0);
  writeUint32LE(out, 8, c0);
  writeUint32LE(out, 12, d0);
  return out;
}

// ============== AES-128（解密，纯 JS） ==============

// 标准 S-box（FIPS-197）
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

// 逆 S-box（由 S-box 生成）
const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/** GF(2^8) 乘法 */
function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p & 0xff;
}

/** AES-128 密钥扩展，返回 176 字节的轮密钥（11 轮 × 16 字节） */
function expandKey128(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key, 0);
  let bytes = 16;
  let rcon = 0;
  const temp = new Uint8Array(4);

  while (bytes < 176) {
    for (let i = 0; i < 4; i++) temp[i] = w[bytes - 4 + i];
    if (bytes % 16 === 0) {
      const t0 = temp[0];
      temp[0] = temp[1];
      temp[1] = temp[2];
      temp[2] = temp[3];
      temp[3] = t0;
      for (let i = 0; i < 4; i++) temp[i] = SBOX[temp[i]];
      temp[0] ^= RCON[rcon++];
    }
    for (let i = 0; i < 4; i++) {
      w[bytes] = w[bytes - 16] ^ temp[i];
      bytes++;
    }
  }
  return w;
}

function invShiftRows(s: Uint8Array): Uint8Array {
  const t = new Uint8Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      t[((c + r) % 4) * 4 + r] = s[c * 4 + r];
    }
  }
  return t;
}

function invSubBytes(s: Uint8Array): Uint8Array {
  const t = new Uint8Array(16);
  for (let i = 0; i < 16; i++) t[i] = INV_SBOX[s[i]];
  return t;
}

function addRoundKey(s: Uint8Array, rk: Uint8Array, round: number): Uint8Array {
  const o = round * 16;
  const t = new Uint8Array(16);
  for (let i = 0; i < 16; i++) t[i] = s[i] ^ rk[o + i];
  return t;
}

function invMixColumns(s: Uint8Array): Uint8Array {
  const t = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    const o = c * 4;
    const a0 = s[o];
    const a1 = s[o + 1];
    const a2 = s[o + 2];
    const a3 = s[o + 3];
    t[o] = gmul(a0, 0x0e) ^ gmul(a1, 0x0b) ^ gmul(a2, 0x0d) ^ gmul(a3, 0x09);
    t[o + 1] = gmul(a0, 0x09) ^ gmul(a1, 0x0e) ^ gmul(a2, 0x0b) ^ gmul(a3, 0x0d);
    t[o + 2] = gmul(a0, 0x0d) ^ gmul(a1, 0x09) ^ gmul(a2, 0x0e) ^ gmul(a3, 0x0b);
    t[o + 3] = gmul(a0, 0x0b) ^ gmul(a1, 0x0d) ^ gmul(a2, 0x09) ^ gmul(a3, 0x0e);
  }
  return t;
}

/** AES-128 单块解密 */
function aes128DecryptBlock(block: Uint8Array, rk: Uint8Array): Uint8Array {
  let s = block.slice(0, 16);
  s = addRoundKey(s, rk, 10);
  for (let round = 9; round >= 1; round--) {
    s = invShiftRows(s);
    s = invSubBytes(s);
    s = addRoundKey(s, rk, round);
    s = invMixColumns(s);
  }
  s = invShiftRows(s);
  s = invSubBytes(s);
  s = addRoundKey(s, rk, 0);
  return s;
}

/** AES-128-CBC 解密（无 padding，输出长度与输入一致） */
function aes128CbcDecrypt(cipher: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const rk = expandKey128(key);
  const out = new Uint8Array(cipher.length);
  const prev = iv.slice(0, 16);
  const block = new Uint8Array(16);

  for (let off = 0; off < cipher.length; off += 16) {
    block.set(cipher.subarray(off, off + 16));
    const plain = aes128DecryptBlock(block, rk);
    for (let i = 0; i < 16; i++) {
      out[off + i] = plain[i] ^ prev[i];
      prev[i] = cipher[off + i];
    }
  }
  return out;
}

// ============== SQLCipher 数据库解密 ==============

/** 依据参考实现计算每个加密页的 AES key 与 IV */
function derivePageKeyIv(pageNo: number): { key: Uint8Array; iv: Uint8Array } {
  const temp = new Uint8Array(24);
  temp.set(MASTER_KEY, 0);
  writeUint32LE(temp, 16, pageNo >>> 0);
  writeUint32LE(temp, 20, 0x546c4173);
  const key = md5(temp);

  let ebx = (pageNo + 1) >>> 0;
  const ivSource = new Uint8Array(16);
  for (let i = 0; i < 16; i += 4) {
    const quotient = Math.floor(ebx / 0xce26);
    const eax = (0x7fffff07 * quotient) >>> 0;
    let ecx = (((0x9ef4 * ebx) >>> 0) - eax) >>> 0;
    if (ecx & 0x80000000) ecx = (ecx + 0x7fffff07) >>> 0;
    ebx = ecx >>> 0;
    writeUint32LE(ivSource, i, ebx >>> 0);
  }
  const iv = md5(ivSource);

  return { key, iv };
}

/** 校验加密封装后第 1 页头部（SQLCipher 特征） */
function isValidPage1Header(page: Uint8Array): boolean {
  const o10 = readUint32LE(page, 16);
  const o14 = readUint32LE(page, 20);
  const v6 = (((o10 & 0xff) << 8) | ((o10 & 0xff00) << 16)) >>> 0;
  const diff = (v6 - 0x200) >>> 0;
  return o14 === 0x20204000 && diff <= 0xfe00 && (v6 & (v6 - 1)) === 0;
}

/** 解密 KGMusicV3.db，返回普通 SQLite 字节 */
export function decryptKugouDatabase(db: Uint8Array): Uint8Array {
  if (db.length % ENCRYPTED_PAGE_SIZE !== 0) {
    throw new Error('不支持的密钥数据库文件（长度不是页大小整数倍）');
  }
  const header = new Uint8Array(SQLITE_HEADER);
  const lastPage = db.length / ENCRYPTED_PAGE_SIZE;
  const out = new Uint8Array(db.length);
  const pageBuffer = new Uint8Array(ENCRYPTED_PAGE_SIZE);

  for (let pageNo = 1; pageNo <= lastPage; pageNo++) {
    pageBuffer.set(db.subarray((pageNo - 1) * ENCRYPTED_PAGE_SIZE, pageNo * ENCRYPTED_PAGE_SIZE));
    const { key, iv } = derivePageKeyIv(pageNo);

    if (pageNo === 1) {
      // 未加密数据库判定
      if (bytesEqual(pageBuffer.subarray(0, 16), header)) {
        out.set(db);
        return out;
      }
      if (!isValidPage1Header(pageBuffer)) {
        throw new Error('不支持的密钥数据库文件（第 1 页头校验失败）');
      }
      const backup8 = pageBuffer.slice(16, 24);
      pageBuffer.copyWithin(16, 8, 16); // 偏移 8..15 复制到 16..23
      const cipherFirst = pageBuffer.subarray(16);
      const plainFirst = aes128CbcDecrypt(cipherFirst, key, iv);
      if (!bytesEqual(plainFirst.subarray(0, 8), backup8)) {
        throw new Error('密钥数据库解密失败（明文校验不匹配）');
      }
      out.set(header, 0);
      out.set(plainFirst, header.length);
    } else {
      const plainPage = aes128CbcDecrypt(pageBuffer, key, iv);
      out.set(plainPage, (pageNo - 1) * ENCRYPTED_PAGE_SIZE);
    }
  }

  return out;
}

// ============== SQLite 解析 ==============

function readVarint(buf: Uint8Array, offset: number): { value: number; size: number } {
  let value = 0;
  for (let i = 0; i < 8; i++) {
    const b = buf[offset + i];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return { value, size: i + 1 };
  }
  const b = buf[offset + 8];
  value = (value << 8) | b;
  return { value, size: 9 };
}

/** 从 CREATE TABLE 语句中解析列名（按顺序） */
function parseColumnNames(createSql: string): string[] {
  const open = createSql.indexOf('(');
  const close = createSql.lastIndexOf(')');
  if (open < 0 || close <= open) return [];

  const inside = createSql.slice(open + 1, close);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < inside.length; i++) {
    const c = inside[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(inside.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inside.slice(start));

  return parts
    .map((p) => {
      const m = p.trim().match(/^[`"[]?([A-Za-z_][A-Za-z0-9_]*)/);
      return m ? m[1] : '';
    })
    .filter(Boolean);
}

/** 依据 serial type 读取单个字段 */
function readColumnValue(payload: Uint8Array, offset: number, serialType: number): { size: number; value: unknown } {
  switch (serialType) {
    case 0: return { size: 0, value: null };
    case 1: return { size: 1, value: readIntBE(payload, offset, 1) };
    case 2: return { size: 2, value: readIntBE(payload, offset, 2) };
    case 3: return { size: 3, value: readIntBE(payload, offset, 3) };
    case 4: return { size: 4, value: readIntBE(payload, offset, 4) };
    case 5: return { size: 6, value: readIntBE(payload, offset, 6) };
    case 6: return { size: 8, value: Number(readInt64BE(payload, offset)) };
    case 7: return { size: 8, value: readFloat64BE(payload, offset) };
    case 8: return { size: 0, value: 0 };
    case 9: return { size: 0, value: 1 };
    default:
      if (serialType >= 12 && serialType % 2 === 0) {
        const size = (serialType - 12) / 2;
        return { size, value: payload.subarray(offset, offset + size) };
      }
      if (serialType >= 13 && serialType % 2 === 1) {
        const size = (serialType - 13) / 2;
        return { size, value: decodeUtf8(payload.subarray(offset, offset + size)) };
      }
      return { size: 0, value: null };
  }
}

/** 解码一条 record */
function decodeRecord(payload: Uint8Array): unknown[] {
  const first = readVarint(payload, 0);
  const headerSize = first.value;
  let pos = first.size;

  const serialTypes: number[] = [];
  while (pos < headerSize) {
    const r = readVarint(payload, pos);
    serialTypes.push(r.value);
    pos += r.size;
  }

  let dataPos = headerSize;
  const values: unknown[] = [];
  for (const st of serialTypes) {
    const { size, value } = readColumnValue(payload, dataPos, st);
    values.push(value);
    dataPos += size;
  }
  return values;
}

class SQLiteReader {
  private readonly db: Uint8Array;
  readonly pageSize: number;

  constructor(db: Uint8Array) {
    this.db = db;
    const raw = db.length >= 18 ? readUint16BE(db, 16) : 0;
    this.pageSize = raw === 1 ? 65536 : raw;
  }

  private btreePage(pageNo: number): Uint8Array {
    const start = (pageNo - 1) * this.pageSize;
    return this.db.subarray(start, start + this.pageSize);
  }

  private headerOffset(pageNo: number): number {
    return pageNo === 1 ? 100 : 0;
  }

  private rawPage(pageNo: number): Uint8Array {
    const start = (pageNo - 1) * this.pageSize;
    return this.db.subarray(start, start + this.pageSize);
  }

  private readCellPayload(page: Uint8Array, cellOffset: number): Uint8Array {
    const r1 = readVarint(page, cellOffset);
    const payloadLen = r1.value;
    const pos = cellOffset + r1.size;
    const r2 = readVarint(page, pos);
    const recordStart = pos + r2.size;

    const usable = this.pageSize;
    const maxLocal = usable - 35;
    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;

    if (payloadLen <= maxLocal) {
      return page.subarray(recordStart, recordStart + payloadLen);
    }

    let localSize = minLocal + ((payloadLen - minLocal) % (usable - 4));
    if (localSize > maxLocal) localSize = minLocal;

    const inline = page.subarray(recordStart, recordStart + localSize);
    const overflowPage = readUint32BE(page, recordStart + localSize);
    const rest = this.readOverflowChain(overflowPage, payloadLen - localSize);
    return new Uint8Array([...inline, ...rest]);
  }

  private readOverflowChain(pageNo: number, length: number): Uint8Array {
    const chunks: Uint8Array[] = [];
    let remaining = length;
    let current = pageNo;
    const usable = this.pageSize - 4;
    while (remaining > 0 && current !== 0) {
      const raw = this.rawPage(current);
      const next = readUint32BE(raw, 0);
      const take = Math.min(usable, remaining);
      chunks.push(raw.subarray(4, 4 + take));
      remaining -= take;
      current = next;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }

  *walkTableRecords(rootPage: number): Generator<unknown[]> {
    yield* this.walkPage(rootPage);
  }

  private *walkPage(pageNo: number): Generator<unknown[]> {
    const page = this.btreePage(pageNo);
    const h = this.headerOffset(pageNo);
    const pageType = page[h];

    if (pageType === 0x0d) {
      const numCells = readUint16BE(page, h + 3);
      for (let i = 0; i < numCells; i++) {
        const cellOffset = readUint16BE(page, h + 8 + i * 2);
        const payload = this.readCellPayload(page, cellOffset);
        yield decodeRecord(payload);
      }
    } else if (pageType === 0x05) {
      const numCells = readUint16BE(page, h + 3);
      for (let i = 0; i < numCells; i++) {
        const cellOffset = readUint16BE(page, h + 12 + i * 2);
        const childPage = readUint32BE(page, cellOffset);
        yield* this.walkPage(childPage);
      }
      const rightMost = readUint32BE(page, h + 8);
      yield* this.walkPage(rightMost);
    }
  }
}

/** 从解密后的 SQLite 中提取 EncryptionKeyId → EncryptionKey 映射 */
export function parseKugouKeyMap(db: Uint8Array): Record<string, string> {
  const reader = new SQLiteReader(db);

  let rootPage = 0;
  let createSql = '';
  for (const record of reader.walkTableRecords(1)) {
    if (record[0] === 'table' && record[1] === 'ShareFileItems') {
      rootPage = typeof record[3] === 'number' ? record[3] : 0;
      createSql = typeof record[4] === 'string' ? record[4] : '';
      break;
    }
  }
  if (!rootPage) {
    throw new Error('数据库中未找到 ShareFileItems 表');
  }

  const columns = parseColumnNames(createSql);
  const idIdx = columns.indexOf('EncryptionKeyId');
  const keyIdx = columns.indexOf('EncryptionKey');
  if (idIdx < 0 || keyIdx < 0) {
    throw new Error('ShareFileItems 表缺少 EncryptionKeyId/EncryptionKey 列');
  }

  const map: Record<string, string> = {};
  for (const record of reader.walkTableRecords(rootPage)) {
    const id = record[idIdx];
    const key = record[keyIdx];
    if (typeof id === 'string' && id && typeof key === 'string' && key) {
      map[id] = key;
    }
  }
  return map;
}

/** 一步到位：解密 KGMusicV3.db 并解析出密钥映射 */
export function loadKugouKeyMap(db: Uint8Array): Record<string, string> {
  const decrypted = decryptKugouDatabase(db);
  return parseKugouKeyMap(decrypted);
}