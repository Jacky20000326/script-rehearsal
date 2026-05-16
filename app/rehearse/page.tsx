"use client";

/**
 * 對練畫面（M5 提詞器版）
 *
 * 職責：
 *   1. 從 sessionStorage 讀取 SessionConfig，並以 filterByRange 切片
 *   2. clampRange 防呆：自訂範圍越界時顯示「範圍無效」
 *   3. 整合 useRehearsal hook 跑完整流程
 *   4. 提詞器風格 UI：
 *      - 極簡 header（角色 + 範圍摘要 + 返回設定）
 *      - 中間 <Teleprompter />
 *      - 底部 <StatusBar />
 *      - done 狀態 overlay：練習完成 + 再練一次 / 換角色
 *   5. 全域鍵盤事件：空白 / ← / R / Esc / 1 / 2 / 3
 *
 * 視覺：黑底白字，無裝飾性 border / shadow / gradient。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useScript } from "@/hooks/useScript";
import { useRehearsal } from "@/hooks/useRehearsal";
import { Teleprompter } from "@/components/rehearse/Teleprompter";
import { StatusBar } from "@/components/rehearse/StatusBar";
import { filterByRange, getCharacterList } from "@/lib/script";
import {
  loadSessionConfig,
  type SessionConfig,
} from "@/lib/sessionConfig";
import { getAudioSegment } from "@/lib/audioStorage";
import type { FlatLine, Range } from "@/lib/types";

// ---------- 顯示輔助 ----------

function formatRange(range: Range): string {
  switch (range.kind) {
    case "all":
      return "全劇";
    case "page":
      return `第 ${range.page} 頁`;
    case "custom":
      return `自訂 ${range.startIndex}–${range.endIndex}`;
  }
}

/**
 * 將自訂範圍 clamp 到 flat 邊界內。
 * 若整段都在合法範圍外回 null（表示「範圍無效」）。
 */
function clampRange(flat: readonly FlatLine[], range: Range): Range | null {
  if (flat.length === 0) return null;
  if (range.kind !== "custom") return range;
  const minIdx = 0;
  const maxIdx = flat.length - 1;
  const lo = Math.min(range.startIndex, range.endIndex);
  const hi = Math.max(range.startIndex, range.endIndex);
  if (hi < minIdx || lo > maxIdx) return null;
  const clampedLo = Math.max(minIdx, lo);
  const clampedHi = Math.min(maxIdx, hi);
  if (clampedLo > clampedHi) return null;
  return { kind: "custom", startIndex: clampedLo, endIndex: clampedHi };
}

// ---------- 主頁 ----------

export default function RehearsePage() {
  const router = useRouter();
  const { script, flat, loading, error, scriptId } = useScript();

  // 三態：undefined（SSR / 未掛載）/ null（無設定）/ SessionConfig
  const [config, setConfig] = useState<SessionConfig | null | undefined>(
    undefined,
  );

  useEffect(() => {
    setConfig(loadSessionConfig());
  }, []);

  const characters = useMemo(
    () => (script ? getCharacterList(script) : []),
    [script],
  );

  const clampedRange = useMemo(() => {
    if (!config) return null;
    return clampRange(flat, config.range);
  }, [config, flat]);

  const sliceLines = useMemo<FlatLine[]>(() => {
    if (!config || !clampedRange) return [];
    return filterByRange(flat, clampedRange);
  }, [config, flat, clampedRange]);

  // ---------- 載入態 ----------

  if (config === undefined || loading) {
    return (
      <PageShell>
        <p className="text-zinc-500">載入中…</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <h1 className="text-3xl">載入劇本失敗</h1>
        <p className="text-red-400">
          <span className="font-mono">{error.message}</span>
        </p>
        <BackToSetup />
      </PageShell>
    );
  }

  if (config === null) {
    return (
      <PageShell>
        <h1 className="text-3xl">尚未設定對練</h1>
        <p className="text-zinc-400">
          找不到本次 session 的設定，請回到首頁完成設定。
        </p>
        <BackToSetup />
      </PageShell>
    );
  }

  if (sliceLines.length === 0 || clampedRange === null) {
    return (
      <PageShell>
        <h1 className="text-3xl">練習範圍無效</h1>
        <p className="text-zinc-400">
          本次設定的範圍在當前劇本中沒有任何台詞。請回到設定頁調整。
        </p>
        <p className="text-sm text-zinc-500">
          原始範圍：
          <span className="font-mono">{formatRange(config.range)}</span>
        </p>
        <BackToSetup />
      </PageShell>
    );
  }

  return (
    <RehearseInner
      sliceLines={sliceLines}
      config={config}
      characters={characters}
      characterFullName={
        script?.characters[config.character] ?? config.character
      }
      scriptId={scriptId}
      onBackToSetup={() => router.push("/setup")}
    />
  );
}

// ---------- 內層 ----------

