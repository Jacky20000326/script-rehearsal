import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// 在 ESM 環境下沒有 __dirname，改以 import.meta.url 解析本檔所在目錄
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js 設定（v3）
 *
 * 重點：
 *   - outputFileTracingRoot：明確指定工作根目錄，避免 Next.js 偵測到家目錄外的 lockfile 而誤判 root
 *
 * v3 移除：原為 Whisper / @xenova/transformers 設置的 serverExternalPackages 與
 *   webpack fallback；v3 改採「逐行真人錄音」，已完全擺脫 transformers.js 相依。
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
