# Debug Session: ncm-conversion-failure

状态：**[OPEN]**

## 问题

拖入 `.ncm` 音频文件后，转换为其他格式失败，界面提示“转换失败”；浏览器控制台出现：

```text
net::ERR_ABORTED blob:http://localhost:5173/dd5d9d2e-6ebc-4e37-83d2-c26c0f21c149
```

## 可证伪假设

- H1：`.ncm` 被文件类型校验拦截，未进入转换流程。
- H2：NCM 已进入流程，但解析/解密器不支持该文件或读取到无效数据。
- H3：Blob URL 在读取或转换前被提前释放，导致 `net::ERR_ABORTED`。
- H4：转换实际在 Worker/WASM/FFmpeg 中报错，但界面只显示了通用失败提示。
- H5：该 `ERR_ABORTED` 只是下载/预览 Blob 被取消，与转换失败是独立问题。

## 调试流程

1. 在文件入口、转换调用、Blob URL 生命周期、Worker/WASM 错误出口增加最小网络日志。
2. 复现一次并收集 pre-fix 运行时日志。
3. 根据日志确认或排除假设。
4. 仅针对已确认根因实施最小修复。
5. 保留调试服务，复现并比较 post-fix 日志。
6. 用户确认修复后，清理调试插桩、调试服务和本记录。

## 证据记录

### Pre-fix

待收集。

### Post-fix

待收集。

## 结论

待运行时证据确认。
