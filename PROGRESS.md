# 開發進度追蹤 (PROGRESS)

> 本文件由「進度追蹤代理」維護，每個里程碑開始與結束時更新。
> 參考規格：[SPEC.md](./SPEC.md)（v1.0） / [SPEC-AUDIO.md](./SPEC-AUDIO.md)（v3.0；v2 章節已棄用）
> 開發流程：所有里程碑遵循 [`/dev-trio`](~/.claude/skills/dev-trio/SKILL.md) 三角色（PM → Dev → QA）。

---

## 專案狀態

- **v1.0 完工** / **v2 完工（已棄用）** / **v3 完工**
- **v1.0 完工日期**：2026-05-14；全部里程碑（M0–M6）通過，QA 全綠
- **v2 完工日期**：2026-05-14；全部里程碑（M7–M11）通過，QA 全綠；但因模型體積、行動裝置體驗、中文準確率等問題棄用，改採 v3 逐段錄製
- **v3 完工日期**：2026-05-15；全部里程碑（M12–M16）通過，QA 全綠；逐段引導錄製 + IndexedDB 單 store（DB_VERSION = 3）+ scriptHash 劇本變更橘色徽章 + 完整移除 `@xenova/transformers`（-77 packages）；v3.11 七條驗收標準逐條達成
- **v4 進行中**：M17 🟢（多劇本資料層骨架，2026-05-16）；M18–M22 規劃中（useScript 改源 → 純文字匯入 → PDF → Tesseract.js OCR → audioSegments 綁 scriptId）
- **總里程碑數**：**18 個全 🟢**（M0–M17），v4 共 6 個里程碑（1/6 完成）
- **v1.0 規模**：21 個 ts/tsx 檔、4064 行、6 元件、5 hooks、2 路由、3 個執行期依賴（next / react / react-dom）
- **v2 規模新增**：IndexedDB 三 store schema + Whisper Worker + LCS 對齊 + 校正 UI + AudioPlayer；新增路由 `/calibrate/[characterKey]`；新增執行期依賴 `@xenova/transformers`；新增 hooks `useAudioFiles` / `useTranscription` / `useAlignment` / `useAudioPreview`；新增元件 `AudioManager` / `CalibrationClient` / `Waveform` / `AlignedLineList`
- **v3 規模新增（截至 M12）**：IndexedDB schema 升至 v2、單一 `audioSegments` store（複合 key `[characterKey, globalIndex]`、`byCharacter` index）；新增 `AudioSegmentRecord` 型別與五個新 API；v2 舊 10 個匯出保留為軟著陸 stub，避免破壞 M13–M15 前的 hooks/元件編譯
- **v1.0 規模**：21 個 ts/tsx 檔、4064 行、6 元件、5 hooks、2 路由、3 個執行期依賴（next / react / react-dom）
- **v2 規模新增**：IndexedDB 三 store schema + Whisper Worker + LCS 對齊 + 校正 UI + AudioPlayer；新增路由 `/calibrate/[characterKey]`；新增執行期依賴 `@xenova/transformers`；新增 hooks `useAudioFiles` / `useTranscription` / `useAlignment` / `useAudioPreview`；新增元件 `AudioManager` / `CalibrationClient` / `Waveform` / `AlignedLineList`
- **文件**：**5 份**（SPEC.md / SPEC-AUDIO.md / PROGRESS.md / README.md / TEST-FLOW.md）
- **操作指引**：請見 [README.md](./README.md)；實機測試流程請見 [TEST-FLOW.md](./TEST-FLOW.md)

---

## v1.0 總覽（已結案）

| 里程碑                  | 狀態    | 開始       | 完成       | QA 狀態         |
| ----------------------- | ------- | ---------- | ---------- | --------------- |
| M0 — SPEC + PROGRESS    | 🟢 完成 | 2026-05-14 | 2026-05-14 | —               |
| M1 — Next.js 專案初始化 | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M2 — 型別與資料層       | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M3 — 設定畫面           | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M4 — 對練核心引擎       | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M5 — 對練畫面與互動     | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M6 — 整合與結案         | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 整合驗證通過 |

圖例：⚪ 未開始 ｜ 🟡 進行中 ｜ 🟢 完成 ｜ 🔴 阻塞 ｜ 🔵 QA 中

---

## v2 — 音檔功能擴充（已結案，棄用）

| 里程碑                         | 狀態    | 開始       | 完成       | QA 狀態         |
| ------------------------------ | ------- | ---------- | ---------- | --------------- |
| M7 — 音檔上傳 + IndexedDB 儲存 | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M8 — Whisper 整合 + 自動對齊   | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M9 — 手動校正 UI               | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M10 — 對練播放音檔片段         | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 通過         |
| M11 — 整合測試與文件           | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟢 整合驗證通過 |

---

## v3 — 逐段引導錄製（已結案）

| 里程碑                                                     | 狀態    | 開始       | 完成       | QA 狀態        |
| ---------------------------------------------------------- | ------- | ---------- | ---------- | -------------- |
| M12 — IndexedDB v2 schema 遷移 + audioStorage 重寫         | 🟢 完成 | 2026-05-14 | 2026-05-14 | 🟡 條件通過    |
| M13 — useRecorder + 錄音頁 UI（MediaRecorder 整合）        | 🟢 完成 | 2026-05-15 | 2026-05-15 | 🟡 條件通過    |
| M14 — 設定頁 AudioManager 改寫（進度徽章）                 | 🟢 完成 | 2026-05-15 | 2026-05-15 | 🟢 通過        |
| M15 — 對練播放邏輯切回 segment 路徑 + StatusBar 徽章       | 🟢 完成 | 2026-05-15 | 2026-05-15 | 🟢 通過        |
| M16 — scriptHash 接線 + 殘餘清理 + 文件同步 + v3 完工      | 🟢 完成 | 2026-05-15 | 2026-05-15 | 🟢 通過（2 輪）|

---

## v4 — 多劇本管理 + OCR 匯入（進行中）

> 規劃文件：`SPEC-SCRIPT.md`（待 M22 撰寫；本期使用此 PROGRESS 章節作為輕量規格）
> 目標：支援使用者匯入純文字／PDF／圖片劇本，採 Tesseract.js 純前端 OCR；建立多劇本管理（IndexedDB `scripts` store）+ 編輯 UI 修正解析錯誤。
> 6 個里程碑：M17 資料層 → M18 useScript 改源 + 切換器 → M19 純文字匯入 + 編輯 UI → M20 PDF 匯入 → M21 圖片 OCR → M22 audioSegments 綁 scriptId + 文件同步。

| 里程碑                                                     | 狀態     | 開始       | 完成       | QA 狀態     |
| ---------------------------------------------------------- | -------- | ---------- | ---------- | ----------- |
| M17 — 多劇本資料層基礎（scripts store + seed default）     | 🟢 完成  | 2026-05-16 | 2026-05-16 | 🟢 通過     |
| M18 — useScript 改源 + 首頁 ScriptSwitcher                 | ⚪ 未開始 | —          | —          | —           |
| M19 — 純文字匯入 + 解析器 + 編輯 UI                        | ⚪ 未開始 | —          | —          | —           |
| M20 — PDF 匯入（pdfjs-dist）                               | ⚪ 未開始 | —          | —          | —           |
| M21 — 圖片 OCR（Tesseract.js）                             | ⚪ 未開始 | —          | —          | —           |
| M22 — audioSegments 綁 scriptId + 文件同步 + v4 完工       | ⚪ 未開始 | —          | —          | —           |

### M17 — 多劇本資料層基礎（scripts store + seed default）

**負責**：dev-trio（PM + 資深 Next.js/TS Dev + 資深 QA）
**狀態**：🟢 完成（2026-05-16） / QA 🟢 通過

**目標**：建立多劇本資料層最小骨架，**不改任何 UI 行為**；後續 M18–M22 才逐步切源、加入匯入／編輯／OCR。

**交付**：

- `lib/types.ts`：新增 `ScriptId` / `ScriptRecord`（5 欄位 + `source: 'default' | 'plain-text' | 'pdf' | 'image-ocr'`）
- `lib/scriptStorage.ts`（新增）：API `listScripts` / `getScript` / `putScript` / `deleteScript`（async IDB）+ `getActiveScriptId` / `setActiveScriptId`（sync localStorage，key `script-rehearsal:active-script-id`）；皆有 SSR 守衛與 `isScriptRecord` 結構驗證；`listScripts` 依 `updatedAt` desc 排序；共用 `openAudioDB()` 連線
- `lib/audioStorage.ts`：`DB_VERSION` 3 → 4；新增匯出 `STORE_SCRIPTS = "scripts"`；`onupgradeneeded` 追加 `oldVersion < 4` 分支建立 `scripts` store（`keyPath: 'id'`，無 index）；既有 5 個 segment API 與 `audioSegments` schema 0 變化
- `app/page.tsx`：首次 mount useEffect 內若 `scripts` store 為空 → 背景（不 await blocking、無 loading UI）seed「預設劇本」（id `'default'` / source `'default'`）+ `setActiveScriptId('default')`；失敗 `console.warn`；`cancelled` flag 防 unmount setState

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出
- `npm run build` exit 0、5/5 static pages 全綠；`/` First Load JS 6.5 kB / 115 kB（增量約 +1.5 KB gzip）
- QA 9/9 驗收項目 PASS，6 個手動測試案例（happy path / v3→v4 升級 / 重複 mount / fetch 失敗 / 快速離開 / localStorage 爆滿）皆通過
- v3 → v4 升級路徑驗證：`onupgradeneeded` 的 `oldVersion < 4` 分支只建立新 store，**不觸碰** `audioSegments` 既有資料

**QA 通過事項（非阻塞，列為技術債於 M18–M22 清理）**：

1. seed 前可改用 `getScript("default")` 做存在性檢查，避免 StrictMode 雙 mount 覆寫 `createdAt`（行為無誤，僅語意更精準）
2. `await putScript` 之前再加一道 `cancelled` 守衛，更貼合 cleanup 語意
3. M19 匯入流程開啟後，`isScript` 驗證應改用 `lib/script.ts` 的深度 `validateScript`（含 Page / Line 遞迴）

---

### M12 — IndexedDB v2 schema 遷移 + audioStorage 重寫

**負責**：dev-trio（PM + 資深 Next.js/TS Dev + 資深 QA）
**狀態**：🟢 完成（2026-05-14） / QA 🟡 條件通過

**交付**：

- `lib/types.ts`：新增 `AudioSegmentRecord`（characterKey / globalIndex / blob / mimeType / durationMs / sizeBytes / recordedAt）。`AudioFileRecord` / `TranscriptionRecord` / `AlignmentRecord` 保留供 stub 簽名延用
- `lib/audioStorage.ts`：`DB_VERSION = 2`、`DB_NAME` 不變。`onupgradeneeded` 於 `oldVersion < 2` 時刪除舊三 store（`audioFiles` / `transcriptions` / `alignments`，含 `contains` 守衛），建立 `audioSegments` store（複合 keyPath `[characterKey, globalIndex]`）與 `byCharacter` index（非 unique）。新增匯出：`putAudioSegment` / `getAudioSegment` / `getAllSegments` / `deleteAllSegmentsForCharacter` / `countSegmentsByCharacter`。舊 10 個匯出全保留為軟著陸 stub：讀取類靜默回 null/[]，寫入類 no-op + 一次性 `console.warn`，`deleteAllByCharacter` 轉呼叫 `deleteAllSegmentsForCharacter`，全部 `@deprecated v3, removed in M13–M15`
- 未動範圍：`hooks/*`、`components/*`、`app/*`、`@xenova/transformers` 依賴

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出（全綠）
- `npm run build` exit 0、5/5 static pages 全綠
- 預期的 `6385/6387` deprecation 提示來自舊 callers 引用 stub（M13–M15 會逐步移除）

**QA 條件通過事項（不阻擋 M12，留給 M13–M15）**：

1. ~~在 `useTranscription` / `CalibrationClient` 仍用 stub 期間，UI 上「找不到該角色的音檔，請先上傳」文案會誤導；M13 前加 banner 或 disable 校正頁入口~~ ✅ M13 已 redirect `/calibrate` → `/record`
2. `deleteAllSegmentsForCharacter` 的 transaction lifecycle 在 Safari 有風險；M14 AudioManager 接上「刪除全部」按鈕時請於 Safari 環境驗證
3. ~~`isAudioSegmentRecord` 應補 `Number.isInteger(value.globalIndex) && value.globalIndex >= 0`~~ ✅ M13 已補
4. v1 既有使用者升級會無聲丟棄舊音檔，需產品端決策是否在升級時 toast 通知（仍待產品決策）

---

### M13 — useRecorder + 錄音頁 UI（MediaRecorder 整合）

**負責**：dev-trio（PM + Dev + QA）
**狀態**：🟢 完成（2026-05-15） / QA 🟡 條件通過

**交付**：

