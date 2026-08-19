# Debug Session: media-wasm-timeout

Status: [OPEN]

## Symptom

WASM-FFmpeg 预加载失败：音频/视频转换引擎加载超时（WASM 编译过慢）。目标是采用最简单、可靠的转换路径，确保后续转换可以正常执行。

## Hypotheses

1. 首次 WASM 加载超时，但转换时重试可以成功。
2. FFmpeg 核心文件或依赖文件网络请求失败或响应过慢。
3. 当前加载超时时间过短，浏览器仍在编译时被误判失败。
4. 预加载失败阻塞了正常转换流程。

## Evidence

- User-provided console warning: `[WASM-FFmpeg] 预加载失败（后续转换时会重试）`.

## Changes

- Bootstrap record only. No business logic changed yet.

## Verification

Pending runtime reproduction and user confirmation.
