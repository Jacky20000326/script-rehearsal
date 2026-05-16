"use client";

/**
 * StatusBar — 固定底部狀態列
 *
 * 三欄佈局：
 *   左：狀態文案（含 STT interim 字幕）
 *   中：提示模式徽章
 *   右：快捷鍵說明
 *
 * 設計遵循 CLAUDE.md：避免 emoji，改用 [標籤] 文字標示。
 *
 * 注意：本元件純粹展示，不處理鍵盤事件（在 page 層綁定）。
 */

import { type HintMode, type RehearsalStatus } from "@/lib/types";

export type StatusBarProps = {
  readonly status: RehearsalStatus;
  readonly hintMode: HintMode;
  /** 當前行是否屬於玩家（在 waiting_actor 狀態時顯示「等待你念」） */
  readonly isActorTurn: boolean;
  /** STT 即時字幕（waiting_actor 狀態下顯示） */
  readonly lastInterim?: string;
  /** STT 比對分數（0–1） */
  readonly matchScore?: number;
  readonly sttSupported: boolean;
  /** TTS voices 是否已就緒 */
  readonly voicesReady: boolean;
  /** 環境完全不支援 TTS（無 window.speechSynthesis）。
   *  true 時應顯示「不支援」警示而非永久「載入中…」。 */
  readonly ttsUnsupported: boolean;
  /**
   * 當前對手台詞的播放來源（v3 / M15）：
   *   - 'audio'  顯示「真人錄音」徽章（綠色淡）
   *   - 'tts'    不顯示徽章（保持 v1.0 安靜行為）
   *   - null     非 system_speaking 階段
   */
  readonly currentPlaybackSource?: "audio" | "tts" | null;
};

// ---------- 子元件：左側狀態文案 ----------

function StatusText({
  status,
  isActorTurn,
  lastInterim,
  sttSupported,
}: {
  status: RehearsalStatus;
  isActorTurn: boolean;
  lastInterim?: string;
  /** 若 false：waiting_actor 不顯示「聆聽中」，改提示「請按空白鍵推進」 */
  sttSupported: boolean;
}) {
  switch (status) {
    case "idle":
      return (
        <span className="text-zinc-300">
          <Tag>準備就緒</Tag>
          <span className="ml-2 text-zinc-500">按空白鍵開始</span>
        </span>
      );
    case "system_speaking":
      return (
        <span className="text-zinc-200">
          <Tag>系統說話中</Tag>
        </span>
      );
    case "waiting_actor":
      // 不支援 STT：不該顯示「聆聽中」誤導使用者，改為等待手動推進
      if (!sttSupported) {
        return (
          <span className="text-zinc-200">
            <Tag tone="muted">等待你念</Tag>
            <span className="ml-2 text-zinc-500">
              {isActorTurn ? "請按空白鍵推進" : "按空白鍵繼續"}
            </span>
          </span>
        );
      }
      return (
        <span className="text-zinc-200">
          <Tag tone="accent">聆聽中</Tag>
          <span className="ml-2 text-zinc-500">
            {isActorTurn ? "等待你念…" : "等待推進…"}
          </span>
          {lastInterim && (
            <span className="ml-3 max-w-[40vw] truncate text-xs text-zinc-500 align-middle inline-block">
              「{lastInterim}」
            </span>
          )}
        </span>
      );
    case "paused":
      return (
        <span className="text-zinc-300">
          <Tag tone="muted">暫停</Tag>
          <span className="ml-2 text-zinc-500">按 Esc 繼續</span>
        </span>
      );
    case "done":
      return (
        <span className="text-zinc-200">
          <Tag tone="success">練習完成</Tag>
          <span className="ml-2 text-zinc-500">+1</span>
        </span>
      );
  }
}

// ---------- 子元件：提示模式徽章 ----------

function HintBadge({ mode }: { mode: HintMode }) {
  const label =
    mode === "full" ? "完整" : mode === "first5" ? "前 5 字" : "隱藏";
  const slot = mode === "full" ? "1" : mode === "first5" ? "2" : "3";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500">提示</span>
      <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-200">
        {label}
      </span>
      <span className="font-mono text-zinc-600">{slot}</span>
    </div>
  );
}

// ---------- 子元件：快捷鍵說明 ----------

function HotkeyHints() {
  // 在較小螢幕只顯示部分
  return (
    <div className="hidden gap-3 text-xs text-zinc-500 md:flex">
      <Hotkey k="空白">推進</Hotkey>
      <Hotkey k="←">上一句</Hotkey>
      <Hotkey k="R">重念</Hotkey>
      <Hotkey k="Esc">暫停</Hotkey>
    </div>
  );
}

function Hotkey({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
        {k}
      </kbd>
      <span className="ml-1">{children}</span>
    </span>
  );
}

// ---------- 子元件：通用 Tag ----------

type TagTone = "default" | "accent" | "muted" | "success" | "warn";

const TAG_TONE_CLASS: Record<TagTone, string> = {
  default: "border-zinc-700 bg-zinc-900 text-zinc-200",
  accent: "border-white/40 bg-white/10 text-white",
  muted: "border-zinc-700 bg-zinc-900 text-zinc-400",
  success: "border-zinc-300 bg-zinc-100 text-black",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-200",
};

function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: TagTone;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium " +
        TAG_TONE_CLASS[tone]
      }
    >
      [{children}]
    </span>
  );
}

// ---------- 主元件 ----------

export function StatusBar({
  status,
  hintMode,
  isActorTurn,
  lastInterim,
  sttSupported,
  voicesReady,
  ttsUnsupported,
  currentPlaybackSource,
}: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-900 bg-black/95 backdrop-blur">
      {/* TTS 不支援警示（永久顯示，優先於 voicesReady loading） */}
      {ttsUnsupported && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-xs text-amber-200">
          [注意] 此瀏覽器不支援 TTS，所有對手台詞需手動按空白鍵推進
        </div>
      )}
      {/* STT 不支援警示 */}
      {!sttSupported && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-xs text-amber-200">
          [注意] 此瀏覽器不支援語音辨識，請按空白鍵推進
        </div>
      )}
      {/* TTS voices 載入中（僅在支援 TTS 時才有意義） */}
      {!ttsUnsupported && !voicesReady && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-2 text-center text-xs text-zinc-400">
          [提示] 中文語音載入中…首次使用可能需要數秒
        </div>
      )}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        {/* 左 */}
        <div className="min-w-0 flex-1 text-sm">
          <StatusText
            status={status}
            isActorTurn={isActorTurn}
            lastInterim={lastInterim}
            sttSupported={sttSupported}
          />
          {/* M10：對手台詞走音檔時顯示「真人錄音」徽章 */}
          {status === "system_speaking" &&
            currentPlaybackSource === "audio" && (
              <span className="ml-3 inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 align-middle text-[10px] font-medium text-emerald-200">
                真人錄音
              </span>
            )}
        </div>
        {/* 中 */}
        <div className="flex-shrink-0">
          <HintBadge mode={hintMode} />
        </div>
        {/* 右 */}
        <div className="hidden flex-1 justify-end sm:flex">
          <HotkeyHints />
        </div>
      </div>
    </div>
  );
}