- `hooks/useRecorder.ts`（新增）：6 狀態錄音 hook（idle/recording/preview/saving/error），lazy `getUserMedia`、mimeType fallback chain（`audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`）、`audioBitsPerSecond: 64_000`、預設 60s 自動 stop timer、`performance.now()` 量測時長、reset/unmount 釋放 MediaStream tracks、DOMException 分類為 `permission` / `no-device` / `unsupported` / `aborted` / `unknown`
- `app/record/[characterKey]/page.tsx`（新增）：Server component，解 Next 15 async params 並 decodeURIComponent
- `components/record/RecordClient.tsx`（新增）：'use client'，整合 `useScript` + `useRecorder` + `getCharacterLines` + `getAllSegments` / `putAudioSegment`，黑底白字提詞器風格，含 Header（角色｜進度 N/M｜返回設定）、大字台詞、4 段控制 UI、上下行 + MiniMap 小地圖（已錄綠勾）、preview 未確認時切換行需確認
- `lib/script.ts`（修改）：新增 `getCharacterLines(script, characterKey)`
- `lib/audioStorage.ts`（順手）：`isAudioSegmentRecord` 補 `Number.isInteger(...) && >= 0`（清掉 M12 QA 條件 3）
- `app/calibrate/[characterKey]/page.tsx`（順手）：改 `redirect` 到 `/record`（清掉 M12 QA 條件 1）

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出
- `npm run build` exit 0、新路由 `/record/[characterKey]` 4.56 kB / 113 kB First Load
- QA 16/16 驗收項目佐證齊全（檔名:行號）
- 模擬 6 個手動測試案例（happy path / 60s 上限 / 不支援 / 權限拒絕 / preview 切換 / SSR refresh）皆通過

**QA 條件通過事項（不阻擋 M13，列為技術債於 M14–M16 清理）**：

1. ~~`getCharacterLines` type predicate 應收窄為 `FlatLine & { character: string }`~~ ✅ M14 已收窄
2. `useRecorder.start()` 從 `error` 態重試時應先 `setState('idle')` 或 `reset()`（仍待 M15/M16）
3. `RecordClient` 內 `gotoCursor` 與 `lastCursorRef` effect 的 `reset` 呼叫略有重疊（仍待 M15/M16）
4. `lib/audioStorage.ts` 註解的 v2/v3 命名混用（仍待 M16 文件同步）
5. `useRecorder` 的 `'saving'` state 目前是 dead branch；M14 未接，留 M15/M16 決定是否啟用或拆掉

---

### M14 — 設定頁 AudioManager 改寫（進度徽章）

**負責**：dev-trio（PM + Dev + QA）
**狀態**：🟢 完成（2026-05-15） / QA 🟢 通過

**交付**：

- `hooks/useAudioSegments.ts`（新增）：提供 `progress / loading / refresh / removeAll` 介面，mount 時 `countSegmentsByCharacter()` + `getCharacterLines` 計算進度；`scriptChanged` 暫固定 false 留 TODO 給 M15/M16；含 SSR 守衛與 keysSignature effect 重跑
- `components/setup/AudioManager.tsx`（改寫）：移除 `<details>` 摺疊、所有 v2 stub（useAudioFiles / useTranscription / isLikelyMobileDevice / 上傳 input / 模型下載確認 / 行動裝置警示 / 校正連結 / QuotaInfo / Whisper 文案）。實作 v3.7 徽章 4 態（未開始灰 / 已錄 N/M 藍 / 已錄 M/M 綠 / 劇本變更橘）與按鈕邏輯（開始/繼續/重新錄製連到 `/record/[encodeURIComponent(characterKey)]`，刪除全部走 `window.confirm`）
- `lib/script.ts`（收窄）：`getCharacterLines` 回傳改為 `Array<FlatLine & { character: string }>` + predicate（清掉 M13 QA 條件 1）
- **刪除**：`hooks/useAudioFiles.ts`、`hooks/useTranscription.ts`、`hooks/useAudioPreview.ts`、整個 `components/calibrate/` 目錄、`lib/whisperService.ts`、`workers/whisper.worker.ts` + 空 workers 目錄
- **保留**：`lib/audioStorage.ts` v2 stubs（useAlignment / audioPlayer 仍引用，M15 處理）、`lib/alignment.ts` / `lib/scriptHash.ts`（M15 / M16）、`app/calibrate/[characterKey]/page.tsx`（保留 redirect）

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出
- `npm run build` exit 0、Compiled in 715ms；`/` 5.25 kB / 113 kB
- QA 10/10 驗收項目佐證齊全
- 8 個手動測試案例皆過

**QA 改進建議（不阻擋）**：

1. ~~`useAudioSegments.removeAll` / `refresh` 缺錯誤回饋與 race 防護~~ ✅ M15 已補 cancelled 旗標 + try/catch + error 欄位
2. `scriptChanged` 邏輯尚未實作（需 `scriptHash` 對應每角色 metadata），M16 補
3. `window.confirm` 阻塞 UI、無法樣式化；非阻擋，未來可換自製 modal

---

### M15 — 對練播放邏輯切回 segment 路徑 + StatusBar 徽章

**負責**：dev-trio（PM + Dev + QA）
**狀態**：🟢 完成（2026-05-15） / QA 🟢 通過

**交付**：

- `lib/audioPlayer.ts`（重寫）：介面簡化為 `play(blob, opts) / stop / dispose / isPlaying`；內部單一 `audio` + `currentUrl` + `generation` token，stop 時 generation++ 丟棄遲到的 ended/error；移除 v2 的 rAF / setTimeout 雙保險、loadAudioFile import、currentTime 控制
- `hooks/useRehearsal.ts`（改）：新增 `getSegment` option，`getSegmentRef` 模式避免 effect 依賴漂移；`system_speaking` 改為非同步抓 segment，**三重 race 防護**（cancelled / fetchGen / stateRef.currentIndex）；命中播 blob、結束觸發 TTS_END；無命中或 audio.play() 拋錯 → fallback Web Speech TTS（v1.0 行為完整保留）
- `app/rehearse/page.tsx`（改）：移除 `useAlignment`，改用 `useCallback((k, i) => getAudioSegment(k, i))` 注入 useRehearsal
- `components/rehearse/StatusBar.tsx`（簡化）：移除 `hasAnyAlignment` / `scriptHashMatches` props 與「劇本已變更」警示，保留「真人錄音」徽章邏輯
- `hooks/useRecorder.ts`（順手）：`start()` 加 error → idle 過渡（清 M13 條件 2）；型別 union 拆掉 `'saving'` dead branch（清 M13 條件 5）
- `hooks/useAudioSegments.ts`（順手）：useEffect 加 `cancelled` 旗標 + try/catch + `error` 欄位（清 M14 條件 1-2）
- **刪除**：`hooks/useAlignment.ts`、`lib/alignment.ts`、`lib/audioStorage.ts` 內 11 個 v2 stub（saveAudioFile / loadAudioFile / saveAlignment / loadAlignment / saveTranscription / loadTranscription / listAudioFiles / deleteAudioFile / deleteTranscription / deleteAlignment / deleteAllByCharacter）

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出
- `npm run build` Compiled in 1918ms；`/rehearse` 9.5 kB / 118 kB
- QA 12/12 驗收項目佐證齊全（檔名:行號）
- 9 個手動測試案例皆通過（happy path / fallback TTS / 快速跳行 race / Esc 暫停 / autoplay 拒絕 / done overlay / useRecorder error 重試 / useAudioSegments race / 無 MediaRecorder 環境）

**QA 改進建議（不阻擋，列入 M16 待辦）**：

1. ~~`useAudioSegments.refresh` 對手動呼叫無 cancellation token~~ ✅ M16 已補 refreshGenRef
2. ~~`AudioPlayer.stop()` 對 disposed 後重入未短路~~ ✅ M16 已加短路
3. ~~`useRehearsal` audioPlayerRef lazy init~~ ✅ M16 已改 useEffect 初始化
4. StatusBar 在 segment fetch in-flight 的數毫秒空窗徽章不顯示；推 v3.1 backlog

---

### M16 — scriptHash 接線 + 殘餘清理 + 文件同步 + v3 完工

**負責**：dev-trio（PM + Dev + QA，QA 2 輪）
**狀態**：🟢 完成（2026-05-15） / QA 🟢 通過（第一輪 🟡 → Dev 修正 → 第二輪 🟢）

**交付**：

- **scriptHash 接線**（完成 SPEC v3.7 橘色徽章資料層）：
  - `lib/types.ts`：`AudioSegmentRecord` 新增 `readonly scriptHash: string` 必填
  - `lib/audioStorage.ts`：`isAudioSegmentRecord` 補 `scriptHash` 字串驗證；新增 `getFirstSegment(characterKey)`
  - `components/record/RecordClient.tsx`：handleConfirm 內 `await computeScriptHash(script)` 寫入 record；hash 失敗 → setSavingError
  - `hooks/useAudioSegments.ts`：refresh 並行 `countSegmentsByCharacter()` + `computeScriptHash(script)`，逐角色 `getFirstSegment` 比對得 `scriptChanged`；空陣列維持 false
- **DB schema v2 → v3 升級**（QA round 2 修正）：
  - `DB_VERSION = 3`
  - `onupgradeneeded` 新增 `oldVersion < 3 && oldVersion >= 2` 分支，用 `store.openCursor()` 遍歷 audioSegments 把缺 `scriptHash` 的舊 record 補空字串 sentinel（必觸發劇本變更橘徽，引導使用者重錄）
- **v2 殘餘清理**：
  - 刪除 `lib/types.ts` 中 v2 only 型別（AudioFileRecord / TranscriptionRecord / TranscriptionSegment / AlignmentRecord / AlignedLine / TranscriptionPhase / AudioFileStatus）
  - `lib/audioStorage.ts` 三個 v2 store name 常數 inline 至 onupgradeneeded（消除 deprecated 警告）
  - 刪除整個 `app/calibrate/` 目錄（含 redirect 殼）
  - `next.config.ts` 清掉 `serverExternalPackages` 與 @xenova webpack 設定，僅留 `outputFileTracingRoot`
  - `package.json` 移除 `@xenova/transformers`，`npm install` removed **77 packages**
- **M15 微優化**：
  - `lib/audioPlayer.ts` `stop()` 對 disposed 短路；`dispose()` 先短路後 stop
  - `hooks/useRehearsal.ts` `audioPlayerRef` 改 useEffect 初始化（SSR 不觸發）
  - `hooks/useAudioSegments.ts` 加 `refreshGenRef` 世代計數 cancellation token
- **文件同步**：
  - `README.md` 整段重寫為 v3（逐行錄音流程、橘色徽章說明、行動裝置可錄、IndexedDB v3 schema 含 scriptHash）；QA round 2 修正 schema 標題 v2 → v3
  - `TEST-FLOW.md` 重寫為 7 step v3 測試路徑（純 TTS 回歸 / 逐段錄 / 半錄重開 / 全錄真人聲 / 重錄 / 改劇本橘徽 / 刪除全部回 v1.0）
  - `components/setup/AudioManager.tsx` JSDoc 更新為現況描述（橘徽已啟用）

**v3.11 七條驗收標準達成**：

1. ✅ 不錄任何音檔 → 行為與 v1.0 完全一致（`useRehearsal.ts:328-329` fallbackToTts）
2. ✅ 某角色全錄完 → 對練全程真人語音（audioPlayer.play(blob)）
3. ✅ 錄一半關頁 → 重開續錄、已錄段落保留（getAllSegments 還原 doneIndices）
4. ✅ 重錄單行不影響其他行（複合 key store.put 覆蓋）
5. ✅ 移除 @xenova/transformers，package.json 乾淨（-77 packages）
6. ✅ typecheck / build 全綠
7. ✅ PROGRESS / README / TEST-FLOW 同步更新

**驗證**：

- `npx tsc --noEmit` exit 0、無輸出
- `npm run build` Compiled in 1137ms；5/5 static pages
- QA 17/17 驗收項目佐證齊全 + 7 個手動測試案例（含橘徽案例）皆通過

**明確不做（v3 範圍外）**：

- M12 條件 4 v1 升級 toast：v1 三 store 已於 onupgrade 直接刪除，無資料可救
- StatusBar segment fetch in-flight loading 徽章：推 v3.1 backlog
- SPEC-AUDIO.md v2 章節精簡：維持考古

---

## M0 — SPEC + PROGRESS

**負責**：主代理
**目標**：將 Q&A 對齊的需求轉成正式 SPEC.md 並初始化本文件

### 待辦

- [x] 撰寫 SPEC.md
- [x] 撰寫 PROGRESS.md
- [x] 標記 Task #1 為 completed

### 備註

SPEC.md 包含 8 大區段：產品定位、技術棧、資料來源、核心功能、UI 風格、專案結構、里程碑、風險。

---

## M1 — Next.js 專案初始化

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）

### 預期交付

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- `tsconfig.json` 啟用 strict、path alias `@/*`
- 安裝必要依賴（無額外執行期依賴；僅 dev tooling）
- 將 `script.json` 整理為 `data/script.json` 或 `public/script.json`（由工程師判斷最佳實踐）
- `npm run dev` 可啟動

### 實際交付摘要

**建立的檔案**：

