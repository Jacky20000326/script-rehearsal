"use client";

/**
 * HintModePicker — 提示模式選擇器
 *
 * 三選一：完整顯示 / 開頭 5 字 / 完全隱藏，
 * 對應 HintMode = 'full' | 'first5' | 'hidden'。
 *
 * 每個選項下方加上小字情境說明（走戲 / 半背稿 / 全背稿）。
 */

import type { ReactElement } from "react";
import type { HintMode } from "@/lib/types";

export type HintModePickerProps = {
  value: HintMode;
  onChange: (mode: HintMode) => void;
};

type Option = {
  value: HintMode;
  label: string;
  helper: string;
};

const OPTIONS: readonly Option[] = [
  { value: "full", label: "完整顯示", helper: "適合走戲" },
  { value: "first5", label: "開頭 5 字", helper: "適合半背稿" },
  { value: "hidden", label: "完全隱藏", helper: "適合全背稿" },
];

export function HintModePicker({
  value,
  onChange,
}: HintModePickerProps): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label="台詞提示模式"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={
              isSelected
                ? "flex flex-col items-center justify-center rounded-md border-2 border-white bg-white px-4 py-5 text-black transition"
                : "flex flex-col items-center justify-center rounded-md border border-zinc-700 bg-transparent px-4 py-5 text-zinc-300 transition hover:bg-zinc-900"
            }
          >
            <span className="text-xl font-medium tracking-wide">{opt.label}</span>
            <span
              className={
                isSelected
                  ? "mt-1 text-sm text-zinc-600"
                  : "mt-1 text-sm text-zinc-500"
              }
            >
              {opt.helper}
            </span>
          </button>
        );
      })}
    </div>
  );
}
