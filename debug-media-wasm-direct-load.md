# Debug Session: media-wasm-direct-load

Status: [OPEN]

## Symptom

延长 WASM 加载超时后仍然出现预加载超时，实际音视频格式转换无法执行。

## Hypotheses

1. `toBlobURL()` 下载并复制约 32 MB WASM 文件时卡住。
2. core、wasm 或 worker 资源中的某一个 URL 无法正常完成请求。
3. Blob URL 在当前 Vite 预览环境下导致 Worker 初始化失败。
4. 预加载和实际转换共享卡住的加载 Promise。

## Evidence

- User-provided warning still reports `preloadFFmpeg` timeout after the previous 60s -> 300s timeout change.
- Source build output contains a local FFmpeg WASM asset of approximately 32 MB.
- Current loader calls `toBlobURL` for all three resources before `instance.load`.

## Changes

Bootstrap record. Business logic remains unchanged until instrumentation evidence is collected.

## Verification

Pending.
