"use client";

/**
 * CharacterPicker — 角色選擇器
 *
 * 受控元件：state 由父層持有，此元件僅負責呈現與回呼。
 *
 * 視覺：
 *   - 2×2 grid，每個按鈕顯示「全名（大字）」與「簡稱（小字）」
 *   - 未選：邊框、透明底
 *   - 已選：白底黑字
 *
 * a11y：使用真正的 <button> 元素，並標記 aria-pressed 表達切換狀態。
 */

import type { ReactElement } from "react";

export type CharacterOption = {
  /** 角色簡稱（例：「維」） */
  key: string;
  /** 角色全名（例：「維克多」） */
  name: string;
};

export type CharacterPickerProps = {
  characters: readonly CharacterOption[];
  /** 已選角色簡稱，未選為 null */
  selected: string | null;
  onSelect: (key: string) => void;
};

export function CharacterPicker({
  characters,
  selected,
  onSelect,
}: CharacterPickerProps): ReactElement {
  return (
    <div
      role="group"
      aria-label="選擇飾演角色"
      className="grid grid-cols-2 gap-4"
    >
      {characters.map((c) => {
        const isSelected = selected === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(c.key)}
            className={
              isSelected
                ? "flex flex-col items-center justify-center rounded-md border-2 border-white bg-white px-6 py-8 text-black transition"
                : "flex flex-col items-center justify-center rounded-md border border-zinc-700 bg-transparent px-6 py-8 text-zinc-300 transition hover:bg-zinc-900"
            }
          >
            <span className="text-2xl font-medium tracking-wide">{c.name}</span>
            <span
              className={
                isSelected
                  ? "mt-1 text-sm text-zinc-600"
                  : "mt-1 text-sm text-zinc-500"
              }
            >
              {c.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}
