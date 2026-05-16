"use client";

/**
 * Teleprompter — 提詞器主畫面
 *
 * 設計：
 *   - 縱向捲動列表（max 全頁、overflow-y-auto）
 *   - 當前行透過 scrollIntoView({ block: 'center' }) 自動置中
 *   - 已過行淡灰、當前行白色高亮、未來行依 hintMode 控制顯示
 *
 * 點任一行 → 呼叫 onLineClick(localIndex)（由 page 接到 useRehearsal.gotoIndex）。
 *
 * 此元件本身為純展示，所有狀態由外部 useRehearsal 推進。
 */

import { useEffect, useMemo, useRef } from "react";
import { LineRow } from "./LineRow";
import {
  isStageDirection,
  type FlatLine,
  type HintMode,
  type RehearsalStatus,
} from "@/lib/types";

export type TeleprompterProps = {
  readonly lines: readonly FlatLine[];
  /** 在 lines 切片內的本地索引 */
  readonly currentIndex: number;
  readonly hintMode: HintMode;
  readonly actorCharacterKey: string;
  readonly status: RehearsalStatus;
  /** 角色簡稱 → 全名（用於渲染顯示） */
  readonly characters: ReadonlyArray<{ key: string; name: string }>;
  /** 點某行回呼（傳入本地索引） */
  readonly onLineClick: (localIndex: number) => void;
};

export function Teleprompter({
  lines,
  currentIndex,
  hintMode,
  actorCharacterKey,
  status,
  characters,
  onLineClick,
}: TeleprompterProps) {
  // 角色簡稱 → 全名 map
  const characterNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) m.set(c.key, c.name);
    return m;
  }, [characters]);

  // 當前行的 DOM ref（用於 scrollIntoView）
  const currentRef = useRef<HTMLDivElement | null>(null);

  // currentIndex 改變 → 平滑捲動到中央
  // 注意：status 為 idle / done 時也捲動，確保起點 / 終點視覺正確
  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex]);

  // hintMode 切換時不需要捲動，但可能改變行高，
  // 為了確保當前行仍置中，這裡也補一次。
  // 改為 smooth 避免突兀（行高變化下視覺更平順）。
  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hintMode]);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-16 pb-40 sm:pt-24">
      <ol className="space-y-1">
        {lines.map((line, idx) => {
          const isCurrent = idx === currentIndex;
          const isPast = idx < currentIndex;
          const isStage = isStageDirection(line);
          const isActor = !isStage && line.character === actorCharacterKey;
          // 已過 / 完成狀態下整段視為過去
          const effectivePast = isPast || (status === "done" && !isCurrent);

          const characterName = isStage
            ? null
            : (characterNameMap.get(line.character) ?? line.character);

          return (
            <li key={`${line.globalIndex}-${idx}`}>
              <div ref={isCurrent ? currentRef : null}>
                <LineRow
                  line={line}
                  isCurrent={isCurrent}
                  isPast={effectivePast}
                  isActorLine={isActor}
                  hintMode={hintMode}
                  characterName={characterName}
                  onClick={() => onLineClick(idx)}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
