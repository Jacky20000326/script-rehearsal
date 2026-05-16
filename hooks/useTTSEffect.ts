/**
 * useTTSEffect — system_speaking 期間的 TTS / stage_direction 副作用（v5 / M26）
 *
 * 由 useRehearsal 拆出，職責：
 *   1. 當 enabled 且 currentLine 為 stage_direction → 啟動 1.5 秒 setTimeout，
 *      到時呼叫 onComplete()
 *   2. 當 enabled 且 fallbackOnly 為 true（音檔已決定退回 TTS）→ 呼叫 ttsSpeak
 *
 * 注意：音檔路徑（命中真人錄音）由 useAudioPlaybackEffect 直接控制 audioPlayer.play，
 *      不經此 hook；本 hook 僅處理「stage_direction timer」與「音檔不可用時的 TTS」。
 *
 * cleanup：unmount / deps 變動時 cancelled=true，setTimeout 清掉、tts.cancel 由主 hook
 * 集中處理（避免兩個 effect 都呼叫 cancel 造成競態）。
 *
 * SSR safe：setTimeout 雖然 Node 也有，但 onEnd / onError 內 dispatch 在 client 才會發生；
 *           ttsSpeak 內部已 SSR-safe（見 hooks/useTTS）。
 */

import { useEffect } from "react";
import { isStageDirection, type FlatLine } from "@/lib/types";
import type { TTSConfig } from "@/lib/tts";

/** stage_direction 在不朗讀情況下的停留時間（毫秒） */
const STAGE_DIRECTION_DURATION_MS = 1500;

export type UseTTSEffectOptions = {
  /** 是否啟動本 effect（通常 = status === 'system_speaking'） */
  readonly enabled: boolean;
  /** 當前行（含 character / text / stage_direction 標籤） */
  readonly currentLine: FlatLine | undefined;
  /**
   * 是否「強制走 TTS」：
   *   - true：呼叫 ttsSpeak（用於 audio fallback 或無 getSegment 模式）
   *   - false：略過 TTS（由 useAudioPlaybackEffect 嘗試播音檔；命中後不會呼叫本路徑）
   *
   * stage_direction 一律走本 hook 的 timer 路徑，與本旗標無關。
   */
  readonly ttsOnly: boolean;
  /** TTS speak（由主 hook 從 useTTS 取得；穩定 useCallback） */
  readonly ttsSpeak: (config: TTSConfig) => void;
  /** TTS cancel（cleanup 時呼叫，確保跳行不殘留上一句聲音） */
  readonly ttsCancel: () => void;
  /** 一行完成（自然 onEnd / 1.5s timer / error fallback）時推進 */
  readonly onComplete: () => void;
  /**
   * 開始走 TTS 路徑時觸發（給主 hook 設 currentPlaybackSource='tts'）。
   * stage_direction / 未啟動時不會被呼叫。
   */
  readonly onTtsStart?: () => void;
};

export function useTTSEffect(options: UseTTSEffectOptions): void {
  const {
    enabled,
    currentLine,
    ttsOnly,
    ttsSpeak,
    ttsCancel,
    onComplete,
    onTtsStart,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    if (!currentLine) return;

    let cancelled = false;

    if (isStageDirection(currentLine)) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        onComplete();
      }, STAGE_DIRECTION_DURATION_MS);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    if (!ttsOnly) return;

    onTtsStart?.();
    ttsSpeak({
      text: currentLine.text,
      characterKey: currentLine.character,
      onEnd: () => {
        if (cancelled) return;
        onComplete();
      },
      onError: () => {
        if (cancelled) return;
        // 保險推進，避免卡死
        onComplete();
      },
    });

    return () => {
      cancelled = true;
      ttsCancel();
    };
    // 各 callback 由呼叫端以 useCallback 維持穩定
  }, [
    enabled,
    currentLine,
    ttsOnly,
    ttsSpeak,
    ttsCancel,
    onComplete,
    onTtsStart,
  ]);
}
