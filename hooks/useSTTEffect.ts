/**
 * useSTTEffect — waiting_actor 期間的 STT 副作用（v5 / M26）
 *
 * 由 useRehearsal 拆出，職責：
 *   1. 當 enabled（status === 'waiting_actor'）且 currentLine 存在 → 啟動 STT
 *   2. interim 文字 → onInterim?(text)
 *   3. 達門檻 match → onMatch(text, score)（呼叫端負責 dispatch ACTOR_LINE_DONE）
 *
 * cleanup：deps 變動 / unmount → stopListening + cancelled=true
 *
 * SSR safe：useSTT 內部在 SSR 下 isSupported=false，本 effect 直接 return。
 */

import { useEffect } from "react";
import type { FlatLine } from "@/lib/types";
import type { STTConfig } from "@/lib/stt";

export type UseSTTEffectOptions = {
  /** 是否啟動 STT（通常 = status === 'waiting_actor'） */
  readonly enabled: boolean;
  /** 當前行（target 為 currentLine.text） */
  readonly currentLine: FlatLine | undefined;
  /** 瀏覽器是否支援 STT（從 useSTT 取得） */
  readonly sttSupported: boolean;
  /** STT 啟動（從 useSTT 取得；穩定 useCallback） */
  readonly sttStartListening: (target: string, config: STTConfig) => void;
  /** STT 停止（從 useSTT 取得；穩定 useCallback） */
  readonly sttStopListening: () => void;
  /** match 到門檻時觸發 */
  readonly onMatch: (text: string, score: number) => void;
  /** interim 文字更新（不推進） */
  readonly onInterim?: (text: string) => void;
};

export function useSTTEffect(options: UseSTTEffectOptions): void {
  const {
    enabled,
    currentLine,
    sttSupported,
    sttStartListening,
    sttStopListening,
    onMatch,
    onInterim,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!currentLine) return;
    if (!sttSupported) return;

    let cancelled = false;

    sttStartListening(currentLine.text, {
      onInterim: (text) => {
        if (cancelled) return;
        onInterim?.(text);
      },
      onMatch: (text, score) => {
        if (cancelled) return;
        onMatch(text, score);
      },
      onError: () => {
        // 'no-speech' 等是常見情況；不做事，使用者可按空白鍵備援
      },
    });

    return () => {
      cancelled = true;
      sttStopListening();
    };
  }, [
    enabled,
    currentLine,
    sttSupported,
    sttStartListening,
    sttStopListening,
    onMatch,
    onInterim,
  ]);
}
