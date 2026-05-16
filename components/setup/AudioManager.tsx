"use client";

/**
 * AudioManager — 設定頁的「角色錄音」區塊（v3 / M14）
 *
 * v3 改採「逐行真人錄音」流程：使用者點該角色的按鈕進入 /record/[characterKey]
 * 完成錄製。本元件只負責呈現「每個角色目前錄了幾行 / 全部 N 行」與提供
 * 開始 / 繼續 / 重新 / 刪除全部 等入口。
 *
 * 徽章 4 態：
 *   - recorded = 0                       → 「未開始」（灰）
 *   - 0 < recorded < total               → 「已錄 N/M 行」（藍） + 繼續錄製 / 刪除全部
 *   - recorded = total                   → 「已錄 M/M 行」（綠） + 重新錄製 / 刪除全部
 *   - scriptChanged = true               → 「已錄 N/M 行（劇本變更）」（橘）
 *
 * `scriptChanged` 由 `useAudioSegments` 比對該角色首段 `scriptHash` 與目前 script hash 取得；
 * true 時顯示橘色徽章，提示使用者該角色的既有錄音對應的劇本內容已變動，建議重錄。
 */

import Link from "next/link";
import { useMemo, type ReactElement } from "react";
import { useAudioSegments } from "@/hooks/useAudioSegments";
import type { Script } from "@/lib/types";

export type CharacterRef = {
  readonly key: string;
  readonly name: string;
};

export type AudioManagerProps = {
  readonly characters: readonly CharacterRef[];
  /** 當前劇本；為 null 時尚未載入完成，顯示 loading 文案 */
  readonly script: Script | null;
  /** 當前 active scriptId；為 null 時等同尚未載入（顯示 loading） */
  readonly scriptId: string | null;
};

// ---------- 徽章顯示 ----------

type BadgeKind = "not_started" | "in_progress" | "done" | "script_changed";

function getBadgeKind(
  recorded: number,
  total: number,
  scriptChanged: boolean,
): BadgeKind {
  if (scriptChanged) return "script_changed";
  if (recorded <= 0) return "not_started";
  if (recorded >= total) return "done";
  return "in_progress";
}

function badgeClassFor(kind: BadgeKind): string {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs tracking-wide whitespace-nowrap";
  switch (kind) {
    case "not_started":
      return `${base} border border-zinc-700 bg-transparent text-zinc-400`;
    case "in_progress":
      return `${base} border border-blue-700/60 bg-blue-950/40 text-blue-300`;
    case "done":
      return `${base} border border-emerald-700/60 bg-emerald-950/40 text-emerald-300`;
    case "script_changed":
      return `${base} border border-amber-700/60 bg-amber-950/40 text-amber-300`;
  }
}

function badgeText(
  kind: BadgeKind,
  recorded: number,
  total: number,
): string {
  switch (kind) {
    case "not_started":
      return "未開始";
    case "in_progress":
      return `已錄 ${recorded}/${total} 行`;
    case "done":
      return `已錄 ${total}/${total} 行`;
    case "script_changed":
      return `已錄 ${recorded}/${total} 行（劇本變更）`;
  }
}

// ---------- 主元件 ----------

export function AudioManager({
  characters,
  script,
  scriptId,
}: AudioManagerProps): ReactElement {
  const characterRefs = useMemo(
    () => characters.map((c) => ({ key: c.key })),
    [characters],
  );

  const { progress, loading, removeAll } = useAudioSegments(
    scriptId,
    characterRefs,
    script,
  );

  return (
    <section
      aria-labelledby="audio-manager-title"
      className="rounded-md border border-zinc-800 bg-zinc-950"
    >
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <h3
          id="audio-manager-title"
          className="text-base text-zinc-200"
        >
          角色錄音
        </h3>
        <p className="text-xs text-zinc-500">
          逐行錄製真人聲音，對練時將以你的錄音播放對手台詞。
        </p>
      </header>

      <ul className="divide-y divide-zinc-900">
        {characters.map((c) => {
          const p = progress[c.key] ?? {
            recorded: 0,
            total: 0,
            scriptChanged: false,
          };
          return (
            <li key={c.key} className="px-5 py-4">
              <CharacterRow
                characterKey={c.key}
                characterName={c.name}
                recorded={p.recorded}
                total={p.total}
                scriptChanged={p.scriptChanged}
                loading={loading || !script}
                onDeleteAll={() => {
                  const ok = window.confirm(
                    `確定刪除 ${c.name} 的所有錄音？此動作無法復原`,
                  );
                  if (!ok) return;
                  void removeAll(c.key);
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- 單一角色列 ----------

type CharacterRowProps = {
  readonly characterKey: string;
  readonly characterName: string;
  readonly recorded: number;
  readonly total: number;
  readonly scriptChanged: boolean;
  readonly loading: boolean;
  readonly onDeleteAll: () => void;
};

function CharacterRow({
  characterKey,
  characterName,
  recorded,
  total,
  scriptChanged,
  loading,
  onDeleteAll,
}: CharacterRowProps): ReactElement {
  const kind = getBadgeKind(recorded, total, scriptChanged);
  const href = `/record/${encodeURIComponent(characterKey)}`;

  const primaryLabel =
    kind === "not_started"
      ? "開始錄製"
      : kind === "done"
        ? "重新錄製"
        : "繼續錄製";

  // 該角色在劇本中沒有任何台詞 → 不顯示按鈕，只顯示提示文字
  const hasLines = total > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-lg text-white">{characterName}</span>
        <span className="text-xs text-zinc-600">{characterKey}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {loading ? (
          <span className="text-xs text-zinc-500">載入中…</span>
        ) : !hasLines ? (
          <span className="text-xs text-zinc-500">此角色無台詞</span>
        ) : (
          <>
            <span
              role="status"
              aria-live="polite"
              className={badgeClassFor(kind)}
            >
              {badgeText(kind, recorded, total)}
            </span>

            <Link
              href={href}
              className="rounded-md border border-zinc-600 bg-transparent px-3 py-1.5 text-sm text-zinc-100 transition hover:bg-zinc-900"
            >
              {primaryLabel}
            </Link>

            {recorded > 0 && (
              <button
                type="button"
                onClick={onDeleteAll}
                className="rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm text-zinc-400 transition hover:border-red-700 hover:text-red-300"
              >
                刪除全部
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
