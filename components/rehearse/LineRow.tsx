"use client";

/**
 * LineRow — 提詞器單行渲染
 *
 * 三種視覺位置：past / current / future
 * 兩種型別：對白行（含角色標籤）/ 舞台指示（斜體置中、無角色標籤）
 *
 * 對白行的「未來行」會依 hintMode 控制顯示：
 *   - full   完整文字
 *   - first5 前 5 字 + 「…」
 *   - hidden 「_____」（5 個底線）
 *
 * 非玩家行（不論在哪個位置）永遠完整顯示，
 * 因為演員需要知道對手會說什麼。
 *
 * 點擊整行 → 呼叫 onClick（由 Teleprompter 轉換成 gotoIndex）。
 */

import { memo } from "react";
import { isStageDirection, type FlatLine, type HintMode } from "@/lib/types";

export type LineRowProps = {
  readonly line: FlatLine;
  readonly isCurrent: boolean;
  readonly isPast: boolean;
  /** 此行是否屬於玩家所扮演角色（用於決定是否套用 hint 遮蔽） */
  readonly isActorLine: boolean;
  readonly hintMode: HintMode;
  /**
   * 角色全名；舞台指示傳 null。
   * 若找不到全名可退而求其次傳簡稱。
   */
  readonly characterName: string | null;
  readonly onClick: () => void;
};

/**
 * 根據 hint 模式與「是否玩家行」決定顯示文字。
 *
 * 規則：
 *   - 非玩家行 → 永遠顯示完整文字
 *   - 玩家行 + full → 完整文字
 *   - 玩家行 + first5 → 前 5 字 + 「…」（不足 5 字直接全顯示）
 *   - 玩家行 + hidden → 「_____」
 *
 * 注意：當前行（isCurrent）也套用同樣規則，
 * 才能達成「背稿驗收」效果（hidden 模式下當前行也不顯示文字）。
 */
function applyHint(
  text: string,
  hintMode: HintMode,
  isActorLine: boolean,
): string {
  if (!isActorLine) return text;
  if (hintMode === "full") return text;
  if (hintMode === "hidden") return "_____";
  // first5
  if (text.length <= 5) return text;
  return text.slice(0, 5) + "…";
}

function LineRowImpl({
  line,
  isCurrent,
  isPast,
  isActorLine,
  hintMode,
  characterName,
  onClick,
}: LineRowProps) {
  const isStage = isStageDirection(line);

  // ---------- 共用樣式 ----------

  // 文字色：當前白色、已過淡灰、未來中灰
  const textColor = isCurrent
    ? "text-white"
    : isPast
      ? "text-zinc-600"
      : "text-zinc-400";

  // 字級：當前較大；其餘較小
  const textSize = isCurrent
    ? "text-3xl md:text-4xl"
    : "text-xl md:text-2xl";

  // 行內距與動畫
  const baseSpacing = "py-3 leading-relaxed transition-all duration-300";

  // ---------- 舞台指示 ----------

  if (isStage) {
    const stageColor = isCurrent
      ? "text-zinc-300"
      : isPast
        ? "text-zinc-700"
        : "text-zinc-500";
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={isCurrent ? "true" : undefined}
        className={
          "block w-full text-left italic " +
          baseSpacing +
          " " +
          stageColor +
          " " +
          textSize +
          " " +
          (isCurrent
            ? "scale-[1.02] py-6 text-center"
            : "text-center")
        }
      >
        {line.text}
      </button>
    );
  }

  // ---------- 對白行 ----------

  const displayText = applyHint(line.text, hintMode, isActorLine);

  // 角色標籤色：當前時稍亮
  const tagColor = isCurrent ? "text-zinc-200" : "text-zinc-400";

  // 當前行：左側白色細邊條 + 些許 padding + scale
  const currentEmphasis = isCurrent
    ? "scale-[1.02] border-l-2 border-white bg-white/5 pl-4 my-6"
    : "border-l-2 border-transparent pl-4";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? "true" : undefined}
      className={
        "block w-full text-left " +
        baseSpacing +
        " " +
        currentEmphasis
      }
    >
      <div className={"text-sm " + tagColor}>
        {characterName ?? line.character}
        {isActorLine && (
          <span
            className={
              "ml-2 rounded px-1.5 py-0.5 text-[10px] tracking-wider " +
              (isCurrent
                ? "bg-white/15 text-white"
                : "bg-white/5 text-zinc-400")
            }
          >
            你
          </span>
        )}
      </div>
      <div className={"mt-1 " + textSize + " " + textColor}>{displayText}</div>
    </button>
  );
}

/**
 * memo 化：避免父層每次 render 都重渲染所有行（提詞器可能有數百行）。
 *
 * 注意：props 多為 primitive / stable reference，shallow compare 即可。
 * onClick 由父層 useCallback 提供，否則仍會 re-render（但不影響正確性）。
 */
export const LineRow = memo(LineRowImpl);
