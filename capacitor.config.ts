import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.formatforge.app',
  appName: 'FormatForge',
  webDir: 'dist',

  // 开发时可用本地服务器热重载（需要设备和电脑在同一局域网）
  // 使用时取消注释，修改 url 为电脑的局域网 IP
  // server: {
  //   url: 'http://192.168.x.x:5173',
  //   cleartext: true,
  // },
};

export default config;
