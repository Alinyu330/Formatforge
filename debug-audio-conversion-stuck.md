# 调试记录：audio-conversion-stuck

- 会话：`audio-conversion-stuck`
- 状态：`[OPEN]`
- 症状：图片可正常转换；音频、视频的转换引擎加载超时。

## 证据与结论

- 图片不依赖 FFmpeg，因此正常。
- 音频与视频共享 FFmpeg Core/WASM；界面显示“转换引擎加载超时”，证明两条外部 CDN 路径在当前网络环境不可用。

## 已实施修复

1. 安装 `@ffmpeg/core@0.12.6` 作为项目依赖。
2. 音频与视频改用 Vite 打包的本地 Core JS/WASM 资源，不再请求外部 CDN。
3. 生产构建已确认包含 `ffmpeg-core` JS 和约 32 MB 的 WASM 资源。

## 验证

- `npm run build` 成功。
- 待用户刷新开发页面后重新验证 MFLAC → MP3/OPUS 与任意视频转换。
