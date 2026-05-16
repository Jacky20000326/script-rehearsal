"use client";

/**
 * RangePicker — 練習範圍選擇器
 *
 * 三種模式：全劇 / 單頁 / 自訂起訖（globalIndex）。
 * 受控元件，所有 state 都在父層。
 *
 * 邊界處理（不阻擋使用者操作，只給視覺提示）：
 *   - startIndex < 0
 *   - endIndex > flat.length - 1
 *   - startIndex > endIndex
 */

import type { ReactElement } from "react";
import type { FlatLine, Range } from "@/lib/types";
import { isStageDirection } from "@/lib/types";

export type RangePickerProps = {
  flat: readonly FlatLine[];
  value: Range;
  onChange: (range: Range) => void;
};

const TAB_BUTTON_BASE =
  "rounded-md border px-4 py-2 text-base transition focus:outline-none focus:ring-2 focus:ring-white/40";
const TAB_BUTTON_SELECTED = "border-2 border-white bg-white text-black";
const TAB_BUTTON_UNSELECTED =
  "border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900";

/** 由 flat 推導出可選頁碼（保留出現順序）。 */
function derivePageList(flat: readonly FlatLine[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const l of flat) {
    if (!seen.has(l.page)) {
      seen.add(l.page);
      out.push(l.page);
    }
  }
  return out;
}

/** 將一行扁平資料轉成可顯示字串（給自訂範圍預覽用）。 */
function describeLine(line: FlatLine | undefined): string {
  if (!line) return "（無對應行）";
  const head = `第 ${line.page} 頁，第 ${line.lineIndexInPage + 1} 行`;
  const body = isStageDirection(line)
    ? `（舞台指示）${line.text}`
    : `${line.character}：${line.text}`;
  // 控制預覽長度，避免設定畫面被過長台詞撐爆
  const trimmed = body.length > 30 ? `${body.slice(0, 30)}…` : body;
  return `${head}　${trimmed}`;
}

export function RangePicker({
  flat,
  value,
  onChange,
}: RangePickerProps): ReactElement {
  const pageList = derivePageList(flat);
  const maxIndex = Math.max(flat.length - 1, 0);

  const handleSelectAll = (): void => onChange({ kind: "all" });
  const handleSelectPage = (page: number): void =>
    onChange({ kind: "page", page });
  const handleSelectCustom = (): void => {
    // 切換到自訂時若 value 已經是 custom 則沿用；否則初始化為 0..maxIndex
    if (value.kind === "custom") return;
    onChange({ kind: "custom", startIndex: 0, endIndex: maxIndex });
  };

  const isAll = value.kind === "all";
  const isPage = value.kind === "page";
  const isCustom = value.kind === "custom";

  return (
    <div className="space-y-4">
      {/* 模式 tabs */}
      <div
        role="tablist"
        aria-label="練習範圍模式"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={isAll}
          onClick={handleSelectAll}
          className={`${TAB_BUTTON_BASE} ${isAll ? TAB_BUTTON_SELECTED : TAB_BUTTON_UNSELECTED}`}
        >
          全劇
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isPage}
          onClick={() => {
            // 切到單頁時若還沒選頁，預設第一頁
            if (value.kind === "page") return;
            const first = pageList[0];
            if (typeof first === "number") {
              onChange({ kind: "page", page: first });
            }
          }}
          className={`${TAB_BUTTON_BASE} ${isPage ? TAB_BUTTON_SELECTED : TAB_BUTTON_UNSELECTED}`}
        >
          單頁
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isCustom}
          onClick={handleSelectCustom}
          className={`${TAB_BUTTON_BASE} ${isCustom ? TAB_BUTTON_SELECTED : TAB_BUTTON_UNSELECTED}`}
        >
          自訂
        </button>
      </div>

      {/* 子內容 */}
      {isAll && (
        <p className="text-sm text-zinc-500">
          將從第一行練到最後一行，共 {flat.length} 行。
        </p>
      )}

      {isPage && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {pageList.map((p) => {
              const selected = value.kind === "page" && value.page === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleSelectPage(p)}
                  className={`${TAB_BUTTON_BASE} ${selected ? TAB_BUTTON_SELECTED : TAB_BUTTON_UNSELECTED}`}
                >
                  第 {p} 頁
                </button>
              );
            })}
          </div>
          <p className="text-sm text-zinc-500">點選頁碼即可選定該頁全部行。</p>
        </div>
      )}

      {isCustom && (
        <CustomRangeEditor
          flat={flat}
          startIndex={value.startIndex}
          endIndex={value.endIndex}
          onChange={(start, end) =>
            onChange({ kind: "custom", startIndex: start, endIndex: end })
          }
          maxIndex={maxIndex}
        />
      )}
    </div>
  );
}

// ---------- 自訂範圍編輯器 ----------

type CustomRangeEditorProps = {
  flat: readonly FlatLine[];
  startIndex: number;
  endIndex: number;
  maxIndex: number;
  onChange: (startIndex: number, endIndex: number) => void;
};

function CustomRangeEditor({
  flat,
  startIndex,
  endIndex,
  maxIndex,
  onChange,
}: CustomRangeEditorProps): ReactElement {
  // 邊界檢查（只給視覺提示，不阻擋）
  const outOfRange =
    startIndex < 0 || endIndex < 0 || startIndex > maxIndex || endIndex > maxIndex;
  const inverted = startIndex > endIndex;

  // 反查對應行（注意 startIndex/endIndex 可能超出範圍 → undefined）
  const startLine = flat[startIndex];
  const endLine = flat[endIndex];

  const inputBaseClass =
    "w-28 rounded-md border border-zinc-700 bg-black px-3 py-2 text-base text-white focus:border-white focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="range-start" className="text-sm text-zinc-400">
            起始行（globalIndex）
          </label>
          <input
            id="range-start"
            type="number"
            inputMode="numeric"
            min={0}
            max={maxIndex}
            value={startIndex}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              const next = Number.isFinite(parsed) ? parsed : 0;
              onChange(next, endIndex);
            }}
            className={inputBaseClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="range-end" className="text-sm text-zinc-400">
            結束行（globalIndex）
          </label>
          <input
            id="range-end"
            type="number"
            inputMode="numeric"
            min={0}
            max={maxIndex}
            value={endIndex}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              const next = Number.isFinite(parsed) ? parsed : 0;
              onChange(startIndex, next);
            }}
            className={inputBaseClass}
          />
        </div>
        <p className="text-sm text-zinc-500">
          有效範圍：0 ~ {maxIndex}（共 {flat.length} 行）
        </p>
      </div>

      <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm">
        <p className="text-zinc-400">
          起始 →{" "}
          <span className="text-zinc-200">{describeLine(startLine)}</span>
        </p>
        <p className="text-zinc-400">
          結束 → <span className="text-zinc-200">{describeLine(endLine)}</span>
        </p>
      </div>

      {(outOfRange || inverted) && (
        <ul className="space-y-1 text-sm text-amber-400">
          {outOfRange && <li>提示：索引超出有效範圍，建議調整。</li>}
          {inverted && (
            <li>提示：起始大於結束，開始對練時將自動以較小者為起點。</li>
          )}
        </ul>
      )}
    </div>
  );
}
