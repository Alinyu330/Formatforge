/**
 * pdfjs worker 包装入口：
 * 静态导入 ES 补丁（先于 pdf.worker.mjs 执行），为 worker 上下文补齐
 * Promise.withResolvers / Promise.try / Map.getOrInsertComputed。
 * 必须用静态 import —— 动态 import 会触发代码分割，与 iife worker 打包格式冲突。
 */
import './es-polyfill';
import 'pdfjs-dist/build/pdf.worker.mjs';