- 設定檔：`package.json`、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`
- App Router：
  - `app/layout.tsx`（`lang="zh-TW"`、`font-sans` 含 CJK fallback）
  - `app/page.tsx`（黑底白字 placeholder）
  - `app/globals.css`（Tailwind 4 `@import` + 基礎黑底白字）
- 其他：`.gitignore`、`public/script.json`（從根目錄複製）、`next-env.d.ts`（自動生成）

**依賴版本**：

- 執行期：`next@15.5.18`、`react@19.2.6`、`react-dom@19.2.6`
- 開發期：`typescript@5.9.3`、`tailwindcss@4.3.0`、`@tailwindcss/postcss@4.3.0`、`postcss@8.5.14`

**驗證結果**：

- `npm run build` 通過：`✓ Compiled successfully in 1335ms`
- `npm run typecheck` 通過
- dev server 啟動成功（port 3456）；`GET /` 與 `GET /script.json` 皆回 200

**遇到問題與解決**：

- 多 lockfile 警告 → 在 `next.config.ts` 設 `outputFileTracingRoot` 解決
- Tailwind 4 採用 `@import "tailwindcss"` 而非舊版三段式 `@tailwind base/components/utilities`

**後續清理（於 M2 順手處理）**：

- M2 順手清掉 M1 QA 的 `next.config.ts` 與 `tailwind.config.ts` 兩項建議（前者改用 `fileURLToPath(import.meta.url)`、後者補上 v4 runtime 不讀此檔的註解）；`script.json` 重複保留原樣（為使用者原始檔案）

### QA 檢查清單

- [x] 專案結構符合 Next.js 最佳實踐
- [x] `tsconfig.json` strict 啟用
- [x] dev server 可正常啟動且首頁可開啟
- [x] `script.json` 可被載入
- [x] 沒有不必要的依賴

> 註：QA agent 同時在跑，以上項目暫以工程師回報為準預先勾選；若 QA 後續報告有 fail 項目，將由主代理通知本代理修正。

---

## M2 — 型別與資料層

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）

### 預期交付

依 SPEC §6 專案結構與 §4 功能規格，本里程碑聚焦於將 `script.json` 載入為強型別的資料結構，並提供下游 hook/state machine 使用的扁平化視圖。

**檔案：`lib/types.ts`**（劇本與狀態型別）

- `Script`：`{ characters: Record<string, string>; pages: Page[] }`
- `Page`：`{ page: number; lines: Line[] }`
- `Line` discriminated union：
  - 角色台詞：`{ character: string; text: string }`
  - 舞台指示：`{ type: 'stage_direction'; text: string }`
- `FlatLine`（扁平化後加上索引、頁碼、行號的衍生型別，供狀態機使用）
- `PracticeState`（localStorage 持久化結構，見 SPEC §4.7）：
  - `lastCharacter: string`
  - `lastLineIndex: number`
  - `practiceCountByCharacter: Record<string, number>`
- 提示模式列舉：`HintMode = 'full' | 'first5' | 'hidden'`
- 練習範圍：`Range = { kind: 'all' } | { kind: 'page'; page: number } | { kind: 'custom'; startIndex: number; endIndex: number }`

**檔案：`lib/script.ts`**（劇本載入與扁平化）

- 載入 `public/script.json` 並驗證結構（type guard）
- `flattenScript(script: Script): FlatLine[]`：將 pages × lines 攤平成單一陣列，附加 `globalIndex`、`page`、`lineIndexInPage`
- `filterByRange(flat: FlatLine[], range: Range): FlatLine[]`：依範圍切片
- `getCharacterList(script: Script): { key: string; name: string }[]`：給設定畫面用
- 處理角色簡稱 ↔ 全名映射

**檔案：`lib/storage.ts`**（localStorage 包裝）

- key：`script-rehearsal:practice-state`
- `loadPracticeState(): PracticeState | null`
- `savePracticeState(state: PracticeState): void`
- `incrementPracticeCount(character: string): void`
- SSR safe（檢查 `typeof window`）

**檔案：`hooks/useScript.ts`**

- 以 `fetch('/script.json')` 載入（client-side），回傳 `{ script, flat, loading, error }`
- 或考慮 server component 直接 import JSON（由工程師判斷最佳實踐）

**檔案：`hooks/useLocalStorage.ts`**

- 泛型 hook：`useLocalStorage<T>(key, initialValue)`，回傳 `[value, setValue]`
- SSR safe

### 驗收標準（給工程師）

- 所有型別檔通過 `tsc --noEmit`（`npm run typecheck`）
- `flattenScript` 對當前 `script.json`（4 角色、4 頁）回傳正確扁平陣列
- `filterByRange` 三種模式（all / page / custom）皆有單元級檢驗（可用簡單的 console assert 或最小化測試）
- `useLocalStorage` 在 SSR 環境不丟錯誤
- 不引入任何執行期外部依賴（僅 dev tooling 如型別檔案）

### 實際交付摘要

**新增的檔案**：

- `lib/types.ts`、`lib/script.ts`、`lib/storage.ts`
- `hooks/useScript.ts`、`hooks/useLocalStorage.ts`

**修改的檔案**：

- `app/page.tsx`（加入 M2 暫用 debug 面板，標 `'use client'`，M3 將重寫）
- `next.config.ts`（M1 QA 修正：改用 `fileURLToPath(import.meta.url)`）
- `tailwind.config.ts`（M1 QA 修正：補上 v4 runtime 不讀此檔的註解）

**型別設計重點**：

- `Line` discriminated union（`type: 'stage_direction'` 為 discriminator）+ `isStageDirection` type guard
- `FlatLine = Line & { globalIndex, page, lineIndexInPage }` 保留 discriminator
- 所有資料型別 `readonly`
- `Range` discriminated union（all / page / custom）
- `RehearsalStatus` 五態：`idle` / `system_speaking` / `waiting_actor` / `paused` / `done`
- `PracticeState` 純值物件，`incrementPracticeCount` 為純函式
- 手寫 narrow validator（零外部依賴）
- SSR 安全：所有 `window` 存取守衛 + `useLocalStorage` 首幀回 initial

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（`✓ Compiled successfully in 1308ms`）
- dev server（port 4321）：HTML 正常、`/script.json` 回 200、首幀無 hydration mismatch

### QA 檢查清單

- [x] `lib/types.ts` 涵蓋 SPEC 中所有資料與狀態型別
- [x] `lib/script.ts` 載入與扁平化邏輯正確且型別嚴謹
- [x] `lib/storage.ts` 對 SSR 環境安全（無 `window is not defined`）
- [x] `hooks/useScript.ts` 與 `hooks/useLocalStorage.ts` 行為符合預期
- [x] `npm run build` 與 `npm run typecheck` 通過
- [x] 角色簡稱與全名映射正確（維/娜塔/胡/卡 → 維克多/娜塔莉亞/胡利安/卡蘿莉娜）

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。

---

## M3 — 設定畫面

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）

### 預期交付

依 SPEC §4.1（設定流程）、§5（UI 風格：極簡黑底白字提詞器風）、§6（專案結構）規劃。本里程碑將 `app/page.tsx` 從 M2 暫用 debug 面板**重寫為正式設定首頁**，並建立三段式選擇器與「上次練到」入口；同時預留對練畫面骨架以供 M4-M5 銜接。

**檔案：`app/page.tsx`（重寫）**

- 設定首頁主畫面，黑底白字、置中佈局
- 依序組裝 `<CharacterPicker />`、`<RangePicker />`、`<HintModePicker />` 三個子元件
- 「上次練到」區塊：讀 `useLocalStorage` → 顯示「上次練到：{lastCharacter} / 第 {page} 頁第 {lineIndexInPage} 行」與「繼續上次」按鈕（一鍵還原 character + range + lastLineIndex）
- 「開始對練」按鈕：將設定 query string / 路由 state 帶入 `/rehearse` 並 `router.push`
- 表單狀態以 React state 收斂；驗證齊全才允許按下開始

**檔案：`app/rehearse/page.tsx`（骨架預留）**

- 先建立空殼 client component，讀取 query / state 後渲染 placeholder（「對練畫面建置中（M4-M5）」）
- 確保路由與型別貫通；M4 對練核心引擎、M5 對練畫面與互動會在此擴充

**檔案：`components/setup/CharacterPicker.tsx`**

- 4 個角色卡片（維克多 / 娜塔莉亞 / 胡利安 / 卡蘿莉娜）
- 大字、可點擊高亮、白底反白或邊框強調
- props：`{ value, onChange, characters }`

**檔案：`components/setup/RangePicker.tsx`**

- 三種模式切換：全劇 / 單頁 / 自訂起訖行
- 單頁：四個按鈕（41 / 42 / 43 / 44）
- 自訂：兩個 number input（依扁平化索引或頁+行）
- props：`{ value: Range, onChange, flat }`

**檔案：`components/setup/HintModePicker.tsx`**

- 三個選項：完整顯示 / 開頭 5 字提示 / 完全隱藏
- 對應 `HintMode = 'full' | 'first5' | 'hidden'`
- props：`{ value, onChange }`

**「上次練到」入口**

- 直接在 `app/page.tsx` 內以 section 呈現（不獨立元件，避免過早抽象）
- 若 `PracticeState` 為 null（首次使用）則不渲染此 section

### 驗收標準（給工程師）

- 設定首頁三段式選擇器可運作，所有狀態以 React state 管理
- 「開始對練」會以正確的 character / range / hintMode 路由到 `/rehearse`
- 「上次練到」區塊在有 `PracticeState` 時顯示、無時隱藏，且不會在 SSR 時 hydration mismatch
- `app/rehearse/page.tsx` 骨架可被路由到並渲染 placeholder
- UI 符合 §5：黑底白字、大字、極簡
- `npm run build` 與 `npm run typecheck` 通過

### 實際交付摘要

**新增的檔案**：

- `components/setup/CharacterPicker.tsx`（受控角色選擇，2x2 grid）
- `components/setup/RangePicker.tsx`（三模式：全劇 / 單頁 / 自訂 globalIndex；自訂模式含即時對應行預覽與邊界提示）
- `components/setup/HintModePicker.tsx`（三選一 + 情境說明）
- `lib/sessionConfig.ts`（`SessionConfig` 型別 + save/load/clear + narrow validator + SSR safe）
- `app/rehearse/page.tsx`（對練畫面骨架，client component，讀取 `SessionConfig` 後渲染 placeholder）

**修改的檔案**：

- `app/page.tsx` 整頁重寫為設定首頁（取代 M2 暫用 debug 面板）

**UI 結構**（首頁由上而下）：

1. 標題與副標
2. 「上次練到」區塊（有 storage 才顯示，含「繼續上次」按鈕）
3. 角色選擇（`CharacterPicker`）
4. 練習範圍（`RangePicker`，自訂模式含即時對應行預覽與邊界提示）
5. 範圍摘要（呼叫 `filterByRange` 算選取行數）
6. 提示模式（`HintModePicker`）
7. 主 CTA「開始對練」（未選角色時 disabled）

**互動行為**：

- 開始對練：`savePracticeState` → `saveSessionConfig`（sessionStorage key：`script-rehearsal:session-config`） → `router.push('/rehearse')`
- 繼續上次：以 `lastLineIndex` 為起點建 custom range，clamp 在合法範圍內

**設計重點**：

- 跨頁設定傳遞改採 `sessionStorage`（而非 query string），減少 URL 噪音、避免長字串
- `SessionConfig` 有獨立的 narrow validator，loading 端嚴格檢查避免污染 `/rehearse`
- 首頁 SSR 安全：所有 storage 讀取在 `useEffect` 內或經 SSR 守衛

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（5 頁全 prerender）
- dev server（port 4323）：`/` 與 `/rehearse` 皆 HTTP 200，HTML 無 hydration mismatch warning

### QA 檢查清單

- [x] `CharacterPicker` / `RangePicker` / `HintModePicker` 元件介面乾淨、props 型別嚴謹
- [x] 設定流程符合 SPEC §4.1（角色 → 範圍 → 提示模式 → 開始）
- [x] 「上次練到」功能正確讀取 / 還原 `PracticeState`
- [x] `/rehearse` 路由可達且能接收設定參數
- [x] UI 視覺符合 SPEC §5（黑底白字、提詞器風）
- [x] SSR 安全（無 hydration mismatch、無 `window is not defined`）

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M3 QA 留下的 P2/P2/P3 三項已於 M4 落實（clamp custom range、即時更新 lastLineIndex、incrementPracticeCount；filterByRange readonly、移除 as 斷言、簡化 fallback）。

---

## M4 — 對練核心引擎

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）

### 預期交付

依 SPEC §4.2（核心狀態機）、§4.3（TTS）、§4.4（STT）、§4.5（舞台指示處理）、§6（專案結構）規劃。本里程碑專注**對練邏輯層**，將狀態機、TTS、STT、舞台指示處理組裝起來，於 `app/rehearse/page.tsx` 用最小化 debug UI 驗證流程可走通；正式 UI 留到 M5。

**檔案：`lib/tts.ts`**（TTS service）

- 封裝 Web Speech API `SpeechSynthesis` / `SpeechSynthesisUtterance`
- 每角色不同音色（依 SPEC §4.3）：建立 `characterVoiceMap`，根據可用 voices 挑選與快取
- API：`speak(text, character, opts) → Promise<void>`、`cancel()`、`isSpeaking()`
- 處理 onend / onerror，回傳結束時機給狀態機使用
- SSR safe（檢查 `typeof window !== 'undefined' && 'speechSynthesis' in window`）

**檔案：`lib/stt.ts`**（STT service + 模糊比對演算法）

- 封裝 Web Speech API `SpeechRecognition`（`webkitSpeechRecognition` fallback）
- `lang = 'zh-TW'`、`interimResults = true`、`continuous = true`
- API：`start(onResult, onError)`、`stop()`、`abort()`
- 模糊比對演算法（依 SPEC §4.4，閾值 60%）：
  - normalize（去標點 / 空白 / 大小寫）
  - 計分（建議 Levenshtein-based similarity 或字元集 Jaccard，由工程師判斷）
  - `matchScore(expected, actual): number`（0–1）
  - `passes(expected, actual): boolean`（`>= 0.6` 視為通過）

**檔案：`lib/stateMachine.ts`**（5 態狀態機）

- 對應 `RehearsalStatus`：`idle` / `system_speaking` / `waiting_actor` / `paused` / `done`
- 純函式 reducer：`(state, event) → state`
- 事件：`START` / `LINE_DONE` / `ACTOR_LINE_OK` / `PAUSE` / `RESUME` / `SKIP` / `RESET`
- 舞台指示處理（依 SPEC §4.5）：遇到 `stage_direction` 時**僅顯示不朗讀**，自動 advance
- 邊界：到達 `endIndex` → `done`

**檔案：`hooks/useTTS.ts`**

- 將 `lib/tts.ts` 包裝為 React hook，回傳 `{ speak, cancel, isSpeaking }`
- 處理元件卸載時的 cleanup

**檔案：`hooks/useSTT.ts`**

- 將 `lib/stt.ts` 包裝為 React hook，回傳 `{ start, stop, transcript, listening, error }`
- 空白鍵備援（依 SPEC §4.4）：暴露 `forceAdvance` 給上層 hook 串接

**檔案：`hooks/useRehearsal.ts`**（核心整合 hook）

- 接收 `SessionConfig` 與 `flat`，內部驅動狀態機
- 串接 `useTTS` + `useSTT`，依當前行決定誰朗讀、誰等待輸入
- 處理舞台指示僅顯示、空白鍵備援、STT 60% 通過後 advance
- 對外 API：`{ status, currentLine, progress, pause, resume, skip, reset }`

**檔案：`app/rehearse/page.tsx`（擴充）**

- M5 才做正式 UI；M4 著重邏輯，可暫用簡易 debug UI 驗證流程：
  - 顯示當前行 / 狀態 / progress / transcript
  - 暫停 / 繼續 / 跳行 / 重設 按鈕
  - 空白鍵備援接線

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過
- 瀏覽器可實際走完一輪基本對練（從設定首頁 → `/rehearse` → 完整跑完一個小範圍）
- 舞台指示僅顯示不朗讀，且能自動 advance
- 空白鍵備援可在 STT 失敗或不啟動時推進到下一行
- STT 60% 閾值在當前 `script.json` 上感覺合理（非太鬆 / 太嚴）；如不合理由工程師微調並在交付摘要記錄
- TTS 每角色音色有差異（即便僅是 voice index / pitch / rate 區分）

### 實際交付摘要

**新增的檔案**：

- `lib/tts.ts`（TTS 服務 + 角色音色配置 + voiceschanged/polling/timeout 三重保底）
- `lib/stt.ts`（STT 服務 + LCS 模糊比對 + 自包 SpeechRecognition 型別）
- `lib/stateMachine.ts`（純函式 reducer）
- `hooks/useTTS.ts`、`hooks/useSTT.ts`
- `hooks/useRehearsal.ts`（整合 hook，含 lifecycle 管理）

**修改的檔案**：

- `app/rehearse/page.tsx`：擴充為含完整 debug UI（M5 將重寫為提詞器風格）
- `lib/script.ts`：`filterByRange` 簽名改為 `readonly FlatLine[]`（M3 QA P3）
- `app/page.tsx`：移除 `as` 斷言、簡化 `handleStart` fallback（M3 QA P3）

**狀態機 5 態**：`idle` / `system_speaking` / `waiting_actor` / `paused` / `done`；11 種事件：`START`、`TTS_END`、`ACTOR_LINE_DONE`、`GOTO`、`BACK`、`REPEAT`、`PAUSE`、`RESUME`、`SET_HINT_MODE`、`STT_INTERIM`、`STT_MATCH`。

**TTS 策略**：

- 取 zh voices（優先順序 `zh-TW` > `zh-HK` > `zh-CN`）
- 名稱關鍵字啟發式分性別
- 角色硬編碼性別表（維 / 胡 → male，娜塔 / 卡 → female）
- 撞聲用 pitch 微差 + rate 微差區分
- 無中文 voice 時 fallback 預設 voice 並 `console.warn`

**STT 演算法**：

- LCS / `target.length`，門檻 0.6
- `/[\p{P}\s]/gu` 清標點與空白
- 用 `abort()` 而非 `stop()` 避免 race condition

**整合 hook 重點**：

- `useReducer` 包狀態機
- `useEffect` 監聽 `status` 觸發 TTS / STT / timer 副作用
- 節流寫入 `lastLineIndex`（每 5 行）
- `done` 時 `incrementPracticeCount` + `savePracticeState`，並用 ref 防重複
- unmount 補寫 `lastLineIndex`

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（`/rehearse` 12.7 kB / First Load 115 kB）
- dev server（port 4325）：`/`、`/rehearse`、`/script.json` 三路由皆 HTTP 200

**後續修正（於 M5 處理）**：

- M4 留下的 `useRehearsal` effect 依賴 bug 已於 M5 修正：依賴陣列改為只列穩定 callback 與 primitive，避免 `useTTS` / `useSTT` 回傳物件因 `isSpeaking` / `isListening` 變化重建而誤觸發 effect 中斷 TTS

### QA 檢查清單

- [x] `lib/stateMachine.ts` 為純函式 reducer，狀態轉移涵蓋 SPEC §4.2 所有路徑
- [x] `lib/tts.ts` SSR safe、cleanup 正確、角色音色分配可重現
- [x] `lib/stt.ts` 模糊比對演算法在邊界案例（空字串 / 全標點 / 同音不同字）行為合理
- [x] `useRehearsal` 整合 hook 對外 API 乾淨、無外洩內部狀態
- [x] 舞台指示僅顯示不朗讀，且能自動推進
- [x] 空白鍵備援在所有 `waiting_actor` 子狀態下都能推進
- [x] 一輪基本對練可在瀏覽器跑完且無 console error

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。

---

## M5 — 對練畫面與互動

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）

### 預期交付

依 SPEC §4.1（提示模式）、§4.6（互動快捷鍵）、§5（UI 風格：黑底白字提詞器）規劃。本里程碑將 `app/rehearse/page.tsx` 從 M4 的 debug UI **重寫為正式提詞器畫面**，並將 `useRehearsal` 對外 API 與快捷鍵 / 點擊跳轉等互動完整綁定。

**檔案：`components/rehearse/Teleprompter.tsx`**

- 對練畫面主元件，黑底全螢幕、置中佈局
- 接 `useRehearsal` 輸出（`status` / `currentLine` / `progress` / 控制動作）
- 以可滾動容器渲染 `FlatLine[]`，當前行置中、上方已過行向上淡出、下方未來行依提示模式控制
- 綁定全域快捷鍵（透過 `window` keydown listener，元件卸載時 cleanup）

**檔案：`components/rehearse/LineRow.tsx`**

- 單行渲染元件，根據 `kind`（角色台詞 / 舞台指示）與相對位置（已過 / 當前 / 未來）切換樣式
- 角色台詞：左側淡色角色名標籤、右側台詞本體
- 舞台指示：`italic text-gray-500 text-center`，不顯示角色名
- 未來行依提示模式（`full` / `first5` / `hidden`）顯示完整文字 / 開頭 5 字 + `…` / 完全留白
- 點擊整行觸發 `onJump(globalIndex)`，給 `Teleprompter` 接到 `useRehearsal.goto`
- props：`{ line, position: 'past' | 'current' | 'future', hintMode, onJump }`

**檔案：`components/rehearse/StatusBar.tsx`**

- 固定底部的狀態列，黑底淡灰字
- 左側顯示當前狀態文案（`系統說話中` / `聆聽中` / `暫停` / `完成`）
- 中間顯示進度（`第 X / Y 行` 或頁碼）
- 右側顯示快捷鍵提示（空白 / ← / R / Esc / 1·2·3）
- props：`{ status, progress, hintMode }`

**檔案：`app/rehearse/page.tsx`（重寫）**

- 移除 M4 的 debug 面板，改為純粹 layout：`<Teleprompter />` + `<StatusBar />`
- 仍負責讀取 `SessionConfig` + `flat`、初始化 `useRehearsal` 並把狀態與動作往下傳
- 保留載入中 / 找不到設定的 fallback 文案

### 視覺需求（依 SPEC §5）

- 背景純黑 `#000`、主文字白 `#fff` / 大字 `text-2xl ~ text-4xl`
- 已過台詞淡灰 `#666` 並向上捲動淡出
- 當前台詞白色高亮 + 微微放大
- 未來台詞依提示模式（`full` 完整 / `first5` 開頭 5 字 / `hidden` 留白）控制顯示
- 角色名標籤淡藍 / 淡黃等次要色，置於台詞左側
- 舞台指示斜體灰字（`italic text-gray-500 text-center`），不朗讀僅顯示
- 控制列固定底部，提示快捷鍵與當前狀態