function RehearseInner({
  sliceLines,
  config,
  characters,
  characterFullName,
  scriptId,
  onBackToSetup,
}: {
  sliceLines: FlatLine[];
  config: SessionConfig;
  characters: ReadonlyArray<{ key: string; name: string }>;
  characterFullName: string;
  scriptId: string | null;
  onBackToSetup: () => void;
}) {
  // v4 / M22：對手台詞查詢改帶 active scriptId，多劇本不串音；
  // 命中則播真人錄音，否則 fallback TTS。scriptId 為 null 時略過查詢直走 TTS。
  const getSegment = useCallback(
    (k: string, i: number) => {
      if (!scriptId) return Promise.resolve(null);
      return getAudioSegment(scriptId, k, i);
    },
    [scriptId],
  );

  const r = useRehearsal({
    lines: sliceLines,
    config,
    characters,
    getSegment,
  });

  // 解構出穩定 callback 與 primitive，避免 effect 依賴整個 r 物件
  // （r 物件每 render 都會重建，會讓 keyboard effect 反覆 cleanup+setup）
  const {
    forceAdvance,
    goBack,
    repeat,
    pause,
    resume,
    dispatch,
    gotoIndex,
  } = r;
  const status = r.state.status;

  // ---------- 鍵盤快捷鍵 ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        forceAdvance();
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        repeat();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        if (status === "paused") resume();
        else pause();
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        dispatch({ type: "SET_HINT_MODE", mode: "full" });
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        dispatch({ type: "SET_HINT_MODE", mode: "first5" });
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        dispatch({ type: "SET_HINT_MODE", mode: "hidden" });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forceAdvance, goBack, repeat, pause, resume, dispatch, status]);

  // ---------- 點任一行跳轉 ----------

  // 注意：LineRow 內 onClick 仍是 inline `() => onLineClick(idx)`，
  // 對 memoized LineRow 而言 inline callback 確實會破壞 memo；
  // 但此專案規模小（最多 ~80 行），不追求極致 memo。
  const handleLineClick = useCallback(
    (idx: number) => gotoIndex(idx),
    [gotoIndex],
  );

  // ---------- done overlay 控制 ----------

  // done 立即顯示 overlay。提供「再練一次 / 換角色」
  const isDone = status === "done";

  const handleRestart = useCallback(() => {
    // 從 done 觸發「再練一次」：
    // - GOTO 會把 currentIndex 設為 0 並依該行重新推出 status
    //   （system_speaking / waiting_actor），不需要再呼叫 start()。
    // - useRehearsal 的 done effect 會以 doneCountedRef 守衛、不會重複 +1。
    gotoIndex(0);
  }, [gotoIndex]);

  // ---------- UI ----------

  return (
    <main className="min-h-screen bg-black text-white">
      {/* 極簡 header */}
      <header className="fixed top-0 left-0 right-0 z-30 border-b border-zinc-900 bg-black/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0 truncate text-sm text-zinc-300">
            <span className="text-white">{characterFullName}</span>
            <span className="mx-2 text-zinc-700">｜</span>
            <span className="text-zinc-500">{formatRange(config.range)}</span>
            <span className="mx-2 text-zinc-700">｜</span>
            <span className="text-zinc-500">
              {Math.min(r.state.currentIndex, sliceLines.length - 1) + 1} /{" "}
              {sliceLines.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToSetup}
            className="whitespace-nowrap rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
          >
            返回設定
          </button>
        </div>
      </header>

      {/* 提詞器主畫面 */}
      <Teleprompter
        lines={sliceLines}
        currentIndex={r.state.currentIndex}
        hintMode={r.state.hintMode}
        actorCharacterKey={r.state.actorCharacterKey}
        status={r.state.status}
        characters={characters}
        onLineClick={handleLineClick}
      />

      {/* 底部狀態列 */}
      <StatusBar
        status={r.state.status}
        hintMode={r.state.hintMode}
        isActorTurn={r.isActorTurn}
        lastInterim={r.state.lastInterim}
        matchScore={r.state.lastMatchScore}
        sttSupported={r.sttSupported}
        voicesReady={r.ttsReady}
        ttsUnsupported={r.ttsUnsupported}
        currentPlaybackSource={r.currentPlaybackSource}
      />

      {/* done overlay */}
      {isDone && (
        <DoneOverlay
          onRestart={handleRestart}
          onBackToSetup={onBackToSetup}
        />
      )}
    </main>
  );
}

// ---------- 小元件 ----------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">{children}</div>
    </main>
  );
}

function BackToSetup() {
  return (
    <Link
      href="/setup"
      className="inline-block rounded border border-zinc-700 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
    >
      返回設定
    </Link>
  );
}

function DoneOverlay({
  onRestart,
  onBackToSetup,
}: {
  onRestart: () => void;
  onBackToSetup: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="mx-6 max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          完成
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-wide text-white">
          練習完成
        </h2>
        <p className="mt-3 text-sm text-zinc-400">已記錄 +1 練習次數</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 sm:w-auto"
          >
            再練一次
          </button>
          <button
            type="button"
            onClick={onBackToSetup}
            className="w-full rounded border border-zinc-700 px-6 py-2.5 text-sm text-zinc-100 transition hover:bg-zinc-900 sm:w-auto"
          >
            換角色 / 換範圍
          </button>
        </div>
      </div>
    </div>
  );
}
