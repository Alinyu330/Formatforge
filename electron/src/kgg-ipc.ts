/**
 * Electron 主进程 KGG 密钥数据库处理器
 * KGG 密钥存储在酷狗客户端本地数据库 KGMusicV3.db（魔改 SQLCipher）中：
 *   - 数据库以 1024 字节分页，使用 AES-128-CBC 加密（MD5 派生每页 key/iv）
 *   - 解密后为普通 SQLite，从 ShareFileItems 表读取 EncryptionKeyId → EncryptionKey 映射
 */
import { ipcMain, app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import * as crypto from 'crypto';

// ============== 常量 ==============

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1'); // 16 字节
const MASTER_KEY = Buffer.from([
  0x1d, 0x61, 0x31, 0x45, 0xb2, 0x47, 0xbf, 0x7f,
  0x3d, 0x18, 0x96, 0x72, 0x14, 0x4f, 0xe4, 0xbf,
]);
const ENCRYPTED_PAGE_SIZE = 1024;

// ============== 基础工具 ==============

function md5(buf: Buffer): Buffer {
  return crypto.createHash('md5').update(buf).digest();
}

function aesCbcDecrypt(cipher: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}

/** 解析数据库文件头页面大小（SQLite 头部偏移 16..17，值为 1 表示 65536） */
function readPageSize(db: Buffer): number {
  const raw = db.readUInt16BE(16);
  return raw === 1 ? 65536 : raw;
}

// ============== 数据库解密 ==============

/** 依据参考实现计算每个加密页的 AES key 与 IV */
function derivePageKeyIv(pageNo: number): { key: Buffer; iv: Buffer } {
  const temp = Buffer.alloc(24);
  MASTER_KEY.copy(temp, 0);
  temp.writeUInt32LE(pageNo >>> 0, 16);
  temp.writeUInt32LE(0x546c4173, 20);
  const key = md5(temp);

  let ebx = (pageNo + 1) >>> 0;
  const ivSource = Buffer.alloc(16);
  for (let i = 0; i < 16; i += 4) {
    const quotient = Math.floor(ebx / 0xce26);
    const eax = (0x7fffff07 * quotient) >>> 0;
    let ecx = (((0x9ef4 * ebx) >>> 0) - eax) >>> 0;
    if (ecx & 0x80000000) ecx = (ecx + 0x7fffff07) >>> 0;
    ebx = ecx >>> 0;
    ivSource.writeUInt32LE(ebx >>> 0, i);
  }
  const iv = md5(ivSource);

  return { key, iv };
}

/** 校验加密后第 1 页头部（SQLCipher 特征） */
function isValidPage1Header(page: Buffer): boolean {
  const o10 = page.readUInt32LE(16);
  const o14 = page.readUInt32LE(20);
  const v6 = (((o10 & 0xff) << 8) | ((o10 & 0xff00) << 16)) >>> 0;
  const diff = (v6 - 0x200) >>> 0;
  return o14 === 0x20204000 && diff <= 0xfe00 && (v6 & (v6 - 1)) === 0;
}

/** 解密 KGMusicV3.db，返回普通 SQLite 字节 */
function decryptDatabase(db: Buffer): Buffer {
  if (db.length % ENCRYPTED_PAGE_SIZE !== 0) {
    throw new Error('不支持的数据库文件（长度不是页大小整数倍）');
  }
  const lastPage = db.length / ENCRYPTED_PAGE_SIZE;
  const out = Buffer.alloc(db.length);
  const pageBuffer = Buffer.alloc(ENCRYPTED_PAGE_SIZE);

  for (let pageNo = 1; pageNo <= lastPage; pageNo++) {
    db.copy(pageBuffer, 0, (pageNo - 1) * ENCRYPTED_PAGE_SIZE, pageNo * ENCRYPTED_PAGE_SIZE);
    const { key, iv } = derivePageKeyIv(pageNo);

    if (pageNo === 1) {
      // 未加密数据库判定
      if (pageBuffer.subarray(0, 16).equals(SQLITE_HEADER)) {
        db.copy(out, 0);
        return out;
      }
      if (!isValidPage1Header(pageBuffer)) {
        throw new Error('不支持的数据库文件（第 1 页头校验失败）');
      }
      const backup8 = Buffer.from(pageBuffer.subarray(16, 24));
      pageBuffer.copy(pageBuffer, 16, 8, 16); // 偏移 8..15 复制到 16..23
      const cipherFirst = pageBuffer.subarray(16);
      const plainFirst = aesCbcDecrypt(cipherFirst, key, iv);
      if (!plainFirst.subarray(0, 8).equals(backup8)) {
        throw new Error('数据库解密失败（明文校验不匹配）');
      }
      SQLITE_HEADER.copy(out, 0);
      plainFirst.copy(out, SQLITE_HEADER.length);
    } else {
      const plainPage = aesCbcDecrypt(pageBuffer, key, iv);
      plainPage.copy(out, (pageNo - 1) * ENCRYPTED_PAGE_SIZE);
    }
  }

  return out;
}

// ============== SQLite 解析 ==============

function readVarint(buf: Buffer, offset: number): { value: number; size: number } {
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
function readColumnValue(payload: Buffer, offset: number, serialType: number): { size: number; value: unknown } {
  switch (serialType) {
    case 0: return { size: 0, value: null };
    case 1: return { size: 1, value: payload.readInt8(offset) };
    case 2: return { size: 2, value: payload.readInt16BE(offset) };
    case 3: return { size: 3, value: payload.readIntBE(offset, 3) };
    case 4: return { size: 4, value: payload.readInt32BE(offset) };
    case 5: return { size: 6, value: payload.readIntBE(offset, 6) };
    case 6: return { size: 8, value: Number(payload.readBigInt64BE(offset)) };
    case 7: return { size: 8, value: payload.readDoubleBE(offset) };
    case 8: return { size: 0, value: 0 };
    case 9: return { size: 0, value: 1 };
    default:
      if (serialType >= 12 && serialType % 2 === 0) {
        const size = (serialType - 12) / 2;
        return { size, value: payload.subarray(offset, offset + size) };
      }
      if (serialType >= 13 && serialType % 2 === 1) {
        const size = (serialType - 13) / 2;
        return { size, value: payload.toString('utf8', offset, offset + size) };
      }
      return { size: 0, value: null };
  }
}

/** 解码一条 record（payload 已按完整字节取出，含溢出处理） */
function decodeRecord(payload: Buffer): unknown[] {
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
  private readonly db: Buffer;
  readonly pageSize: number;

  constructor(db: Buffer) {
    this.db = db;
    this.pageSize = readPageSize(db);
  }

  /** 读取 b-tree 整页（页内偏移从 0 开始，cell 指针值即页内偏移） */
  private btreePage(pageNo: number): Buffer {
    const start = (pageNo - 1) * this.pageSize;
    return this.db.subarray(start, start + this.pageSize);
  }

  /** 第 1 页前 100 字节是数据库文件头，b-tree 头从偏移 100 开始 */
  private headerOffset(pageNo: number): number {
    return pageNo === 1 ? 100 : 0;
  }

  /** 读取原始整页（溢出页使用） */
  private rawPage(pageNo: number): Buffer {
    const start = (pageNo - 1) * this.pageSize;
    return this.db.subarray(start, start + this.pageSize);
  }

  /** 读取叶子页中某个 cell 的完整 record payload（处理溢出页） */
  private readCellPayload(page: Buffer, cellOffset: number): Buffer {
    const r1 = readVarint(page, cellOffset);
    const payloadLen = r1.value;
    let pos = cellOffset + r1.size;
    const r2 = readVarint(page, pos); // rowid
    const recordStart = pos + r2.size;

    const usable = this.pageSize; // reserved space 通常为 0
    const maxLocal = usable - 35;
    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;

    if (payloadLen <= maxLocal) {
      return page.subarray(recordStart, recordStart + payloadLen);
    }

    let localSize = minLocal + ((payloadLen - minLocal) % (usable - 4));
    if (localSize > maxLocal) localSize = minLocal;

    const inline = page.subarray(recordStart, recordStart + localSize);
    const overflowPage = page.readUInt32BE(recordStart + localSize);
    const rest = this.readOverflowChain(overflowPage, payloadLen - localSize);
    return Buffer.concat([inline, rest]);
  }

  private readOverflowChain(pageNo: number, length: number): Buffer {
    const chunks: Buffer[] = [];
    let remaining = length;
    let current = pageNo;
    const usable = this.pageSize - 4;
    while (remaining > 0 && current !== 0) {
      const raw = this.rawPage(current);
      const next = raw.readUInt32BE(0);
      const take = Math.min(usable, remaining);
      chunks.push(raw.subarray(4, 4 + take));
      remaining -= take;
      current = next;
    }
    return Buffer.concat(chunks);
  }

  /** 遍历指定表 b-tree 的所有记录（叶子/内部页） */
  *walkTableRecords(rootPage: number): Generator<unknown[]> {
    yield* this.walkPage(rootPage);
  }

  private *walkPage(pageNo: number): Generator<unknown[]> {
    const page = this.btreePage(pageNo);
    const h = this.headerOffset(pageNo);
    const pageType = page[h];

    if (pageType === 0x0d) {
      // 叶子表页
      const numCells = page.readUInt16BE(h + 3);
      for (let i = 0; i < numCells; i++) {
        const cellOffset = page.readUInt16BE(h + 8 + i * 2);
        const payload = this.readCellPayload(page, cellOffset);
        yield decodeRecord(payload);
      }
    } else if (pageType === 0x05) {
      // 内部表页
      const numCells = page.readUInt16BE(h + 3);
      for (let i = 0; i < numCells; i++) {
        const cellOffset = page.readUInt16BE(h + 12 + i * 2);
        const childPage = page.readUInt32BE(cellOffset);
        yield* this.walkPage(childPage);
      }
      const rightMost = page.readUInt32BE(h + 8);
      yield* this.walkPage(rightMost);
    }
  }
}

/** 从解密后的 SQLite 中提取 EncryptionKeyId → EncryptionKey 映射 */
function parseKeyMap(db: Buffer): Record<string, string> {
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

// ============== IPC ==============

let keyMapCache: Record<string, string> | null = null;

function getKugouDbPath(): string {
  return join(app.getPath('appData'), 'KuGou8', 'KGMusicV3.db');
}

function loadKeyMap(): Record<string, string> {
  if (keyMapCache) return keyMapCache;

  const dbPath = getKugouDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('未找到酷狗密钥数据库：' + dbPath + '（请先安装并登录酷狗音乐客户端）');
  }

  const encrypted = fs.readFileSync(dbPath);
  const decrypted = decryptDatabase(encrypted);
  keyMapCache = parseKeyMap(decrypted);
  return keyMapCache;
}

export function setupKGGIPC(): void {
  ipcMain.handle('kgg:getKey', async (_event, keyId: string) => {
    if (!keyId) return null;
    try {
      const map = loadKeyMap();
      return map[keyId] ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error('读取酷狗密钥数据库失败：' + message);
    }
  });
}