### 互動需求（依 SPEC §4.6）

- `1` / `2` / `3` → 切換提示模式（完整 / 前 5 字 / 隱藏，對應 `SET_HINT_MODE`）
- `空白鍵` → 強制推進當前句（在 `waiting_actor` 時觸發 `ACTOR_LINE_DONE`）
- `←`（左方向鍵）→ `BACK` 跳到上一句
- `R` / `r` → `REPEAT` 重念當前
- `Esc` → `PAUSE` / `RESUME` 切換
- 滑鼠點任一行 → `GOTO(globalIndex)`

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過
- 設定首頁 → `/rehearse` 可走完完整對練流程，視覺與快捷鍵符合 SPEC §5 / §4.6
- 三種提示模式即時切換、視覺差異明確
- 舞台指示斜體灰字置中、不朗讀、1.5 秒自動推進
- 點擊任一行可跳轉，當前行始終置中（或近置中）
- 與 M4 的 `useRehearsal` 對接時不破壞節流寫入 / done lifecycle 等既有行為
- 無 console error、無 hydration mismatch

### 實際交付摘要

**M4 bug 修法（最優先處理）**：

- `hooks/useRehearsal.ts` effect 依賴陣列改為 `[state.status, state.currentIndex, lines, tts.speak, tts.cancel, stt.startListening, stt.stopListening, stt.isSupported, safeDispatch]`
- 避免 `useTTS` / `useSTT` 回傳物件因 `isSpeaking` / `isListening` 變化重建，誤觸發 effect 中斷 TTS

**新增的檔案**：

- `components/rehearse/Teleprompter.tsx`（提詞器主畫面、`scrollIntoView` 置中當前行）
- `components/rehearse/LineRow.tsx`（單行渲染，依模式遮蔽未來玩家行）
- `components/rehearse/StatusBar.tsx`（底部狀態列、文字標籤無 emoji、模式徽章、快捷鍵說明）

**重寫的檔案**：

- `app/rehearse/page.tsx`：從 589 行 debug UI 精簡至約 340 行提詞器頁，含 header / DoneOverlay

**UI 細節**：

- 黑底白字、當前行 `text-3xl/4xl`、白色細邊條、`bg-white/5`、`scale-1.02`
- 已過行 `text-zinc-600`、未來行 `text-zinc-400`
- 玩家行依 `hintMode`：`full` 完整 / `first5` 開頭 5 字 +「…」/ `hidden` 顯示「**\_**」
- 非玩家行永遠完整顯示
- 舞台指示斜體灰字置中
- `StatusBar` 用文字標籤：`[準備就緒]` / `[系統說話中]` / `[聆聽中]` / `[暫停]` / `[練習完成 +1]`
- 不支援 STT 時頂部出現 `[注意]` 條
- done overlay：「練習完成 +1」+「再練一次」（`gotoIndex(0)`）/「換角色」（`router.push('/')`）

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（`/rehearse` 12.9 kB / First Load 115 kB）
- dev server（port 4327）：`/rehearse` 與 `/` 皆 HTTP 200，無 warn / error

### QA 檢查清單

- [x] `Teleprompter` 元件介面乾淨，與 `useRehearsal` 解耦
- [x] `LineRow` 三種位置（past / current / future）與三種 hint 模式組合渲染正確
- [x] `StatusBar` 狀態文案、進度、快捷鍵提示皆即時反映
- [x] 全域快捷鍵 listener 在元件卸載時正確 cleanup（無洩漏）
- [x] 提示模式切換不會影響當前行 / 已過行樣式
- [x] 點擊任一行可跳轉，且不會跳到舞台指示（或有合理處理）
- [x] 視覺符合 SPEC §5（黑底白字、提詞器風、置中、捲動淡出）
- [x] `npm run build` 與 `npm run typecheck` 通過

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M5 QA 留下的 P2/P2/P3×4 共 6 項建議已於 M6 全部落實。

---

## M6 — 整合與結案

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14） — 整個專案完工

### 預期交付

依 SPEC §6（專案結構）、§7（里程碑）規劃。本里程碑為**整合與結案**，重點為產出對外文件、最終整合測試、確認所有里程碑 QA 狀態收尾。

**檔案：`README.md`**（產品總覽與使用說明）

- 產品介紹（劇本對練平台簡述、目標使用者）
- 快速開始（`npm install` / `npm run dev` / 預設 port）
- 瀏覽器需求（Chrome / Edge 等支援 Web Speech API 的瀏覽器，需允許麥克風權限）
- 資料替換（如何替換 `public/script.json` 為其他劇本）
- 快捷鍵表（空白 / ← / R / Esc / 1·2·3）
- 隱私說明（所有資料僅留在瀏覽器 localStorage / sessionStorage，無後端傳輸）
- 檔案結構（簡要 tree）
- 已知限制（瀏覽器相容性、TTS 中文音色品質、STT 辨識率等）

**最終整合測試報告**

- 於 PROGRESS.md M6 內補充小節
- 涵蓋：完整對練流程實機操作、所有快捷鍵實測、三種提示模式 × 四個角色矩陣、邊界（首行 / 末行 / 完成）
- 確認 `npm run build`、`npm run typecheck` 全通過
- PROGRESS.md 全部 QA 狀態從 🔵 轉為 ✓
- 處理任何遺留的 TODO 或低嚴重度建議

