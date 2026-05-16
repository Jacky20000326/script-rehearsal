"use client";

import { useEffect, useState } from "react";

/**
 * usePreviewUrl — 將 Blob 轉成 object URL 並自動釋放
 *
 * 規則：
 *   - blob 為 null 時回 null，不建立 URL。
 *   - blob 變動或 unmount 時 `URL.revokeObjectURL` 釋放，避免記憶體洩漏。
 *   - SSR 安全：`URL.createObjectURL` 僅在 useEffect 內呼叫。
 */
export function usePreviewUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    if (typeof window === "undefined") return;
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => {
      URL.revokeObjectURL(created);
    };
  }, [blob]);

  return url;
}
