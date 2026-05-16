"use client";

import { useEffect, useState } from "react";
import { getAllSegments } from "@/lib/audioStorage";
import type { AudioSegmentRecord, ScriptId } from "@/lib/types";

export type UseDoneSegmentsResult = {
  readonly doneIndices: ReadonlySet<number>;
  readonly setDoneIndices: React.Dispatch<
    React.SetStateAction<ReadonlySet<number>>
  >;
  readonly loading: boolean;
  readonly error: string | null;
};

/**
 * useDoneSegments — 載入「指定 script × character」已錄的 globalIndex 集合
 *
 * scriptId 為 null 時保留 loading，避免在 fallback 初始化期錯誤地顯示「全部未錄」。
 */
export function useDoneSegments(
  scriptId: ScriptId | null,
  characterKey: string,
): UseDoneSegmentsResult {
  const [doneIndices, setDoneIndices] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!scriptId) {
      setLoading(true);
      setDoneIndices(new Set<number>());
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const segments: AudioSegmentRecord[] = await getAllSegments(
          scriptId,
          characterKey,
        );
        if (cancelled) return;
        setDoneIndices(new Set(segments.map((s) => s.globalIndex)));
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "讀取已錄片段失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterKey, scriptId]);

  return { doneIndices, setDoneIndices, loading, error };
}