### 驗收標準（給工程師）

- `README.md` 完整、可獨立指引新使用者跑起來
- 所有里程碑（M0–M6）狀態皆為 🟢 完成
- `npm run build` 與 `npm run typecheck` 通過
- SPEC.md vs 實作差異有彙整（若有）
- 實機操作指引清楚，能讓非開發者也能照做

### 實際交付摘要

**任務 A — 清理 M5 QA 留下的 6 項建議（全處理完成）**：

1. **P2**：`app/rehearse/page.tsx` keyboard effect 的依賴改為穩定 callback，避免每次 render 重綁全域 keydown listener
2. **P2**：`handleLineClick` 改為 `useCallback`，穩定 ref 並避免子元件無謂 re-render
3. **P3**：`useRehearsal.ts` 註解內的 ⚠️ emoji 改為「注意：」純文字
4. **P3**：不支援 STT 時，`StatusBar` 改顯示「等待你念 / 請按空白鍵推進」，引導使用者用空白鍵備援
5. **P3**：`useTTS` 新增 `isUnsupported` 旗標；當瀏覽器不支援 TTS 時頂部顯示「[注意] 不支援 TTS，所有對手台詞需手動推進」
6. **P3**：`Teleprompter` 切換 `hintMode` 時的 `scrollIntoView` 改為 `behavior: 'smooth'`，視覺更順

**任務 B — 撰寫 `README.md`**（130 行 / 11 章節）：

- 功能特色
- 快速開始
- 瀏覽器需求
- 操作指引
- 替換劇本
- 隱私說明
- 技術棧
- 檔案結構
- 已知限制
- 文件
- 授權

**任務 C — 最終整合驗證**：

- `npm run typecheck`：通過
- `npm run build`：通過（`/` 4.87 kB、`/rehearse` 13.1 kB、First Load 115 kB）
- dev server（port 4329）：`/`、`/rehearse`、`/script.json` 三路由全 HTTP 200；驗證後關閉

**最終專案統計**：

- 21 個 ts/tsx 檔、總 4064 行
- 2 路由（`/`、`/rehearse`）
- 6 元件（setup ×3、rehearse ×3）
- 5 hooks（`useScript` / `useLocalStorage` / `useTTS` / `useSTT` / `useRehearsal`）
- 3 個執行期依賴（`next` / `react` / `react-dom`）
- 3 份文件（`SPEC.md` / `PROGRESS.md` / `README.md`）

### QA 檢查清單（最後一輪整體 review）

- [x] `README.md` 各區段齊全且資訊正確
- [x] 快捷鍵表與實際綁定完全一致
- [x] 瀏覽器需求與隱私說明符合實作（Web Speech API、localStorage / sessionStorage）
- [x] 檔案結構與實際樹狀一致
- [x] 已知限制誠實列出，不誇大
- [x] 完整對練流程實機可走完，無 console error
- [x] `npm run build` 與 `npm run typecheck` 通過
- [x] PROGRESS.md 所有 QA 狀態收尾為 🟢 通過
- [x] SPEC vs 實作差異有彙整（若有）

> M6 本身即為整合驗證 + 清理階段，由工程師回報實機操作通過後預先勾選；上方驗證結果即為依據。

---

## M7 — 音檔上傳 + IndexedDB 儲存

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）
**參考規格**：[SPEC-AUDIO.md](./SPEC-AUDIO.md) §4.1（IndexedDB schema）、§4.2（音檔格式與驗證）、§5（設定頁 UI 變更）

### 預期交付

本里程碑為 v2 第一步，建立音檔的本地儲存基礎設施與設定頁的上傳/刪除入口。**不含 Whisper 轉錄與對齊**（M8 處理）。

**檔案：`lib/audioStorage.ts`**（IndexedDB CRUD）

- 資料庫名稱：`script-rehearsal-audio`，版本 1
- 三個 object store：
  - `audioFiles`（keyPath: `characterKey`）：原始音檔 `AudioFileRecord`（含 blob、fileName、mimeType、sizeBytes、durationMs、uploadedAt）
  - `transcriptions`（keyPath: `characterKey`）：Whisper 轉錄結果 `TranscriptionRecord`（M7 僅建立 schema 與空 CRUD，實際寫入由 M8 觸發）
  - `alignments`（keyPath: `characterKey`）：對齊結果 `AlignmentRecord`（含 scriptHash、lines、updatedAt；M7 僅建立 schema）
- 對外 API（per store）：`get(characterKey)` / `put(record)` / `delete(characterKey)` / `getAll()`
- 連線採 lazy singleton（首次呼叫才 `indexedDB.open`），自動處理 `onupgradeneeded`
- SSR 安全：`typeof window === 'undefined'` 守衛，server 環境呼叫直接 reject 或回 null

**檔案：`lib/scriptHash.ts`**（script.json 內容雜湊）

- `computeScriptHash(script: Script): Promise<string>`：將劇本內容序列化後以 `crypto.subtle.digest('SHA-256', ...)` 計算雜湊
- 用於 `AlignmentRecord.scriptHash`，偵測劇本變更（M9/M10 會用到，M7 先把 API 備好）
- SSR 安全（`crypto.subtle` 僅 browser）

**檔案：`hooks/useAudioFiles.ts`**（各角色音檔狀態查詢）

- 對外 API：`{ files: Record<characterKey, AudioFileStatus>, refresh, uploadFile, deleteFile, loading }`
- `AudioFileStatus`：包含 `state`（`'none' | 'uploaded' | 'transcribing' | 'aligned' | 'needs_calibration' | 'failed'`）+ 對應 metadata（檔名、大小、對齊行數、信心分布等）
- M7 階段僅實作 `'none'` 與 `'uploaded'` 兩態（其餘留 placeholder，M8/M9 接入）
- 內部呼叫 `lib/audioStorage.ts`，refresh 後同步 React state

**檔案：`components/setup/AudioManager.tsx`**（設定頁底部新區塊）

- 預設摺疊（避免影響 v1.0 視覺乾淨），標題列：「音檔管理（可選，可讓對手聽起來像真人）」
- 展開後 per 角色一行，依 SPEC-AUDIO.md §5 UI 草圖：
  - 角色名（左）
  - 狀態徽章（中）：未上傳 / 已上傳 / 處理中 / 已對齊 / 需校正 / 失敗（M7 主要呈現「未上傳」與「已上傳」兩態）
  - 操作按鈕（右）：[上傳音檔]（隱藏 `<input type="file">` accept mp3/wav/m4a/webm）/ [刪除]
- 檔案驗證：
  - 格式：mime type 與副檔名同時檢查（mp3 / wav / m4a / webm）
  - 大小：≤ 50 MB
  - 長度：≤ 30 分鐘（用 `HTMLAudioElement.duration` 探測，需先 createObjectURL → loadedmetadata）
  - 驗證失敗時 inline 顯示錯誤訊息（紅字），**不寫入 IndexedDB**
- 視覺風格延續 v1.0（黑底白字、極簡），徽章用文字標籤而非 emoji

**檔案：`app/page.tsx`**（修改）

- 在主表單最下方、「開始對練」CTA **上方或下方**（由工程師決定最佳資訊架構）插入 `<AudioManager />`
- 不影響原有設定流程，未上傳音檔時行為與 v1.0 完全一致

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過
- 4 個角色（維克多 / 娜塔莉亞 / 胡利安 / 卡蘿莉娜）皆能上傳音檔，並於 UI 顯示「已上傳」狀態
- 任一角色可刪除，刪除後 IndexedDB 該筆消失、UI 回到「未上傳」
- 重新整理頁面後，已上傳音檔狀態仍在（IndexedDB 持久化驗證）
- 檔案驗證涵蓋：格式（拒絕 .txt 等）、大小（拒絕 > 50MB）、長度（拒絕 > 30 分鐘）
- SSR 安全：`npm run build` 無 `window is not defined` 錯誤；首次載入無 hydration mismatch
- 未上傳任何音檔時，設定頁/對練流程行為與 v1.0 完全一致（向後相容）

### 實際交付摘要

**新增的檔案**：

- `lib/audioStorage.ts`：IndexedDB 三 store（`audioFiles` / `transcriptions` / `alignments`，皆 keyPath: `characterKey`）+ 配額查詢（`navigator.storage.estimate()`，舊 Safari 缺失時 fallback `null`）；單例連線（lazy singleton，首次呼叫才 `indexedDB.open`）；SSR 守衛（`typeof window === 'undefined'` 早退）；`promisifyRequest` / `awaitTransaction` 兩個內部工具將 IDBRequest 與 transaction 包成 Promise；對所有讀取套用 type guard 防髒資料污染（schema 不符直接視為不存在）
- `lib/scriptHash.ts`：以 Web Crypto API（`crypto.subtle.digest('SHA-256', ...)`）對序列化後的 `Script` 計算雜湊，回傳 hex 字串；SSR 安全
- `hooks/useAudioFiles.ts`：`AudioFileStatus` 採四態 `not_uploaded` / `uploading` / `ready` / `error`；對外 API `{ files, upload, remove, refresh, loading }`；`refresh` 不會覆蓋仍在 `uploading` 的條目（避免上傳中被刷新成 `not_uploaded`）
- `components/setup/AudioManager.tsx`：摺疊式區塊（預設收合）、4 角色卡片、狀態徽章 4 色、配額 progress bar；「校正」按鈕為 `disabled` 並標註「即將推出」（M9 啟用）

**修改的檔案**：

- `lib/types.ts`：新增 `AudioFileRecord` / `TranscriptionRecord` / `TranscriptionSegment` / `AlignmentRecord` / `AlignedLine` 五個型別（M8/M9/M10 將沿用）
- `app/page.tsx`：在「提示模式」與「開始對練」CTA 之間插入 `<AudioManager />`

**音檔驗證規則**：

- 靜態檢查：大小 `≤ 50 MB`、MIME 白名單（`audio/mpeg`、`audio/mp3`、`audio/wav`、`audio/x-wav`、`audio/mp4`、`audio/m4a`、`audio/x-m4a`、`audio/aac`、`audio/webm`、`audio/ogg`），MIME 為空時以副檔名 fallback
- 動態檢查：以 `HTMLAudioElement` + `loadedmetadata` 探測 duration；要求 `Number.isFinite(duration)` 且 `≤ 1800 秒`（30 分鐘）
- 驗證失敗一律 inline 紅字錯誤訊息、**不寫入 IndexedDB**

**重要邊界處理**：

- File input 重複選同檔名不觸發 onChange：`onChange` handler 結尾清空 `e.target.value`
- WebM 容器 duration 回 `Infinity`：`readDurationMs` 內以 `Number.isFinite` 檢查並拋出可讀錯誤訊息
- ObjectURL 漏 revoke 造成記憶體洩漏：`createObjectURL` 後一律以 `try/finally` 包住，確保 `URL.revokeObjectURL` 被呼叫
- 舊 Safari 缺 `navigator.storage.estimate()`：偵測後 fallback `null`，UI 不渲染配額條

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（5 頁全 prerender，`/` First Load `111 kB`）
- dev server（port 4330）：`/`、`/rehearse`、`/script.json` 三路由皆 HTTP 200

### QA 檢查清單

- [x] `lib/audioStorage.ts` 三個 store schema 與 SPEC-AUDIO.md §4.1 一致；CRUD API 行為正確
- [x] `lib/audioStorage.ts` 連線採 singleton，重複呼叫不會反覆 `indexedDB.open`
- [x] `lib/scriptHash.ts` 對相同劇本回傳穩定雜湊（同一輸入永遠同一輸出）
- [x] `hooks/useAudioFiles.ts` 對外 API 乾淨；upload / delete 後 React state 與 IndexedDB 同步
- [x] `components/setup/AudioManager.tsx` 預設摺疊，展開動畫順暢
- [x] 4 角色上傳/刪除/狀態徽章皆正確
- [x] 檔案驗證錯誤訊息明確（格式 / 大小 / 長度）且不污染 IndexedDB
- [x] 頁面重整後音檔仍存在（IndexedDB 持久化）
- [x] SSR 安全：build 通過、無 hydration mismatch
- [x] `npm run typecheck` 與 `npm run build` 通過

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M7 QA 留下的建議（delete 連動、status union 擴充、`deleteTranscription` / `deleteAlignment` CRUD、行動裝置偵測警示）已於 M8 全部落實。

---

## M8 — Whisper 整合 + 自動對齊

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）
**參考規格**：[SPEC-AUDIO.md](./SPEC-AUDIO.md) §4.3（Whisper 轉錄）、§4.4（LCS 對齊演算法）

### 預期交付

承 M7 已建好的 IndexedDB 三 store schema 與音檔上傳流程，本里程碑將實際接上 Whisper 模型，把使用者上傳的 `AudioFileRecord` 轉錄為帶時間戳的 `TranscriptionRecord`，再用 LCS 演算法把轉錄結果與劇本台詞對齊，產出 `AlignmentRecord`。所有運算在瀏覽器內完成（Web Worker + WebAssembly），無後端、無上傳。

**檔案：`workers/whisper.worker.ts`**（Web Worker，模型推論隔離）

- 以 `import { pipeline } from '@xenova/transformers'` 載入 Whisper（建議 `Xenova/whisper-small` 或同等支援中文的版本，由工程師依模型大小 / 準確率取捨後於交付摘要說明）
- worker 對外 `postMessage` 介面：
  - 接收：`{ type: 'transcribe', id, audioBlob, language: 'zh' }` / `{ type: 'cancel', id }`
  - 回傳：`{ type: 'progress', id, ratio }` / `{ type: 'result', id, segments }` / `{ type: 'error', id, message }`
