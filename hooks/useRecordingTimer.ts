"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useRecordingTimer — 錄音計時 hook
 *
 * 在 `isRecording === true` 期間以 200ms 間隔回傳累計毫秒；
 * 結束或 unmount 自動清理 interval。
 *
 * 設計細節：
 *   - 起點時間以「進入 recording 那一刻」由 hook 內部建立，避免外部 race。
 *   - 200ms tick 與 v4 RecordClient 原行為一致（保留逐步流暢的 UX）。
 *   - 非 recording 期間回傳 0，並停掉 interval（不浪費 RAF/timer）。
 */
export function useRecordingTimer(isRecording: boolean): number {
  const [currentMs, setCurrentMs] = useState<number>(0);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording) {
      startedAtRef.current = 0;
      setCurrentMs(0);
      return;
    }
    if (typeof window === "undefined") return;

    startedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    setCurrentMs(0);

    const tick = (): void => {
      if (startedAtRef.current === 0) return;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      setCurrentMs(Math.max(0, Math.round(now - startedAtRef.current)));
    };

    const id = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(id);
    };
  }, [isRecording]);

  return currentMs;
}
