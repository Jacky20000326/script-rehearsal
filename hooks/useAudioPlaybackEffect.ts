/**
 * useAudioPlaybackEffect — system_speaking 期間「對手台詞優先播音檔」副作用（v5 / M26）
 *
 * 由 useRehearsal 拆出，職責：
 *   1. 當 enabled 且 currentLine 為非 stage_direction 對手台詞 → 非同步抓 getSegment
 *   2. 命中 → audioPlayer.play()；onEnd → onComplete()，onError → onFallback()
 *   3. 未命中 / getSegment reject / getSegment 為 undefined → onFallback()
 *
 * 注意：本 effect 不負責 stage_direction（由 useTTSEffect 處理 1.5s timer）。
 *
 * 競態防護（三重）：
 *   - cancelled flag（cleanup 中設 true）
 *   - fetchGen（ref counter，舊世代結果丟棄）
 *   - currentIndexRef 比對（避免進階 / 暫停後仍命中舊 line）
 *
 * cleanup：cancelled=true + audioPlayer.stop()
 *
 * SSR safe：AudioPlayer / getSegment 內部各自處理；effect 啟動點本身無 window 直存取。
 */

import { useEffect, useRef } from "react";
import { isStageDirection, type AudioSegmentRecord, type FlatLine } from "@/lib/types";
import type { AudioPlayer } from "@/lib/audioPlayer";

export type GetSegmentFn = (
  characterKey: string,
  globalIndex: number,
) => Promise<AudioSegmentRecord | null>;

export type UseAudioPlaybackEffectOptions = {
  /** 是否啟動（通常 = status === 'system_speaking'） */
  readonly enabled: boolean;
  /** 當前行 */
  readonly currentLine: FlatLine | undefined;
  /** 當前本地索引（用於 race 防護） */
  readonly currentIndex: number;
  /** AudioPlayer 實例（ref 提供，避免 mount 期 null） */
  readonly audioPlayerRef: React.RefObject<AudioPlayer | null>;
  /** segment 查詢函式（呼叫端負責提供穩定 ref；本 hook 內部仍以 ref 解耦） */
  readonly getSegment: GetSegmentFn | undefined;
  /** 命中音檔且自然播完時觸發（推進） */
  readonly onComplete: () => void;
  /**
   * 音檔不可用時（無 getSegment / 無 segment / 抓取失敗 / 播放失敗）觸發。
   * 呼叫端應切換到 TTS 路徑。
   * 參數 globalIndex：本次 fallback 對應的行；呼叫端應比對 currentLine.globalIndex
   * 避免「上一行 fallback 旗標套到新行」的競態。
   */
  readonly onFallback: (globalIndex: number) => void;
  /** 開始播音檔時觸發（給主 hook 設 currentPlaybackSource='audio'） */
  readonly onAudioStart?: () => void;
};

export function useAudioPlaybackEffect(
  options: UseAudioPlaybackEffectOptions,
): void {
  const {
    enabled,
    currentLine,
    currentIndex,
    audioPlayerRef,
    getSegment,
    onComplete,
    onFallback,
    onAudioStart,
  } = options;

  // getSegment 包成 ref：避免外部 callback 識別碼變動造成 effect 重跑
  const getSegmentRef = useRef<GetSegmentFn | undefined>(getSegment);
  getSegmentRef.current = getSegment;

  // 世代計數：每次 effect setup 遞增；非同步 then 內比對才執行 callback
  const fetchGenRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    if (!currentLine) return;
    if (isStageDirection(currentLine)) return;

    let cancelled = false;
    const fetcher = getSegmentRef.current;
    const lineGlobalIndex = currentLine.globalIndex;

    if (!fetcher) {
      // 無 segment 來源 → 直接 fallback TTS
      onFallback(lineGlobalIndex);
      return;
    }

    const myGen = ++fetchGenRef.current;
    const myIndex = currentIndex;

    void fetcher(currentLine.character, lineGlobalIndex)
      .then((segment) => {
        if (cancelled) return;
        if (myGen !== fetchGenRef.current) return;
        if (myIndex !== currentIndex) return;

        if (segment) {
          onAudioStart?.();
          audioPlayerRef.current?.play(segment.blob, {
            onEnd: () => {
              if (cancelled) return;
              onComplete();
            },
            onError: () => {
              if (cancelled) return;
              // 音檔播放失敗 → fallback TTS（不直接推進）
              onFallback(lineGlobalIndex);
            },
          });
        } else {
          onFallback(lineGlobalIndex);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (myGen !== fetchGenRef.current) return;
        if (myIndex !== currentIndex) return;
        // 讀取 segment 失敗 → fallback TTS
        onFallback(lineGlobalIndex);
      });

    return () => {
      cancelled = true;
      audioPlayerRef.current?.stop();
    };
  }, [
    enabled,
    currentLine,
    currentIndex,
    audioPlayerRef,
    onComplete,
    onFallback,
    onAudioStart,
  ]);
}