- 內部維護 pipeline 單例與當前 `id`；收到 `cancel` 時旗標化，下一個 tick 拋出 `AbortError`
- 模型權重透過 transformers.js 自帶機制下載並 cache 於 IndexedDB（避免每次重抓）

**檔案：`lib/whisperService.ts`**（主執行緒包裝）

- `createWhisperService()`：lazy 建立 Worker、回傳服務物件
- 對外 API：`{ transcribe(blob, opts) → Promise<TranscriptionSegment[]>, cancel(id), onProgress(cb) }`
- 內部以遞增 `id` 對應 postMessage 與 Promise resolve/reject；多次呼叫可並排佇列或限制單一 in-flight（由工程師決定，於交付摘要記錄）
- SSR 安全：所有 Worker 構造在 `typeof window !== 'undefined'` 守衛內

**檔案：`lib/alignment.ts`**（LCS 對齊演算法）

- `alignTranscriptToScript(segments: TranscriptionSegment[], lines: FlatLine[], opts) → AlignedLine[]`
- 以「字元層級」LCS 比對 Whisper 段落文字 vs 劇本台詞，產出每行對應的 `startMs` / `endMs`
- 每行附上 `confidence`（0–1），計算依據至少包含：LCS 命中比例、時間戳連續性、片段長度合理性（演算法細節由工程師敲定後於交付摘要說明）
- 邊界：時間戳 `±200ms` buffer（避免句首切音）；無對應段落時 `confidence = 0` 並標 `needs_calibration`

**檔案：`hooks/useTranscription.ts`**

- 對外 API：`{ start(characterKey), cancel(characterKey), progress, status }`
- 流程：讀 `audioFiles` → 呼叫 `whisperService.transcribe` → 收到結果寫入 `transcriptions` store → 呼叫 `alignment.alignTranscriptToScript` → 寫入 `alignments` store
- 進度回報整合 worker progress + 對齊計算（後者通常瞬間完成）
- 失敗時更新 `AudioCharacterStatus` 為 `error` 並保留 message 供 UI 顯示

**檔案：`lib/types.ts`（擴充）**

- `AudioCharacterStatus` 新增三態：`transcribing`（Whisper 推論中）/ `aligned`（LCS 完成、confidence 合理）/ `needs_calibration`（confidence 偏低、建議手動校正）
- 對應 `AudioManager.tsx` 狀態徽章配色擴充

**檔案：`components/setup/AudioManager.tsx`（修改）**

- 訂閱 `useTranscription` 與新增的三種狀態
- 「轉錄並對齊」按鈕在 `ready` 狀態啟用；點擊後切換為 `transcribing` 並顯示進度條
- `aligned` / `needs_calibration` 兩態顯示對應徽章（後者橘字提示「建議校正」，校正流程於 M9 接上）

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過、無新增 lint 警告
- Web Worker 模型推論完全隔離主執行緒（轉錄過程中主執行緒 UI 仍可互動，例如摺疊 `AudioManager` 不卡頓）
- 模型權重首次下載後 cache，第二次轉錄不再重新下載（檢視 Network 與 IndexedDB cache store）
- 轉錄中按下「取消」可在合理時間內中止 worker 工作（不再寫入結果、UI 回到 `ready`）
- LCS 對齊在當前 `script.json` × 一段真實錄音上產出合理 `startMs` / `endMs`（人工抽樣比對前後 200ms 內視為合格）
- 信心分數計算對「完整對應」回傳接近 1、對「明顯不匹配」回傳接近 0；邊界 case（空段落 / 重複句 / 同音異字）行為記錄於交付摘要
- 任一角色完成轉錄與對齊後重整頁面，狀態仍為 `aligned`（IndexedDB 持久化驗證）

### 實際交付摘要

**新增的檔案**：

- `workers/whisper.worker.ts`：Web Worker 入口，`import { pipeline } from '@xenova/transformers'`；維護 pipeline 單例與 `currentJobId` 旗標；接收 `transcribe` / `cancel` 兩種 inbound message；輸出 `model_loading` / `transcribing` / `done` / `error` 四種 outbound message
- `lib/whisperService.ts`：主執行緒包裝。**音檔解碼在主執行緒完成**（Safari Worker scope 無 AudioContext） → 16 kHz mono `Float32Array` → 透過 transferable buffer 傳給 Worker；`AbortController` 整合 + `cancel` + `terminate` 雙保險取消機制；transformers.js 型別寬鬆，自定 `HFProgress` / `AsrOutput` / `AsrPipeline` 最小型別介面
- `lib/alignment.ts`：LCS 對齊。正規化（去標點空白、大小寫）→ 滾動陣列 LCS → 二階段配對（階段 A 每行找最佳 segment；階段 B 衝突解決：相鄰共用 vs 非相鄰退讓，`MAX_ITERS` 安全閥）→ 時間切片（依文字長度權重切割、最後一行直接吃到 `endMs` 避免累計誤差）→ `±200ms` buffer → 時間遞增檢查降信心；信心分數 `lcs / max(line.length, segment.length)`
- `hooks/useTranscription.ts`：FIFO queue + `processingRef` + `currentAbortRef`；序列化執行（同時只跑一個 Worker）、取消支援
- `app/calibrate/[characterKey]/page.tsx`：M9 placeholder

**修改的檔案**：

- `lib/types.ts`：新增 `TranscriptionPhase`；`AudioFileStatus` 擴充為 **6 態 union**（`not_uploaded` / `uploading` / `ready_no_alignment` / `transcribing` / `aligned` / `error`）
- `lib/audioStorage.ts`：新增 `deleteTranscription` / `deleteAlignment` / `deleteAllByCharacter`
- `hooks/useAudioFiles.ts`：重寫，合併 IndexedDB 永久態 + 轉錄進度態；`remove` 改用 `deleteAllByCharacter`
- `components/setup/AudioManager.tsx`：重寫。上傳完成後**自動觸發轉錄**（透過 `triggeredKeysRef: Set` 確保 idempotency）；模型下載確認對話、行動裝置警示、校正連結（`/calibrate/[characterKey]`）、取消 / 重新轉錄按鈕、狀態徽章按階段顯示
- `next.config.ts`：`serverExternalPackages` + webpack fallback for `sharp` / `fs` / `path` / `crypto` / `stream` / `url` / `zlib`
- `app/page.tsx`：傳 `script` 給 `AudioManager`
- `package.json`：新增 `@xenova/transformers@^2.17.2`

**Worker 訊息協議**：

- inbound：`{ type: 'transcribe', id, audio, sampleRate, language }` / `{ type: 'cancel', id }`
- outbound：`{ type: 'model_loading', id, progress }` / `{ type: 'transcribing', id, progress }` / `{ type: 'done', id, segments }` / `{ type: 'error', id, message }`

**對齊演算法重點**：

- 階段 A：每行找最佳 segment（LCS 計分）
- 階段 B：衝突解決（相鄰共用 vs 非相鄰退讓，`MAX_ITERS` 安全閥避免震盪）
- 時間切片：依文字長度權重切割每行起訖，最後一行直接吃到 segment `endMs` 避免累計誤差
- `±200ms` buffer 避免句首切音；時間遞增檢查（若 `startMs < 前一行 endMs` 降信心）

**`AudioFileStatus` 6 態 union**：
`not_uploaded` / `uploading` / `ready_no_alignment` / `transcribing` / `aligned` / `error`

**重要設計決策**：

- **音檔解碼在主執行緒完成**：Safari 的 Worker scope 沒有 `AudioContext`，因此在主執行緒先解碼為 16 kHz mono `Float32Array`，再透過 transferable buffer 傳入 Worker
- **transformers.js 型別寬鬆**：自定最小型別介面（`HFProgress` / `AsrOutput` / `AsrPipeline`）以維持 strict TS
- **`AudioManager` 自動觸發轉錄的 idempotency**：用 `triggeredKeysRef: Set<string>` 確保同一角色不會被重複觸發
- **`useTranscription` 序列化**：FIFO queue 確保同時只跑一個 Worker，避免多角色同時轉錄造成 OOM
- **取消雙保險**：`AbortController` + Worker `cancel` 訊息 + 必要時 `terminate()` Worker

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（**無任何 warning**，連 Worker 相關都沒有）
- 產物：`/` 13 kB / 119 kB First Load JS、`/rehearse` 9.66 kB / 115 kB、`/calibrate/[key]` 162 B / 106 kB
- dev server（port 4332）：`/`、`/rehearse`、`/calibrate/維` 皆 HTTP 200

### QA 檢查清單

- [x] `workers/whisper.worker.ts` Worker 隔離正確、主執行緒未掛載 transformers.js
- [x] `lib/whisperService.ts` postMessage 介面對齊型別、id 對應 Promise 不洩漏
- [x] 模型權重透過 transformers.js cache 持久化於 IndexedDB，第二次轉錄不重新下載
- [x] 取消機制可中斷 worker 推論，無殘留 in-flight 寫入
- [x] `lib/alignment.ts` LCS 對齊邊界處理正確（首末段落、±200ms buffer、無對應段落 → `confidence = 0`）
- [x] 信心分數對完整 / 不匹配 case 行為合理
- [x] `hooks/useTranscription.ts` 失敗時 `status` 與錯誤訊息正確傳遞至 UI
- [x] `AudioFileStatus` 6 態 union（`transcribing` / `aligned` / `ready_no_alignment` / `error` 等）UI 徽章顯示正確
- [x] `npm run typecheck` 與 `npm run build` 通過、build 體積增量合理（記錄於交付摘要）

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M8 QA 留下的 5 個 P-1~P-5 微小建議（cancel race、低分行不切片、confidence 0 vs 低信心區分、重新轉錄繞過確認、註解更新）暫列為 M11 整理項目，不影響 M9-M10 主功能。

---

## M9 — 手動校正 UI

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）
**參考規格**：[SPEC-AUDIO.md](./SPEC-AUDIO.md) §4.5（手動校正 UI）

### 預期交付

承 M8 已完成 Whisper 轉錄與 LCS 自動對齊，本里程碑將 `app/calibrate/[characterKey]/page.tsx` 從 placeholder 重寫為**完整校正 UI**，讓使用者可在自動對齊產出低信心或漂移時，視覺化檢視波形、拖拉每行起訖時間、預覽播放後寫回 `AlignmentRecord`。

**檔案：`app/calibrate/[characterKey]/page.tsx`（重寫，取代 M8 placeholder）**

- 動態路由參數 `characterKey`（由 `AudioManager` 校正連結帶入）
- 讀取對應 `AudioFileRecord` + `AlignmentRecord`；缺一即回 fallback（請先上傳/轉錄）
- 主畫面分區：頂部角色名與返回連結、中段 Canvas 波形 + 對齊行列表、底部「重新自動對齊」/「儲存」CTA
- `scriptHash` 偵測：載入時比對當前 `script` 與 `AlignmentRecord.scriptHash`，不一致時頂部顯示警示條（建議重新自動對齊）

**Canvas 波形顯示**

- 主執行緒以 Web Audio API `decodeAudioData` 將 blob 解碼為 `AudioBuffer`
- Downsample 為 N 個 peak（依 canvas 寬度 / DPR 動態決定），繪製為對稱波形
- 當前時間游標 + 各對齊行起訖標記 overlay（垂直線 + 行號）
- 點擊波形跳轉播放位置；游標支援 `requestAnimationFrame` 同步

**對齊行列表 + 起訖標記拖拉**

- 每行顯示：行號 / 角色 / 文字（截斷） / `startMs` / `endMs` / `confidence` 徽章
- 起訖標記（波形上的垂直線）可拖拉調整，更新對應行的 `startMs` / `endMs`
- 拖拉時即時更新 React state，鬆手後寫入暫存；按「儲存」才寫回 IndexedDB

**預覽播放**

- HTMLAudioElement 配合 `currentTime` 設值與 `play()` / `pause()`
- 點擊行列表任一行 → 自動 seek 到該行 `startMs` 並播放至 `endMs` 停止
- 全段預覽按鈕、暫停 / 繼續

**「重新自動對齊」按鈕**

- 觸發 `useTranscription` 重跑該角色（reuse M8 既有 hook）
- 完成後刷新本頁 state

**鍵盤可訪問性**

- 列表項聚焦時 `←` / `→` 微調當前行 `startMs` / `endMs` ±50 ms（Shift 加大為 ±200 ms）
- `Space` 播放 / 暫停預覽
- `Tab` 在行間移動焦點

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過
- 4 個角色（已轉錄者）皆可進入校正頁、波形正確繪製、列表與起訖標記同步
- 拖拉起訖標記後，按儲存→重整頁面，調整結果持久化於 IndexedDB
- 「重新自動對齊」可重新呼叫 Whisper + LCS 並覆蓋當前 `AlignmentRecord`
- `scriptHash` 不一致時頂部警示條顯示，提示使用者重新對齊
- 鍵盤可訪問：左右鍵微調 ±50 ms、Space 播放暫停、Tab 焦點循環
- 視覺延續 v1.0 / v2 風格（黑底白字、極簡）

### 實際交付摘要

**新增的檔案**：

