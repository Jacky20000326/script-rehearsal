"use client";

/**
 * 對練設定頁 — 原 app/page.tsx 搬移至 /setup（M29）。
 *
 * 一頁式（非多步精靈）。畫面由上而下：
 *   1. 標題
 *   2. 「上次練到」（若 PracticeState 存在且角色仍存在於當前劇本才顯示）
 *   3. 角色選擇（CharacterPicker）
 *   4. 範圍選擇（RangePicker）
 *   5. 提示模式（HintModePicker）
 *   6. 主 CTA「開始對練」
 *
 * 空狀態（M28 起）：當 IndexedDB scripts store 為空 → 只渲染標題 + 引導文案 +
 * 匯入劇本 CTA；不渲染 ScriptSwitcher / 上次練到 / 角色 / 範圍 / 提示模式 /
 * AudioManager / 開始對練。
 *
 * 狀態管理：
 *   - 設定 state（character / range / hintMode）：useState
 *   - 練習紀錄（lastCharacter / lastLineIndex）：useEffect 從 lib/storage 讀取
 *   - 劇本數量（scriptsCount）：mount + active id 變動時呼叫 listScripts() 重算
 *
 * 「開始對練」流程：
 *   1. 驗證 character 已選且 scriptId 存在 → 否則禁用按鈕
 *   2. 更新 PracticeState：lastCharacter、lastLineIndex（依 range 推算起始）
 *   3. 寫入 sessionStorage（SessionConfig）
 *   4. router.push('/rehearse')
 *
 * SSR 安全：
 *   - 'use client' 元件
 *   - PracticeState / scriptsCount 在 useEffect 內讀取
 *   - 首幀一律 loading
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioManager } from "@/components/setup/AudioManager";
import { CharacterPicker } from "@/components/setup/CharacterPicker";
import { HintModePicker } from "@/components/setup/HintModePicker";
import { RangePicker } from "@/components/setup/RangePicker";
import { ScriptSwitcher } from "@/components/setup/ScriptSwitcher";
import { useScript } from "@/hooks/useScript";
import { filterByRange, getCharacterList } from "@/lib/script";
import {
  listScripts,
  subscribeActiveScriptId,
} from "@/lib/scriptStorage";
import { loadPracticeState, savePracticeState } from "@/lib/storage";
import { saveSessionConfig } from "@/lib/sessionConfig";
import type {
  FlatLine,
  HintMode,
  PracticeState,
  Range,
} from "@/lib/types";

// ---------- 工具函式 ----------

/**
 * 由範圍與扁平資料推算「應該從第幾個 globalIndex 開始」。
 *
 * 規則：
 *   - all：第一行
 *   - page：該頁第一行
 *   - custom：min(startIndex, endIndex)，並夾在 [0, flat.length-1] 之間
 */
function resolveStartIndex(flat: readonly FlatLine[], range: Range): number {
  if (flat.length === 0) return 0;
  const lastIdx = flat.length - 1;
  switch (range.kind) {
    case "all":
      return 0;
    case "page": {
      const found = flat.find((l) => l.page === range.page);
      return found ? found.globalIndex : 0;
    }
    case "custom": {
      const lo = Math.min(range.startIndex, range.endIndex);
      return Math.max(0, Math.min(lo, lastIdx));
    }
  }
}

// ---------- 主元件 ----------

