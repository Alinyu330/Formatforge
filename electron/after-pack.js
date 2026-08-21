/**
 * electron-builder afterPack hook
 * 裁剪 Electron 运行时的语言包，仅保留中文与英文，显著减小安装包体积
 */
exports.default = async function (context) {
  const fs = require('fs');
  const path = require('path');
  const { appOutDir } = context;

  const localesDir = path.join(appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) return;

  const keep = ['zh-CN.pak', 'zh-TW.pak', 'en-US.pak', 'en-GB.pak'];
  let removedBytes = 0;

  for (const file of fs.readdirSync(localesDir)) {
    if (!keep.includes(file)) {
      try {
        const full = path.join(localesDir, file);
        removedBytes += fs.statSync(full).size;
        fs.unlinkSync(full);
      } catch {
        // 忽略删除失败
      }
    }
  }

  console.log(
    `[afterPack] 裁剪语言包，释放 ${(removedBytes / 1024 / 1024).toFixed(1)} MB`,
  );
};
