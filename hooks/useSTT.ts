"use client";

/**
 * useSTT — 將 STTService 包裝為 React hook
 *
 * 行為：
 *   - mount 時建立 STTService（不立即啟動辨識）
 *   - unmount / 重啟時 abort 任何進行中的辨識
 *   - 提供穩定參考的 startListening / stopListening（useCallback）
 *   - isListening：reactive 狀態（與 service 啟停同步）
 *   - isSupported：瀏覽器是否支援 SpeechRecognition
 *
 * SSR safe：service 在 useEffect 內建立。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { STTService, type STTConfig } from "@/lib/stt";

export type UseSTTReturn = {
  readonly isSupported: boolean;
  readonly isListening: boolean;
  /** 啟動辨識；target 為要比對的目標台詞 */
  readonly startListening: (target: string, config: STTConfig) => void;
  /** 停止辨識（不會觸發 onMatch；用 abort 而非 stop） */
  readonly stopListening: () => void;
};

/**
 * @param matchThreshold 比對門檻（0–1），預設 0.6 對應 SPEC §4.4
 */
export function useSTT(matchThreshold: number = 0.6): UseSTTReturn {
  const serviceRef = useRef<STTService | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // SSR 不建立；client 端建立一次
    if (typeof window === "undefined") return;
    const service = new STTService(matchThreshold);
    serviceRef.current = service;
    setIsSupported(service.isSupported());

    return () => {
      service.stopListening();
      serviceRef.current = null;
      setIsListening(false);
    };
  }, [matchThreshold]);

  const startListening = useCallback(
    (target: string, config: STTConfig): void => {
      const svc = serviceRef.current;
      if (!svc) {
        config.onError?.({
          error: "not-initialized",
          message: "STT 服務尚未就緒（可能在 SSR 環境）。",
        });
        return;
      }
      // 包裝 onError 與 onMatch 以同步 isListening
      svc.startListening(target, {
        ...config,
        onError: (err) => {
          // 一些錯誤會自動 end（no-speech）；保險起見更新狀態
          setIsListening(false);
          config.onError?.(err);
        },
      });
      // start 後立即同步狀態（service 內部 listening flag 在 start 成功後為 true）
      setIsListening(svc.isListening());
    },
    [],
  );

  const stopListening = useCallback((): void => {
    const svc = serviceRef.current;
    if (!svc) return;
    svc.stopListening();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening,
  };
}
