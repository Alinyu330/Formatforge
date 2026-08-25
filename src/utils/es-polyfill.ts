/**
 * ES2024/ES2025 API polyfill（pdfjs-dist v6+ 依赖）。
 * 旧 Electron / Android WebView / 嵌入式浏览器缺失这些 API 会导致
 * PDF 转换与预览直接失败（主线程与 worker 上下文各自需要注入）：
 * - Promise.withResolvers（ES2024）
 * - Promise.try（ES2025）
 * - Map.prototype.getOrInsertComputed（ES2025，pdfjs 渲染路径大量使用）
 */

// ---- Promise.withResolvers ----
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function') {
  (Promise as unknown as { withResolvers: <T>() => PolyfilledPromiseWithResolvers<T> }).withResolvers =
    function withResolvers<T>(): PolyfilledPromiseWithResolvers<T> {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
}

interface PolyfilledPromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

// ---- Promise.try（同步执行回调，异常转 rejection；保留 this 以兼容子类）----
if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: <T, A extends unknown[]>(this: PromiseConstructor, func: (...args: A) => T | PromiseLike<T>, ...args: A) => Promise<T> }).try =
    function try_<T, A extends unknown[]>(
      this: PromiseConstructor,
      func: (...args: A) => T | PromiseLike<T>,
      ...args: A
    ): Promise<T> {
      return new this<T>((resolve, reject) => {
        try {
          resolve(func(...args));
        } catch (err) {
          reject(err);
        }
      });
    };
}

// ---- Map.prototype.getOrInsertComputed ----
// 注意：不能用箭头函数（需要 this），且 has/get/set 的键比较已是 SameValueZero，与规范一致。
interface GetOrInsertComputed {
  getOrInsertComputed?: <K, V>(key: K, callbackfn: (key: K) => V) => V;
}

if (typeof (Map.prototype as GetOrInsertComputed).getOrInsertComputed !== 'function') {
  (Map.prototype as unknown as { getOrInsertComputed: <K, V>(key: K, callbackfn: (key: K) => V) => V }).getOrInsertComputed =
    function getOrInsertComputed<K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V): V {
      if (this.has(key)) return this.get(key) as V;
      const value = callbackfn(key);
      this.set(key, value);
      return value;
    };
}