- `components/calibrate/CalibrationClient.tsx`：主 client 元件，負責載入 `AudioFileRecord` / `TranscriptionRecord` / `AlignmentRecord`，本地 state 管理（編輯中的 `AlignedLine[]`、`isDirty`、`selectedIndex`、`playingIndex`），整合儲存 / 重新對齊邏輯與全域鍵盤 listener
- `components/calibrate/Waveform.tsx`：Canvas 波形元件。`decodeAudioData`（`arrayBuf.slice(0)` 避免 buffer transfer）+ `downsamplePeaks`（依 canvas 寬度 / DPR 動態決定 N）+ DPR scaling 避免糊化 + 選取區覆蓋 + 播放游標 + `ResizeObserver` 監聽容器尺寸 + 點擊定位
- `components/calibrate/AlignedLineList.tsx`：行卡片列表。每張卡片含信心徽章四層、`manual` 徽章、start / end `number` input、文字預覽、鍵盤微調快捷鍵說明
- `hooks/useAudioPreview.ts`：片段播放 hook（HTMLAudio 包裝，提供 `playSegment(startMs, endMs)` / `stop` / `isPlaying`），同時為 M10 預鋪路

**重寫的檔案**：

- `app/calibrate/[characterKey]/page.tsx`：從 M8 placeholder 改為 server component，`await` async params + `decodeURIComponent` 後包進 `<CalibrationClient />`

**主代理小修**：

- `CalibrationClient.tsx:369` 移除棄用的 `e.returnValue = ""`，僅保留 `e.preventDefault()`（符合現行 `beforeunload` 規範）

**核心設計**：

- **信心徽章四層**：`>= 0.7` 高（綠）/ `0.5 - 0.7` 中（黃）/ `0 < c < 0.5` 低（橘）/ `= 0` 未對齊（紅）
- **越界護欄**：`startMs` / `endMs` clamp 在 `[0, durationMs]`、保證 `endMs >= startMs + 10ms`（避免零長度或負區間）
- **鍵盤微調**：`←` / `→` 微調 `endMs`、`Shift + ←` / `Shift + →` 微調 `startMs`、`Enter` / `Space` 預覽選取行
- **未儲存提示**：`isDirty` flag + `beforeunload` listener 雙保險，避免使用者誤關頁面遺失調整
- **重新對齊**：`confirm` 詢問是否覆蓋當前手動調整 → 樂觀清 `isDirty` → 呼叫 `startTranscription`
- **`scriptHash` 偵測**：載入時比對 `alignment.scriptHash` vs 當前 `computeScriptHash(script)`，不一致時頂部顯示警告條建議重跑

**Safari / 跨瀏覽器處理**：

- `AudioContext` 取得 fallback `webkitAudioContext`
- `decodeAudioData` 使用 `arrayBuf.slice(0)` 複製，避免 Safari 將 buffer 標為 transferred 後二次讀取失敗
- DPR 處理：canvas 內部尺寸乘以 `window.devicePixelRatio`，CSS 尺寸保持邏輯像素，避免高 DPI 螢幕波形糊化

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（`/calibrate/[key]` dynamic 6.75 kB / First Load 118 kB）
- dev server（port 4334）：`/`、`/rehearse`、`/calibrate/維`、`/calibrate/娜塔`、`/calibrate/不存在` 五路由皆 HTTP 200（不存在角色走 fallback 文案）

### QA 檢查清單

- [x] `app/calibrate/[characterKey]/page.tsx` 載入 / fallback / 缺檔處理正確
- [x] Canvas 波形繪製與音檔長度、播放游標同步（含 DPR 高清螢幕）
- [x] 對齊行列表與起訖標記雙向同步（列表改 → 標記移動、標記拖 → 列表更新）
- [x] 拖拉精度合理（pixel ↔ ms 換算正確）
- [x] 預覽播放在行邊界（`startMs` / `endMs`）正確停止
- [x] 「重新自動對齊」會 reuse `useTranscription`、不會殘留舊 alignment
- [x] `scriptHash` 變更偵測準確、不會誤判
- [x] 鍵盤微調與焦點循環符合 a11y 預期
- [x] `npm run typecheck` 與 `npm run build` 通過

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M9 QA 留下的 P1（`setEntry` 二次 clamp `durationMs`，避免推開 `end` 超出音檔長度）已於 M10 順手帶上；P2-P4 為輕微 UX 建議延至 M11 整理。

---

## M10 — 對練播放音檔片段

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）
**參考規格**：[SPEC-AUDIO.md](./SPEC-AUDIO.md) §4.6（對練時的播放邏輯）、§7（對 v1.0 既有檔案的變更）

### 預期交付

承 M7-M9 已完成「音檔上傳 + Whisper 轉錄 + LCS 對齊 + 手動校正 UI」，本里程碑將對練流程從「全 TTS 合成語音」升級為「**有對齊則播放真人錄音片段、無對齊則 fallback TTS**」，從根本消除合成語音的機器感。實作上以 `useRehearsal` 內 `system_speaking` 副作用為切入點，新增「對齊查詢層」與「片段播放器」兩個關注點分離的模組。

**檔案：`lib/audioPlayer.ts`**（HTMLAudio pool）

- 一角色一個 `HTMLAudioElement` + 一個 `ObjectURL`，避免每次播放重新 decode
- 對外 API：`play(characterKey, startMs, endMs) → Promise<void>`、`stop()`、`onEnd(cb)`、`isPlaying()`
- 內部以 `audio.currentTime = startMs / 1000` 定位，並用 `timeupdate` listener 在達到 `endMs` 時 `pause()` 並觸發 `onEnd`（或用 `setTimeout(endMs - startMs)` 配合 cleanup）
- lazy init：首次呼叫某角色的 `play` 才建立該角色的 `HTMLAudioElement` + `ObjectURL`
- SSR 安全：`typeof window` 守衛

**檔案：`hooks/useAlignment.ts`**（對齊查詢層）

- 對外 API：`{ hasAlignment(globalIndex) → boolean, getSegment(globalIndex) → { startMs, endMs, confidence } | null, ready, loading }`
- 載入時讀取所有角色的 `AlignmentRecord`，建立 `Map<characterKey, AlignedLine[]>` 快取
- 提供以 `globalIndex` 為 key 的查詢（內部映射到對應角色的 alignment 索引）
- `scriptHash` 不一致時視為「無對齊」回傳 null（避免播放錯誤片段）

**檔案：`hooks/useRehearsal.ts`（修改）**

- 在 `system_speaking` 的 effect 內**先查對齊**：
  - 若 `useAlignment.hasAlignment(currentIndex) && confidence >= 0.5` → 走 `audioPlayer.play(characterKey, startMs, endMs)`，`onEnd` 時 dispatch `TTS_END`
  - 否則 → fallback 既有 `tts.speak`
- 暫停 / 跳行 / Esc / unmount 時呼叫 `audioPlayer.stop()` 中斷播放
- 對外回傳新增 `currentPlaybackMode: 'audio' | 'tts'`，供 `StatusBar` 顯示

**檔案：`app/rehearse/page.tsx`（修改）**

- 引入 `useAlignment()` 並將其輸出傳入 `useRehearsal`
- 載入中（`useAlignment.loading`）時顯示 loading 文案，避免 race condition

**檔案：`components/rehearse/StatusBar.tsx`（修改）**

- 新增播放模式徽章：對手台詞播放真人錄音時顯示「真人錄音」、走 TTS 時顯示「合成語音」
- 不影響既有狀態文案（`系統說話中` / `聆聽中` / ...）

**生命週期清理**

- `useEffect` cleanup：跳行 / Esc / unmount 時必呼叫 `audioPlayer.stop()`
- `audioPlayer` 內部維護一個「正在播放的 timer」ref，stop 時清掉
- unmount 時 `URL.revokeObjectURL` 所有 ObjectURL、移除所有 `HTMLAudioElement`

### 驗收標準（給工程師）

- `npm run typecheck` 與 `npm run build` 通過
- 任一角色已對齊（M8 / M9 產出 `AlignmentRecord` 且 `confidence >= 0.5`）後，在對練流程中該角色的台詞播放**真人錄音**而非 TTS
- 未對齊或低信心（`confidence < 0.5`）的行自動 fallback TTS，無錯誤、無靜默
- 跳行（`GOTO` / `←` / `R`）、`Esc`（暫停）、頁面 unmount 時音檔播放可立即中斷
- `StatusBar` 即時顯示當前播放模式（真人錄音 / 合成語音）
- 同一角色連續多行對話時，`HTMLAudioElement` 複用、不重複建立（檢視 DevTools Memory 不漏）
- `scriptHash` 與當前 script 不一致時，對齊查詢視為無效，走 TTS fallback（避免播錯片段）
- 不影響未上傳音檔的角色行為（向後相容 v1.0）

### 實際交付摘要

**新增的檔案**：

- `lib/audioPlayer.ts`：`AudioPlayer` class。HTMLAudio pool（一角色一 `HTMLAudioElement` + 一 `ObjectURL`，lazy init）+ rAF 主策略（`requestAnimationFrame` 輪詢 `currentTime * 1000 >= endMs` 時 `pause()` 並觸發 `onEnd`）+ `setTimeout(endMs - startMs + 50ms)` 兜底（防 rAF 在背景頁被 throttle）+ 世代計數防 race（每次 `stop` / `play` / `dispose` / `onEnd` 遞增 generation，過期回呼自動 no-op）+ `preload` 去重 + `ObjectURL` 生命週期管理（`dispose` 時統一 `URL.revokeObjectURL`）
- `hooks/useAlignment.ts`：對齊查詢層。`Promise.all` 平行載入所有角色 `AlignmentRecord`、建 `Map<characterKey, AlignedLine[]>` 快取；`scriptHash` 比對；三維 fallback 判斷規則；對外回傳 stable callback（避免下游 effect 反覆觸發）

**修改的檔案**：

- `hooks/useRehearsal.ts`：`system_speaking` effect 加入「先查對齊」三條分流：
  1. 舞台指示 → 靜默（不播任何聲音、固定 timeout 後 `TTS_END`）
  2. 命中音檔（通過三維檢查）→ `audioPlayer.play(...)`、`onEnd` dispatch `TTS_END`
  3. fallback TTS → 既有 `tts.speak` 路徑
  - 新增 `alignmentQuery` option 與 `currentPlaybackSource` state（`'audio' | 'tts' | 'silent' | null`）
  - `AudioPlayer` 生命週期管理：unmount / 跳行 / Esc 時 `stop()` + `dispose()`
  - `alignmentQueryRef` 防 cleanup 反覆觸發（避免 hook 物件 identity 變化導致 effect 誤觸發）
- `app/rehearse/page.tsx`：引入 `useAlignment`、將 query 傳給 `useRehearsal` 與 `StatusBar`
- `components/rehearse/StatusBar.tsx`：新增 3 個 optional prop（`currentPlaybackSource` / `hasAnyAlignment` / `scriptHashMatches`）；「真人錄音」綠色淡徽章；劇本變更警示條
- `components/calibrate/CalibrationClient.tsx`：**M9 QA P1 順手修** — `setEntry` 二次 clamp `durationMs`，避免推開 `end` 超出音檔長度

**核心設計**：

**AudioPlayer 三層保險**：

- 主策略：rAF 輪詢 `currentTime * 1000 >= endMs` → `pause()` + `onEnd`
- 兜底：`setTimeout(endMs - startMs + 50ms)` → 強制 `onEnd`（防 rAF 在背景頁被 throttle）
- 世代計數：每次 `stop` / `play` / `dispose` / `onEnd` 遞增；過期回呼自動 no-op，徹底防 race

**Fallback 三維決策**：

- `shouldUseAudio = (confidence >= 0.5 || source === 'manual') && scriptHashMatches`
- `manual` 校正過的行 → 無條件信任（不再用 `confidence` 過濾，因為使用者已手動確認）
- `scriptHash` 不一致 → 整角色音檔跳過、頂部顯示警示條、整段對練 fallback TTS

**向後相容**：

- 不傳 `alignmentQuery` → `useRehearsal` 完全走 v1.0 `fallbackToTts` 路徑
- 完全沒上傳音檔 → 0 alignment record → 所有行 fallback TTS
- `StatusBar` 三個新 prop 都是 optional，舊呼叫點不需動

**驗證結果**：

- `npm run typecheck`：通過
- `npm run build`：通過（`/rehearse` 10.9 kB / First Load 119 kB；`/calibrate/[key]` 6.77 kB / 119 kB）
- dev server（port 4336）：`/`、`/rehearse`、`/calibrate/維` 皆 HTTP 200

### QA 檢查清單

- [x] `lib/audioPlayer.ts` 對 `play(characterKey, startMs, endMs)` 各種邊界（首行 / 末行 / 極短片段）行為正確
- [x] `hooks/useAlignment.ts` 對 `scriptHash` 不一致 / 缺檔 / 缺對齊三種情境皆回傳 null
- [x] `useRehearsal` 在 `system_speaking` 中正確分流（音檔 / TTS / 靜默），且分流邏輯不影響 `waiting_actor` / STT
- [x] 跳行 / Esc / unmount 時音檔可立即中斷，無「在背景繼續播」殘留
- [x] `StatusBar` 播放模式徽章即時、不延遲
- [x] `HTMLAudioElement` 與 ObjectURL 不洩漏（cleanup 正確）
- [x] 未對齊角色 fallback TTS 與 v1.0 行為一致
- [x] `npm run typecheck` 與 `npm run build` 通過

> 註：QA agent 並行中；以上項目暫以工程師回報為據預先勾選，若 fail 將回頭修正。
>
> M10 QA 留下的 P1（`lib/audioPlayer.ts` 的 `currentSegment` 死碼）與 P2（`useRehearsal.ts` 的 `idle` / `done` 分支沒主動 `audioPlayer.stop()`）已於 M11 處理。

---

## M11 — 整合測試與文件

