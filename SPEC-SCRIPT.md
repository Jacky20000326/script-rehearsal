# 劇本對練平台 — 多劇本管理與匯入規格 (SPEC-SCRIPT)

> 版本：v1.0（v6/M28 後部分章節撤除，見 §0）
> 最後更新：2026-05-16
> 母規格：[SPEC.md](./SPEC.md)（v1.0） / [SPEC-AUDIO.md](./SPEC-AUDIO.md)（v3.0）
> 涵蓋里程碑：M17–M22（v4「多劇本 + OCR 匯入」全期）

## 0. v6（M28）後撤除事項

以下原本 v4 章節中的「預設劇本自動 seed」行為已於 **v6 / M28** 全數撤除，下面條目僅供考古：

- §2 第 2 條「預設劇本自動 seed」→ **不再執行**；使用者必須主動匯入第一份劇本
- §3.4「預設劇本 seed（M17）」→ **整段移除**；`app/page.tsx` 不再在 mount 時 seed `id='default'`
- §3.6 表格中「`useScript`：fallback 才走 fetch」→ **fallback 已移除**，active record 不存在時直接 `script = null`
- `public/script.json` / `script.json` / `package.json` 的 `sync-script` npm scripts → **皆已刪除**

撤除後行為以 `SPEC.md` §3 v6 段落為準。

---

## 1. 動機

v1–v3 將 `public/script.json` 視為唯一劇本，任何替換都需手動覆蓋檔案 + `npm run sync-script` + 清 `localStorage`，且 IndexedDB 中的逐行錄音會因 hash 不一致全部失效。v4 引入：

1. **多劇本管理**：使用者可在同一台機器上維護任意份劇本（例：同一檔期排練多齣戲）
2. **匯入管線**：純文字貼上、PDF 解析、圖片 OCR（純前端 Tesseract.js）
3. **編輯 UI**：匯入後可在站內修正解析錯誤（避免回頭去改 JSON）
4. **逐劇本錄音隔離**：每份劇本的角色錄音獨立儲存，不串音

v4 仍維持「純前端、無後端」的根本限制，且**完全相容 v1–v3 既有資料**（v3 既有 audioSegments 在 M22 升級中自動標為「default」劇本）。

## 2. 設計原則

1. **最小破壞**：M17–M22 拆細，每步 typecheck/build 全綠；無一步改變既有錄音 / 對練體驗
2. **背景遷移**：使用者第一次開啟新版時不彈出 modal，預設劇本自動 seed、舊錄音自動歸併到 `default` scriptId
3. **客戶端內全程處理**：PDF / OCR 均在瀏覽器跑（無雲端、無 server），可離線
4. **解析結果可校稿**：所有匯入管線輸出 `Script` 後一律進入編輯頁，使用者確認後才寫入 IDB
5. **缺漏不阻塞**：解析失敗的台詞行可以空字串保留；fallback 到編輯頁手動修

## 3. 多劇本資料模型

### 3.1 ScriptRecord（lib/types.ts）

```ts
type ScriptId = string;          // UUID v4 / 'default'
type ScriptRecord = {
  readonly id: ScriptId;
  readonly name: string;
  readonly script: Script;       // 沿用 v1 Script 型別
  readonly createdAt: number;    // epoch ms
  readonly updatedAt: number;    // epoch ms
  readonly source: 'default' | 'plain-text' | 'pdf' | 'image-ocr';
};
```

### 3.2 IndexedDB schema（v5）

DB：`script-rehearsal-audio` / version 5
Stores：

| Store | keyPath | Index |
|---|---|---|
| `scripts` | `id` | — |
| `audioSegments` | `[scriptId, characterKey, globalIndex]` | `byCharacter` on `characterKey`（非 unique） |

**v3/v4 → v5 migration（M22）**：
- 開啟 versionchange transaction 內以 cursor 撈出舊 `audioSegments` 全部 records
- delete + recreate store（新 keyPath）
- 對每筆 record 補 `scriptId = 'default'` 後 put 回
- 同一 transaction 內完成，不可 await 外部 promise

### 3.3 Active scriptId（localStorage）

- Key：`script-rehearsal:active-script-id`
- Value：當前選用劇本的 id
- 變更廣播：同分頁透過 CustomEvent `script-rehearsal:active-script-changed`、跨分頁透過原生 `storage` 事件
- 由 `subscribeActiveScriptId(cb)` 統一訂閱（`lib/scriptStorage.ts`）

### 3.4 預設劇本 seed（M17）

首頁 `app/page.tsx` 首次 mount 時若 `scripts` store 為空 → 載入 `public/script.json` 並寫入 `id='default' / source='default'`，並 setActiveScriptId('default')。失敗靜默 console.warn，不阻塞 UI。

## 4. 匯入管線

### 4.1 入口

首頁右上角「匯入新劇本（文字 / PDF / 圖片）」 → `/scripts/import`，三 tab 並列：

| Tab | 輸入 | 解析器 |
|---|---|---|
| 純文字 | textarea | `lib/scriptParser.ts` 的啟發式 |
| PDF | File（.pdf） | `lib/pdfExtract.ts`（pdfjs-dist）→ 同上解析器 |
| 圖片 | File[]（jpg/png） | `lib/ocrService.ts`（Tesseract.js）→ 同上解析器 |

### 4.2 解析器（lib/scriptParser.ts）

輸入 plain text，輸出 `Script`。啟發式：

