/**
 * recordingFlow — 錄音流程的純函式工具
 *
 * 與 React 解耦，可單元測試。處理：
 *   - 將 recorder 產出的 blob 組裝成 AudioSegmentRecord
 *   - 計算「下一個游標位置」（首/末行邊界回 null）
 */

import type { AudioSegmentRecord, Line } from "./types";

export type BuildSegmentArgs = {
  readonly scriptId: string;
  readonly characterKey: string;
  readonly globalIndex: number;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly durationMs: number;
  readonly scriptHash: string;
};

/**
 * 組裝 AudioSegmentRecord。
 *   - sizeBytes 取自 blob.size
 *   - recordedAt 取自 Date.now()
 */
export function buildSegmentRecord(args: BuildSegmentArgs): AudioSegmentRecord {
  return {
    scriptId: args.scriptId,
    characterKey: args.characterKey,
    globalIndex: args.globalIndex,
    blob: args.blob,
    mimeType: args.mimeType,
    durationMs: args.durationMs,
    sizeBytes: args.blob.size,
    recordedAt: Date.now(),
    scriptHash: args.scriptHash,
  };
}

/**
 * 計算下一行 cursor。
 *   - direction='next'：currentIdx === lines.length-1 → null
 *   - direction='prev'：currentIdx === 0 → null
 *   - 其餘回 currentIdx ± 1
 *   - lines 為空時恆回 null
 */
export function computeNextCursor(
  lines: readonly Line[],
  currentIdx: number,
  direction: "next" | "prev",
): number | null {
  if (lines.length === 0) return null;
  if (direction === "next") {
    if (currentIdx >= lines.length - 1) return null;
    return currentIdx + 1;
  }
  if (currentIdx <= 0) return null;
  return currentIdx - 1;
}
