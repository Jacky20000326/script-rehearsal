/**
 * 劇本與對練狀態相關型別定義
 *
 * 本檔案集中宣告所有跨層共用的型別：
 *   - 原始劇本資料（Script / Page / Line）
 *   - 扁平化後的視圖（FlatLine）
 *   - 練習設定（HintMode / Range）
 *   - 持久化結構（PracticeState）
 *   - 對練狀態機（RehearsalStatus）
 *
 * 設計原則：
 *   1. `Line` 採 discriminated union，舞台指示以 `type: 'stage_direction'` 標籤。
 *   2. 一律使用 readonly 視情境收緊（pages/lines 在載入後不可變）。
 *   3. 不依賴 zod；驗證邏輯置於 lib/script.ts。
 */

// ---------- 劇本原始資料 ----------

/**
 * 角色台詞行
 * 注意：角色欄位是「簡稱」（如「維」、「娜塔」），需透過 Script.characters 取得全名。
 */
export type DialogueLine = {
  readonly character: string;
  readonly text: string;
};

/**
 * 舞台指示行
 * 以 `type: 'stage_direction'` 作為 discriminator，方便 type guard 收窄。
 */
export type StageDirectionLine = {
  readonly type: "stage_direction";
  readonly text: string;
};

/** Line 為兩種行型別的 discriminated union */
export type Line = DialogueLine | StageDirectionLine;

/** 單頁劇本 */
export type Page = {
  readonly page: number;
  readonly lines: readonly Line[];
};

/** 整份劇本 */
export type Script = {
  /** 角色簡稱 → 全名（例：{ "維": "維克多" }） */
  readonly characters: Readonly<Record<string, string>>;
  readonly pages: readonly Page[];
};

// ---------- Type Guards ----------

/**
 * 判斷某行是否為舞台指示。
 * 收窄後呼叫端可直接以 line.text 存取，無需處理 character 欄位。
 */
export function isStageDirection(line: Line): line is StageDirectionLine {
  return (
    typeof (line as { type?: unknown }).type === "string" &&
    (line as { type?: unknown }).type === "stage_direction"
  );
}

// ---------- 扁平化視圖 ----------

/**
 * 扁平化後的單行：保留原 Line 內容，並附帶定位資訊。
 *
 * - globalIndex：在整份劇本扁平陣列中的索引（0-based），供 PracticeState.lastLineIndex 使用。
 * - page：原本所屬的頁碼（與 script.json 一致，例：41）。
 * - lineIndexInPage：在所屬頁面內的索引（0-based）。
 *
 * 使用 intersection（line 本身 ∩ 元資料），呼叫端仍可用 isStageDirection 收窄。
 */
export type FlatLine = Line & {
  readonly globalIndex: number;
  readonly page: number;
  readonly lineIndexInPage: number;
};

// ---------- 設定相關 ----------

/**
 * 提示模式：
 *   - full   完整顯示台詞
 *   - first5 僅顯示開頭 5 字
 *   - hidden 完全隱藏（背稿驗收）
 */
export type HintMode = "full" | "first5" | "hidden";

/**
 * 練習範圍：
 *   - all     整份劇本
 *   - page    單一頁（依 page 數字，例 41）
 *   - custom  自訂起訖 globalIndex（含兩端）
 */
export type Range =
  | { readonly kind: "all" }
  | { readonly kind: "page"; readonly page: number }
  | {
      readonly kind: "custom";
      readonly startIndex: number;
      readonly endIndex: number;
    };

// ---------- 持久化 ----------

/**
 * 對應 SPEC §4.7 的 localStorage 持久化結構。
 * key：`script-rehearsal:practice-state`（定義於 lib/storage.ts）。
 */
export type PracticeState = {
  /** 上次練習的角色簡稱（例：「維」） */
  readonly lastCharacter: string;
  /** 上次練到第幾行（扁平化全域索引） */
  readonly lastLineIndex: number;
  /** 各角色累計練習次數（key 為簡稱） */
  readonly practiceCountByCharacter: Readonly<Record<string, number>>;
};

// ---------- 對練狀態機 ----------

/**
 * 對練狀態。狀態轉移詳見 SPEC §4.2。
 *   idle             尚未開始
 *   system_speaking  系統正在用 TTS 朗讀非己方角色台詞
 *   waiting_actor    等待演員念出己方台詞（含 STT 比對）
 *   paused           Esc 或視窗失焦
 *   done             已練到範圍結尾
 */
export type RehearsalStatus =
  | "idle"
  | "system_speaking"
  | "waiting_actor"
  | "paused"
  | "done";

// ---------- 音檔片段（v4 / SPEC-AUDIO §4.1 + SPEC-SCRIPT §3） ----------

/**
 * 單行對應的音檔片段（一劇本 × 一角色 × 一行 = 一筆），存於 IndexedDB `audioSegments` store。
 *
 * v5 schema：採三段複合 key `[scriptId, characterKey, globalIndex]`，
 * 並建立 `byCharacter` index（單欄 `characterKey`）以利按角色撈全集。
 *
 * - scriptId：對應 ScriptRecord.id（多劇本支援，M22+）
 * - characterKey：對應 Script.characters 的鍵（簡稱）
 * - globalIndex：對應 FlatLine.globalIndex
 * - blob：該行的真人錄音音檔片段
 * - durationMs：以 MediaRecorder 或解碼 metadata 取得（毫秒）
 * - recordedAt：錄製完成時間（epoch ms）
 * - scriptHash：錄製當下劇本內容的 SHA-256（見 lib/scriptHash.ts）；
 *               讀取時與當前劇本 hash 比對，可偵測「劇本已變更，需重錄」。
 */
export type AudioSegmentRecord = {
  scriptId: string;
  characterKey: string;
  globalIndex: number;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  recordedAt: number;
  readonly scriptHash: string;
};

// ---------- 多劇本管理（SPEC-SCRIPT.md v1.0 / M17+） ----------
export type ScriptId = string;
export type ScriptRecord = {
  readonly id: ScriptId;
  readonly name: string;
  readonly script: Script;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly source: 'default' | 'plain-text' | 'pdf' | 'image-ocr';
};
