/**
 * pdfjs 共享入口：
 * - 主线程注入 ES2024/ES2025 补丁（Promise.withResolvers / Promise.try / Map.getOrInsertComputed，
 *   旧 Electron/WebView 缺失这些 API）
 * - 用带补丁的包装 worker（pdf.worker.ts）替代官方 workerSrc：
 *   worker 上下文无法共享主线程补丁，必须独立注入
 * PreviewPanel / pdf.ts 统一从这里导入，避免各自配置 workerSrc。
 */
import './es-polyfill';
import * as pdfjsLib from 'pdfjs-dist';

const pdfWorker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorker;

export { pdfjsLib };