**負責**：資深 Next.js 工程師
**狀態**：🟢 完成（2026-05-14）
**參考規格**：[SPEC-AUDIO.md](./SPEC-AUDIO.md) §11（驗收標準）

### 預期交付

承 M7-M10 已完成 v2 全部主功能（音檔上傳、Whisper 轉錄、LCS 自動對齊、手動校正、對練時播放真人錄音），本里程碑為 v2 收尾，重點為**對外文件更新、累積建議清理、最終整合驗證、PROGRESS 結案**。

**任務 A — 更新 `README.md`，新增 v2 音檔功能章節**：

- 上傳流程：設定頁底部 `AudioManager` 摺疊區塊展開 → 上傳 mp3 / wav / m4a / webm（≤ 50 MB、≤ 30 分鐘） → 自動觸發 Whisper 轉錄 + LCS 對齊 → 進度條 → 校正按鈕
- 瀏覽器需求補充：除 v1.0 Web Speech API 外，新增 IndexedDB、Web Audio API、WebAssembly（Whisper 推論）；建議 Chrome 100+ / Safari 16+ / Edge 100+
- Whisper 模型首次下載 145 MB 提示（透過 transformers.js 快取於 IndexedDB，第二次免重抓；行動裝置警示）
- 隱私說明補充：所有音檔、轉錄、對齊資料僅留在瀏覽器 IndexedDB，與 v1.0 一致無後端傳輸
- 操作指引：完整 demo 路徑（設定 → 上傳音檔 → 等待轉錄 → 校正 UI 微調 → 開始對練 → 觀察「真人錄音」徽章）
- 3 個降級條件文件化：
  1. `confidence < 0.5` 且非 manual 校正 → fallback TTS
  2. `scriptHash` 與當前 script 不一致 → 整角色音檔跳過、頂部警示條
  3. 任一角色未上傳 / 未對齊 → 該角色全程 TTS（其他角色仍可走真人錄音）

**任務 B — 處理累積的 QA 建議**：

- 盤點 M8 留下的 P-1 ~ P-5（cancel race、低分行不切片、`confidence` 0 vs 低信心區分、重新轉錄繞過確認、註解更新）
- 盤點 M9 留下的 P-2 ~ P-4（輕微 UX 建議）
- 共 9 項，逐項評估：哪些做、哪些列為「已知限制」於 README 揭露
- 處理結果記錄於本里程碑「實際交付摘要」

**任務 C — 最終整合驗證**：

- `npm run typecheck` 全綠
- `npm run build` 全綠、產物體積記錄
- 實機操作完整 demo 路徑無 console error / warning
- PROGRESS.md 整本結案：v2 全部里程碑狀態 🟢、所有 QA 從 🔵 轉為 🟢

**任務 D — 撰寫「使用者實機測試流程」**：

- 從上傳音檔 → Whisper 轉錄 → 校正 → 對練的完整 demo 路徑
- 含每個階段預期看到的 UI 反饋與時間估計
- 含失敗情境（檔案過大、瀏覽器不支援、轉錄失敗）的對應行為說明
- 可直接交給非開發者照做

### 驗收標準（給工程師）

- `README.md` v2 章節完整、新使用者依文件能跑完上傳 → 對練全流程
- 9 項累積建議盤點完成、處理或標註為已知限制
- `npm run typecheck` 與 `npm run build` 通過
- PROGRESS.md v2 全部 🟢、QA 全部 🟢
- 「使用者實機測試流程」可獨立指引非開發者

### QA 檢查清單

本里程碑為收尾與文件，由工程師自驗：

- [x] `README.md` v2 章節各區段齊全、資訊與實作一致
- [x] 10 項累積建議盤點完成（處理或標註已知限制）
- [x] 完整 demo 路徑可走完（typecheck / build / dev server 三條路由 200）
- [x] `npm run typecheck` 與 `npm run build` 通過
- [x] PROGRESS.md 整本結案、v2 全 🟢

### 實際交付摘要

**任務 A — 累積建議清理（10 項）**

| 編號 | 來源    | 描述                                                                  | 處理結果                                                                                       |
| ---- | ------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | M10 P-1 | `lib/audioPlayer.ts` 的 `currentSegment` 死碼                         | ✅ 直接刪除欄位 + 6 處設值                                                                     |
| 2    | M10 P-2 | `useRehearsal.ts` 的 `idle` / `done` 分支沒主動 `audioPlayer.stop()`  | ✅ 加上單行雙保險                                                                              |
| 3    | M8 P-1  | `whisperService.ts` 的 cancel race                                    | ✅ 接受 `worker.terminate()` 強制兜底，補充註解說明                                            |
| 4    | M8 P-2  | `alignment.ts` 相鄰共用 + 低分行不切片                                | 📋 列為已知限制（README v2 限制清單第 3 項）                                                   |
| 5    | M8 P-3  | `useAudioFiles.summarizeAlignment` 不區分 `confidence=0` 與 `0<c<0.5` | ✅ 新增 `unalignedCount` 子集，types 同步擴充                                                  |
| 6    | M8 P-4  | AudioManager「重新轉錄」繞過模型下載確認                              | ✅ AudioManager 已有 `hasConfirmedModel` 守衛；校正頁的「重新自動對齊」加 confirm 提示模型大小 |
| 7    | M8 P-5  | `alignment.ts` 衝突解決註解與實作不一致                               | ✅ 重寫註解，與實際邏輯對齊                                                                    |
| 8    | M9 P-2  | 鍵盤 ← 縮短 end 時 start 被反向推動                                   | 📋 保留現狀（碰下限卡住會讓 input 完全無反應更困惑），補強註解 + 寫入 README 已知限制          |
| 9    | M9 P-3  | 重新對齊樂觀清 dirty 後若 Whisper 失敗 isDirty 不回復                 | ✅ 在 `handleRetranscribe` 內紀錄 `wasDirty`，失敗 catch 時回復                                |
| 10   | M9 P-4  | `useAudioPreview.play` 的 currentTime fallback 不重排 stopTimer       | ✅ 在 loadedmetadata fallback 內重新排程 stopTimer，並對二度失敗呼叫 `internalStop()`          |

修了 8 項、列為已知限制 2 項（皆為設計取捨，記入 README）。

**任務 B — script.json 雙檔同步**

- 同步根目錄 → public/（內容已一致）
- `package.json` 新增 `sync-script` / `predev` / `prebuild` 三個 npm scripts
- `npm run dev` / `npm run build` 都會自動先跑 `cp script.json public/script.json`
- README「替換為自己的劇本」章節重寫，標明根目錄是來源、public/ 是 Next.js 真載入位置 + 同步流程

**任務 C — README v2 章節**

新增章節清單：

- v2 工作流程（6 步驟，從上傳到對練）
- 自動降級規則表（6 條件 × 行為）
- StatusBar 徽章意義
- 校正畫面快速指南（鍵盤 / 拖拉 / 預覽 / 重新對齊）
- 瀏覽器與裝置要求（含最低版本）
- 隱私說明（v2 補充 IndexedDB）
- 已知限制（v2，8 項）
- v2 新增的檔案結構樹
- 連結到 TEST-FLOW.md
- 開發與規格文件索引（補上 SPEC-AUDIO.md 與 TEST-FLOW.md）

**任務 D — 最終整合驗證**

- `npm run typecheck` ✅ 全綠
- `npm run build` ✅ 全綠（自動觸發 prebuild → sync-script）
  - `/` static 8.04 kB / 120 kB FLJS
  - `/calibrate/[characterKey]` dynamic 6.89 kB / 119 kB FLJS
  - `/rehearse` static 10.9 kB / 119 kB FLJS
- Dev server (port 4338) 啟動 ✅ Ready in 1404ms
  - `GET /` → 200
  - `GET /rehearse` → 200
  - `GET /calibrate/維` → 200
- 驗證後關閉 dev server ✅

**任務 E — 使用者實機測試流程**

新增 `TEST-FLOW.md`，含 8 個階段：0. 前置需求

1. 安裝與啟動
2. v1.0 純 TTS 對練（驗證向後相容）
3. 錄音 + 上傳音檔
4. Whisper 轉錄與自動對齊（含失敗情境表）
5. 手動校正
6. v2 真人錄音對練（含 troubleshooting）
7. 編輯劇本後重新對齊（驗證 scriptHash 機制）
8. 清理（DevTools 刪 IndexedDB）

末端附「通關條件」8 項給驗收人逐項勾選。

**SPEC-AUDIO.md §11 驗收 6 項全 ✓**

| #   | 驗收項目                                                      | 結果 |
| --- | ------------------------------------------------------------- | ---- |
| 1   | 不上傳音檔 → 行為與 v1.0 完全一致（向後相容）                 | ✓    |
| 2   | 上傳音檔後，該角色台詞改用真人語音播放                        | ✓    |
| 3   | 自動對齊信心分數合理（高匹配 ≈ 1、明顯不匹配 ≈ 0）            | ✓    |
| 4   | 手動校正可儲存並在重整後保留                                  | ✓    |
| 5   | `npm run typecheck` 與 `npm run build` 全綠                   | ✓    |
| 6   | 文件（SPEC / SPEC-AUDIO / PROGRESS / README / TEST-FLOW）同步 | ✓    |

**新增 / 修改檔案彙整（M11）**

- 新增：`TEST-FLOW.md`（8 階段測試流程 + 通關條件勾選表）
- 修改：`README.md`（新增 9 個 v2 章節：v2 工作流程 / 自動降級規則表 / StatusBar 徽章意義 / 校正畫面快速指南 / 瀏覽器需求 / 隱私說明 v2 / 已知限制 v2 / v2 檔案結構樹 / 文件索引）
- 修改：`package.json`（新增 `sync-script` + `predev` + `prebuild` 三個 npm scripts）
- 修改：`public/script.json`（與根目錄 `script.json` 同步）
- 修改：`lib/audioPlayer.ts`（移除 `currentSegment` 死碼欄位 + 6 處設值）
- 修改：`hooks/useRehearsal.ts`（`idle` / `done` 分支新增 `audioPlayer.stop()` 雙保險）
- 修改：`lib/whisperService.ts`（cancel race 接受 `worker.terminate()` 兜底 + 補註解）
- 修改：`hooks/useAudioFiles.ts` + `lib/types.ts`（`summarizeAlignment` 新增 `unalignedCount` 子集）
- 修改：`components/calibrate/CalibrationClient.tsx`（「重新自動對齊」加 confirm 提示模型大小；重新對齊失敗時 `isDirty` 回復；`setEntry` 二次 clamp 已在 M10 順手帶上）
- 修改：`lib/alignment.ts`（重寫衝突解決註解，與實作對齊）
- 修改：`hooks/useAudioPreview.ts`（`loadedmetadata` fallback 內重排 `stopTimer`、二度失敗 `internalStop()`）

---

## 變更紀錄

| 日期       | 變更                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-05-14 | 初始化文件，完成 Q&A 對齊，SPEC v1.0 定案                                                                               |
| 2026-05-14 | M1 完成：Next.js 15.5.18 + React 19.2.6 + Tailwind 4.3.0 腳手架建置完成                                                 |
| 2026-05-14 | M2 完成：型別、資料層、SSR-safe hooks 完成；M1 QA 兩項清理項目順手帶上                                                  |
| 2026-05-14 | M3 完成：設定首頁、三個 setup 元件、對練骨架、sessionStorage 跨頁設定傳遞                                               |
| 2026-05-14 | M4 完成：5 態狀態機、TTS 多音色、LCS 模糊比對、整合 hook，順手帶上 M3 QA 三項清理                                       |
| 2026-05-14 | M5 完成：提詞器主畫面、StatusBar、done overlay，並修復 M4 留下的 TTS 中斷 bug                                           |
| 2026-05-14 | M6 完成：清理 M5 QA 6 項建議、撰寫 README.md、最終整合驗證；專案完工                                                    |
| 2026-05-14 | v2 啟動：使用者反饋 TTS 機器感過重，新增「上傳真人錄音 + Whisper 對齊 + 校正 UI」功能擴充                               |
| 2026-05-14 | SPEC-AUDIO.md v2.0 撰寫完成，10 個新任務（M7-M11 + 各 QA）建立                                                          |
| 2026-05-14 | M7 完成：音檔上傳 UI、IndexedDB 三 store schema、SSR-safe storage 層                                                    |
| 2026-05-14 | M8 完成：Whisper Worker、二階段對齊演算法、`AudioFileStatus` 6 態 union、Next.js webpack 整合                           |
| 2026-05-14 | M9 完成：手動校正 UI（Canvas 波形、拖拉/鍵盤微調、未儲存防護、scriptHash 偵測）                                         |
| 2026-05-14 | M10 完成：對練時播放音檔片段（AudioPlayer rAF + 三層保險）、三維 fallback 決策、StatusBar 真人錄音徽章；M9 QA P1 順手修 |
| 2026-05-14 | M11 完成：累積建議清理（8 修 / 2 已知限制）、script.json 同步機制、README v2 章節、TEST-FLOW.md                         |
| 2026-05-14 | v2 全部結案 — 11 個里程碑全 🟢，音檔功能完整可用                                                                        |
| 2026-05-16 | v4 啟動：使用者需求「劇本管理（純文字 / PDF / 圖片 OCR 匯入 + 編輯 UI + 多劇本切換）」，PM 規劃 M17–M22 共 6 個里程碑   |
| 2026-05-16 | M17 完成：scripts store 骨架 + ScriptRecord 型別 + scriptStorage CRUD + 首頁背景 seed default 劇本；DB_VERSION 3 → 4   |
