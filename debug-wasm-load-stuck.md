# Debug Session: wasm-load-stuck

- Session: `wasm-load-stuck`
- Status: [OPEN]
- Symptom: `[MediaAdapter] 原生 FFmpeg 不可用，回退到 WASM` 后界面持续转圈，转换未完成。

## Hypotheses
1. 预览环境被误判为 Electron，但未注入 `electronFFmpeg` bridge。
2. FFmpeg WASM core、wasm 或 worker 资源在 Worker 环境中加载失败。
3. WASM 已加载，但文件写入、执行或输出读取阶段未完成。
4. 转换异常未被上层状态清理逻辑处理，导致加载状态永久保留。
5. 打包环境缺少原生或 WASM 媒体资源。

## Evidence
- H1 已确认：Trae 预览的 UA 含 `Electron`，但 `window.electronFFmpeg` 不存在；仅凭 UA 会将预览环境错误识别为 Electron。
- H2 已确认：直接将 Vite 导入的 `coreURL`（`/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`）和 `wasmURL` 传给 `instance.load` 后加载超时，未进入 `exec`。

## Analysis
- H1 的最小修复是要求 Electron 同时具备 `electronFFmpeg` bridge 与 Electron/FormatForge UA，并优先识别 Android Capacitor。
- H2 的最小修复是在加载前将 Vite URL 转为 `coreBlobURL` 与 `wasmBlobURL`，再传给 `instance.load`；当前 `@ffmpeg` 0.12 依赖不需要额外设置 `workerURL`。
- H3（WASM 已加载后的写入、执行或读取阶段）未触及，现有 instrumentation 保留以便后续验证。

## Next
- 使用 Trae 预览复现一次，确认 Blob URL 加载完成并进入现有 `exec` 日志点。
- 若仍卡住，依据保留的 C 点日志继续验证 H3。
