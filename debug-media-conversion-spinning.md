# Debug Session: media-conversion-spinning

- Status: [OPEN]
- Symptom: 点击音频或视频格式转换后一直转圈，任务无法完成。
- Session: media-conversion-spinning

## Reproduction

1. 打开音频或视频转换页面。
2. 添加一个音频/视频文件。
3. 选择目标格式。
4. 点击“开始转换”。
5. 观察任务是否一直处于转换中。

## Hypotheses

1. 适配器选择错误，平台没有进入预期的 Web WASM、Android WASM 或 Electron 原生实现。
2. FFmpeg 引擎加载或原生 FFmpeg IPC 调用没有完成。
3. FFmpeg 已执行，但输入格式、编码器或参数导致进程卡住/失败，错误没有正确显示。
4. 转换进度事件没有触发，但转换任务本身仍在运行。
5. 任务状态更新或外层超时逻辑异常，导致 UI 一直显示 converting。

## Evidence

- Pending runtime instrumentation and reproduction.

## Changes

- No business logic changes before runtime evidence.
