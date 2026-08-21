/**
 * 酷狗 KGG 密钥库原生桥接（Capacitor 插件）
 * 仅在 Android APK 内注册；Web / Electron 环境通过 registerPlugin 的 web 回退实现。
 */
import { registerPlugin } from '@capacitor/core';

export interface KugouNativePlugin {
  /** 检测设备是否已 root */
  isRooted(): Promise<{ rooted: boolean }>;
  /** 在 root 设备上读取酷狗密钥数据库，返回 base64（未找到为 null） */
  readKugouKeyDb(): Promise<{ data: string | null }>;
}

export const KugouNative = registerPlugin<KugouNativePlugin>('KugouNative', {
  web: () => ({
    isRooted: async () => ({ rooted: false }),
    readKugouKeyDb: async () => ({ data: null }),
  }),
});

/** 从 base64 解码为 Uint8Array */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}