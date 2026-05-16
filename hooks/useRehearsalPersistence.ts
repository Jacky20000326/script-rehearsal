/**
 * useRehearsalPersistence — 對練進度持久化副作用（v5 / M26）
 *
 * 由 useRehearsal 拆出，職責：
 *   1. 節流寫入 lastLineIndex 到 localStorage（每 5 行）
 *   2. 進入 done 時補寫進度 + incrementPracticeCount（一次）
 *   3. unmount 時補寫一次（避免最近 4 行內離開遺漏）
 *
 * 設計：
 *   - 用 ref 持有「上次寫入索引」與「done 已計數」旗標，避免造成 effect 重跑
 *   - currentIndex 變更時節流寫；done 由獨立 effect 強制寫 + count +1
 *   - lines.length === 0 時所有 IO 略過
 *
 * SSR safe：storage 層內部處理 typeof window === 'undefined'。
 */

import { useEffect, useRef } from "react";
import {
  incrementPracticeCount,
  loadPracticeState,
  savePracticeState,
} from "@/lib/storage";
import type { FlatLine, PracticeState, RehearsalStatus } from "@/lib/types";

/** 每幾行寫一次 PracticeState.lastLineIndex */
const PERSIST_EVERY_N_LINES = 5;

export type UseRehearsalPersistenceOptions = {
  readonly status: RehearsalStatus;
  readonly currentIndex: number;
  readonly lines: readonly FlatLine[];
  readonly characterKey: string;
};

export function useRehearsalPersistence(
  options: UseRehearsalPersistenceOptions,
): void {
  const { status, currentIndex, lines, characterKey } = options;

  // 寫入「上次持久化的本地索引」，避免每行 IO（節流）
  const lastPersistedLocalIndexRef = useRef<number>(-1);

  // 把最新值放 ref 給 unmount cleanup 用（避免 cleanup closure 抓到舊值）
  const linesRef = useRef<readonly FlatLine[]>(lines);
  linesRef.current = lines;
  const currentIndexRef = useRef<number>(currentIndex);
  currentIndexRef.current = currentIndex;
  const characterKeyRef = useRef<string>(characterKey);
  characterKeyRef.current = characterKey;

  // ---------- 節流寫入 lastLineIndex ----------

  useEffect(() => {
    if (lines.length === 0) return;
    if (status === "done") return; // done 由下面 effect 強制寫
    if (status === "idle") return;

    const clamped = Math.min(Math.max(0, currentIndex), lines.length - 1);
    if (
      Math.abs(clamped - lastPersistedLocalIndexRef.current) <
      PERSIST_EVERY_N_LINES
    ) {
      return;
    }
    lastPersistedLocalIndexRef.current = clamped;

    const line = lines[clamped];
    if (!line) return;
    const prev = loadPracticeState();
    const next: PracticeState = {
      lastCharacter: characterKey,
      lastLineIndex: line.globalIndex,
      practiceCountByCharacter: prev?.practiceCountByCharacter ?? {},
    };
    savePracticeState(next);
  }, [currentIndex, status, lines, characterKey]);

  // ---------- 進入 done：補寫 + incrementPracticeCount（一次） ----------

  const doneCountedRef = useRef<boolean>(false);
  useEffect(() => {
    if (status !== "done") {
      doneCountedRef.current = false;
      return;
    }
    if (doneCountedRef.current) return;
    doneCountedRef.current = true;

    if (lines.length === 0) return;

    // 補寫進度（落在最後一行）
    const lastIdx = lines.length - 1;
    const lastLine = lines[lastIdx];
    lastPersistedLocalIndexRef.current = lastIdx;

    const prev = loadPracticeState();
    const base: PracticeState = prev ?? {
      lastCharacter: characterKey,
      lastLineIndex: lastLine?.globalIndex ?? 0,
      practiceCountByCharacter: {},
    };
    const incremented = incrementPracticeCount(base, characterKey);
    savePracticeState({
      ...incremented,
      lastCharacter: characterKey,
      lastLineIndex: lastLine?.globalIndex ?? base.lastLineIndex,
    });
  }, [status, lines, characterKey]);

  // ---------- unmount 補寫一次 ----------

  useEffect(() => {
    return () => {
      const ls = linesRef.current;
      if (ls.length === 0) return;
      const idx = currentIndexRef.current;
      const clamped = Math.min(Math.max(0, idx), ls.length - 1);
      const line = ls[clamped];
      if (!line) return;
      const prev = loadPracticeState();
      savePracticeState({
        lastCharacter: characterKeyRef.current,
        lastLineIndex: line.globalIndex,
        practiceCountByCharacter: prev?.practiceCountByCharacter ?? {},
      });
    };
  }, []);
}