export default function SetupPage() {
  const router = useRouter();
  const { script, flat, loading, error, scriptId } = useScript();

  // 設定 state（受控於本頁）
  const [character, setCharacter] = useState<string | null>(null);
  const [range, setRange] = useState<Range>({ kind: "all" });
  const [hintMode, setHintMode] = useState<HintMode>("full");

  // 練習紀錄（localStorage）
  const [practice, setPractice] = useState<PracticeState | null>(null);

  // 劇本數量（IDB scripts store）；null 表示載入中
  const [scriptsCount, setScriptsCount] = useState<number | null>(null);

  // 掛載後讀取 localStorage（SSR safe）
  useEffect(() => {
    const loaded = loadPracticeState();
    if (loaded) setPractice(loaded);
  }, []);

  // 讀取 scripts store 數量；active id 變動時刷新
  // （刪除最後一份後 clearActiveScriptId → subscribeActiveScriptId 觸發 → 重算 → 切到空狀態）
  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      void (async () => {
        try {
          const list = await listScripts();
          if (cancelled) return;
          setScriptsCount(list.length);
        } catch {
          if (cancelled) return;
          setScriptsCount(0);
        }
      })();
    };
    refresh();
    const unsubscribe = subscribeActiveScriptId(() => {
      refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // 角色清單（依 script.characters 順序）
  const characters = useMemo(
    () => (script ? getCharacterList(script) : []),
    [script],
  );

  // 給「上次練到」區塊顯示用：解析行號 → 頁/行
  // 角色必須存在於當前 script.characters 才顯示，否則隱藏（避免切換劇本後顯示不存在的角色）
  const lastLineInfo = useMemo(() => {
    if (!practice || flat.length === 0 || !script) return null;
    if (!(practice.lastCharacter in script.characters)) return null;
    const idx = Math.max(
      0,
      Math.min(practice.lastLineIndex, flat.length - 1),
    );
    const line = flat[idx];
    if (!line) return null;
    const lastCharFull = script.characters[practice.lastCharacter];
    return {
      characterKey: practice.lastCharacter,
      characterName: lastCharFull ?? practice.lastCharacter,
      page: line.page,
      lineIndexInPage: line.lineIndexInPage,
      globalIndex: idx,
    };
  }, [practice, flat, script]);

  // ---------- 行為 ----------

  const handleStart = (): void => {
    if (!character || flat.length === 0 || scriptId === null) return;

    const startIndex = resolveStartIndex(flat, range);

    // 1. 更新並持久化 PracticeState（保留既有 count，無紀錄則用空 map）
    const next: PracticeState = {
      lastCharacter: character,
      lastLineIndex: startIndex,
      practiceCountByCharacter: practice?.practiceCountByCharacter ?? {},
    };
    setPractice(next);
    savePracticeState(next);

    // 2. 寫入 sessionStorage 帶到對練頁
    saveSessionConfig({ character, range, hintMode });

    // 3. 路由
    router.push("/rehearse");
  };

  const handleResume = (): void => {
    if (!practice || !lastLineInfo) return;
    const lastIdx = Math.max(flat.length - 1, 0);
    const resumeRange: Range = {
      kind: "custom",
      startIndex: lastLineInfo.globalIndex,
      endIndex: lastIdx,
    };

    // 同步表單 state，視覺上反映出「我們選了什麼」
    setCharacter(practice.lastCharacter);
    setRange(resumeRange);

    // 直接寫入 PracticeState（lastCharacter 已是該角色，不變）
    savePracticeState({
      ...practice,
      lastLineIndex: lastLineInfo.globalIndex,
    });

    saveSessionConfig({
      character: practice.lastCharacter,
      range: resumeRange,
      hintMode,
    });

    router.push("/rehearse");
  };

  // ---------- 載入態 / 錯誤態 ----------

  if (loading || scriptsCount === null) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-zinc-500">載入中…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-12">
          <h1 className="text-3xl">劇本對練平台</h1>
          <p className="text-red-400">
            載入劇本失敗：
            <span className="font-mono">{error.message}</span>
          </p>
          <p className="text-sm text-zinc-500">
            請稍後再試，或重新整理頁面。
          </p>
        </div>
      </main>
    );
  }

  // ---------- 空狀態（尚未匯入任何劇本）----------

  if (scriptsCount === 0) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl">
            劇本對練平台
          </h1>
          <p className="text-base text-zinc-400">
            尚未匯入任何劇本。請先匯入劇本以開始對練。
          </p>
          <button
            type="button"
            onClick={() => router.push("/scripts/import")}
            className="rounded-md bg-white px-6 py-3 text-base font-medium text-black transition hover:bg-zinc-200"
          >
            匯入劇本
          </button>
        </div>
      </main>
    );
  }

  // 有劇本但 active 失效或無 script（極少數情境）
  if (!script) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-12">
          <h1 className="text-3xl">劇本對練平台</h1>
          <p className="text-sm text-zinc-500">
            目前未選擇有效的劇本，請從下方選擇一份劇本。
          </p>
          <ScriptSwitcher />
        </div>
      </main>
    );
  }

  // ---------- 主畫面 ----------

  const canStart =
    character !== null && flat.length > 0 && scriptId !== null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-12 px-6 py-12">
        {/* 標題 */}
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl">
            劇本對練平台
          </h1>
          <p className="text-sm text-zinc-500">
            選擇你的角色、練習範圍與提示模式，準備開始讀本。
          </p>
        </header>

        {/* 劇本切換（M18） + 匯入入口（M19） */}
        <div className="space-y-3">
          <ScriptSwitcher />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/scripts/import")}
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-900"
            >
              匯入新劇本（文字 / PDF / 圖片）…
            </button>
          </div>
        </div>

        {/* 上次練到 */}
        {lastLineInfo && (
          <section
            aria-label="上次練習進度"
            className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-5"
          >
            <h2 className="text-sm uppercase tracking-widest text-zinc-500">
              上次練到
            </h2>
            <p className="text-xl">
              <span className="text-white">{lastLineInfo.characterName}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-zinc-300">
                第 {lastLineInfo.page} 頁　第{" "}
                {lastLineInfo.lineIndexInPage + 1} 行
              </span>
            </p>
            <button
              type="button"
              onClick={handleResume}
              className="rounded-md border border-zinc-600 bg-transparent px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
            >
              繼續上次
            </button>
          </section>
        )}

        {/* 角色 */}
        <section aria-labelledby="section-character" className="space-y-4">
          <h2
            id="section-character"
            className="text-sm uppercase tracking-widest text-zinc-500"
          >
            選擇角色
          </h2>
          <CharacterPicker
            characters={characters}
            selected={character}
            onSelect={setCharacter}
          />
        </section>

        {/* 範圍 */}
        <section aria-labelledby="section-range" className="space-y-4">
          <h2
            id="section-range"
            className="text-sm uppercase tracking-widest text-zinc-500"
          >
            練習範圍
          </h2>
          <RangePicker flat={flat} value={range} onChange={setRange} />
          {/* 範圍預覽 */}
          <RangeSummary flat={flat} range={range} />
        </section>

        {/* 提示模式 */}
        <section aria-labelledby="section-hint" className="space-y-4">
          <h2
            id="section-hint"
            className="text-sm uppercase tracking-widest text-zinc-500"
          >
            提示模式
          </h2>
          <HintModePicker value={hintMode} onChange={setHintMode} />
        </section>

        {/* 音檔管理（v2 新增；預設摺疊，不影響 v1.0 視覺乾淨） */}
        {scriptId !== null && characters.length > 0 && (
          <section aria-labelledby="section-audio" className="space-y-4">
            <h2 id="section-audio" className="sr-only">
              音檔管理
            </h2>
            <AudioManager
              characters={characters}
              script={script}
              scriptId={scriptId}
            />
          </section>
        )}

        {/* CTA */}
        <section className="flex flex-col items-center pt-4">
          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className={
              canStart
                ? "rounded-md bg-white px-12 py-4 text-2xl text-black transition hover:bg-zinc-200"
                : "cursor-not-allowed rounded-md bg-zinc-800 px-12 py-4 text-2xl text-zinc-500"
            }
          >
            開始對練
          </button>
          {!canStart && (
            <p className="mt-3 text-sm text-zinc-500">請先選擇角色再開始。</p>
          )}
        </section>
      </div>
    </main>
  );
}

// ---------- 子元件：範圍摘要 ----------

function RangeSummary({
  flat,
  range,
}: {
  flat: readonly FlatLine[];
  range: Range;
}) {
  const selected = useMemo(
    () => filterByRange(flat, range),
    [flat, range],
  );
  return (
    <p className="text-sm text-zinc-500">
      本次將練習 <span className="font-mono text-zinc-300">{selected.length}</span> 行。
    </p>
  );
}