1. 行頭 `角色名：` / `角色名:` 視為角色台詞
2. 角色名為 1–3 個 CJK 字（或包在 `【】` / `「」` 內）
3. 行為 `[...]` / `（...）` / `(...)` 包裹且非角色台詞 → stage_direction
4. 連續空行視為分頁邊界（或 1 行內含 `第 N 頁` 字樣）
5. 解析後 `characters` map 從台詞行的 character 欄位累積

### 4.3 流程

1. 使用者貼文字 / 上傳檔案
2. 解析器跑出 `Script`（可能含錯誤行）
3. 路由跳到 `/scripts/[id]/edit`（先 putScript 占位 id）
4. 使用者校稿後點「儲存」→ putScript 覆蓋
5. setActiveScriptId(newId) → 自動切到新劇本

## 5. OCR 規格（M21）

| 項目 | 說明 |
|---|---|
| 引擎 | Tesseract.js（純前端 WASM） |
| 語言包 | `chi_tra`（繁中）+ `eng`（英文） |
| 載入策略 | dynamic import + lazy load 語言包 |
| 效能 | 每張圖約 5–20 秒（視解析度 / CPU） |
| 限制 | 直書劇本辨識率低；建議橫書、高對比影像 |
| Fallback | 解析失敗的行保留原文字進編輯頁 |

## 6. 解析器啟發式（細部）

`scriptParser.ts` 內以 RegExp 為主：

- `^\s*([一-龥]{1,3})[：:](.+)$` → 角色台詞
- `^\s*[（(\[]([^）)\]]+)[）)\]]\s*$` → stage_direction
- 空行 ≥ 2 連續 → 分頁

角色名若包含「OS」「VO」「旁白」等業界縮寫亦予識別並收為 character。

## 7. 編輯 UI（M19 + M20）

`components/scripts/ScriptEditClient.tsx`：

- 多頁，每頁有頁碼可改、可插入 / 刪除
- 角色面板可改 key / name / 新增 / 刪除（會同步替換所有引用）
- 台詞行可切型別（dialogue ↔ stage_direction）、改 character、改 text、上下移、插入、刪除
- 「儲存」按 putScript 寫回 IDB，保留原 id / source
- 編輯後 `scriptHash` 改變 → 既有錄音自動標為「劇本變更」橘色徽章（資料正確性由 M16 / M22 確保）

## 8. 與既有功能整合

| 功能 | 變更 |
|---|---|
| useScript | 來源從 `loadScript()` 改為「先讀 active scriptId 的 ScriptRecord，fallback 才走 fetch」；新增回傳 `scriptId` |
| 對練 | `getAudioSegment(scriptId, ...)`；scriptId 為 null 直走 TTS |
| 錄音 | `putAudioSegment` record 含 scriptId；scriptId 未就緒時禁止寫入 |
| AudioManager | 新增 scriptId prop，傳給 useAudioSegments 隔離計數 |
| 切換劇本 | ScriptSwitcher → setActiveScriptId → 廣播事件 → useScript 重載 → 下游元件全部重算 |

## 9. 里程碑（M17–M22，皆已完成）

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| M17 | scripts store + seed default | 🟢 |
| M18 | useScript 改源 + ScriptSwitcher | 🟢 |
| M19 | 純文字匯入 + 解析器 + 編輯 UI | 🟢 |
| M20 | PDF 匯入（pdfjs-dist） | 🟢 |
| M21 | 圖片 OCR（Tesseract.js） | 🟢 |
| M22 | audioSegments 綁 scriptId + 文件同步 + v4 完工 | 🟢 |

## 10. 驗收

- [x] 可在站內維護多份劇本，切換不影響各自錄音
- [x] 純文字匯入可正確識別角色與台詞
- [x] PDF / 圖片匯入後可在編輯頁修正
- [x] 同名角色不同劇本不串音（v5 schema 三段複合 key）
- [x] 既有 v3 使用者升級後 audioSegments 全部歸併到 default 劇本，行為無差異
- [x] typecheck + build 全綠
- [x] 文件全部同步（SPEC-SCRIPT / SPEC / SPEC-AUDIO / README / TEST-FLOW / PROGRESS）

## 11. 非範圍

- 不做雲端劇本同步（多裝置共享）
- 不做劇本 diff / 版本控制
- 不做共筆協作編輯
- 不做匯入時的自動翻譯 / 注音
- 不做行動裝置的 PDF / OCR 效能優化（已知首次語言包下載較慢，可接受）

## 12. 開發守則（typecheck 必讀）

### tsbuildinfo 增量編譯快取必須先清

本規格涉及大量「新增 .ts / .tsx 檔」的里程碑（M17–M22 加 lib/scriptStorage、lib/scriptParser、lib/pdfExtract、lib/ocrService、lib/idb/* 等；M23–M27 再加 13+ 個拆分子檔）。實務上多次遇到：

- 實際檔案已建立、`@/*` path mapping 正確、`npm run build` 全綠
- 但 `npx tsc --noEmit` 報假性 `Cannot find module '@/...'` / `Cannot find module './...'`

**根因**：`tsconfig.tsbuildinfo`（incremental compile cache）在新增檔案後不會自動失效。

**正確指令**（已寫入 `~/.claude/skills/dev-trio/SKILL.md` Dev / QA 兩階段；同步記入 `PROGRESS.md` 操作守則章節）：

```bash
rm -f tsconfig.tsbuildinfo && npx tsc --noEmit
```

**踩坑紀錄**：M19 / M23 / M24 / M26 / M27 各踩一次。`npm run build` 內部 typecheck 不受此快取影響，可正常使用。

任何後續對本規格的擴充（新增 import 來源、新增 lib/idb 模組、編輯器子元件拆分），dev-trio QA 階段都必須先清快取再 typecheck。
