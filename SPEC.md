# 劇本對練平台 — 產品規格 (SPEC)

> 版本：v1.0
> 最後更新：2026-05-14
> 狀態：已對齊使用者需求，進入實作階段

---

## 1. 產品定位

**個人化讀本陪練系統**：演員獨自一人時，也能與系統進行對手戲練習。
- 演員選定飾演的角色後，系統用 TTS 扮演其他所有角色依劇本順序對白。
- 輪到該演員的角色時，系統暫停等待演員念出台詞。
- 系統透過語音辨識（STT）比對演員是否念完台詞，比對成功後自動接續下一句。

## 2. 技術棧

| 項目 | 選擇 | 原因 |
|---|---|---|
| 框架 | Next.js 15 (App Router) | 使用者指定 |
| 語言 | TypeScript (strict) | 型別安全 |
| 樣式 | Tailwind CSS | 快速且一致 |
| 部署 | 單機網頁，本地 dev 為主 | MVP 不需後端 |
| TTS | Web Speech API (`SpeechSynthesisUtterance`) | 瀏覽器原生免費 |
| STT | Web Speech API (`SpeechRecognition`) | 瀏覽器原生免費，中文 zh-TW |
| 持久化 | localStorage | 不需後端 |

**瀏覽器支援目標**：Chrome / Edge（Safari 對中文 STT 支援差，列為次要）。

## 3. 資料來源

**v1–v3**：唯一劇本資料源 `public/script.json`（已存在於專案根目錄）。
**v4（M17+）**：多劇本管理（詳見 [SPEC-SCRIPT.md](./SPEC-SCRIPT.md)），`public/script.json` 為「首次啟動 seed 的預設劇本」；使用者可在站內額外匯入純文字 / PDF / 圖片並維護任意份劇本，每份獨立儲存於 IndexedDB `scripts` store，由「active scriptId」（localStorage）指定當前選用。
**v6 起（M28）**：無內建預設劇本，使用者必須透過 `/scripts/import`（純文字 / PDF / 圖片 OCR）匯入。首頁在 IndexedDB `scripts` store 為空時只顯示標題 + 引導文案 + 「匯入劇本」CTA；刪除最後一份劇本後 `clearActiveScriptId()` 回到此空狀態。`public/script.json` 與根目錄 `script.json` 一併移除。

```ts
type Script = {
  characters: Record<string, string>;       // 簡稱 → 全名
  pages: Page[];
};

type Page = {
  page: number;
  lines: Line[];
};

type Line =
  | { character: string; text: string }                 // 角色台詞
  | { type: 'stage_direction'; text: string };          // 舞台指示

// v4 新增（M17）
type ScriptId = string;
type ScriptRecord = {
  id: ScriptId;
  name: string;
  script: Script;
  createdAt: number;
  updatedAt: number;
  source: 'default' | 'plain-text' | 'pdf' | 'image-ocr';
};
```

預設劇本資料包含 4 個角色（維/娜塔/胡/卡）共 4 頁（41-44）。使用者匯入的新劇本則各自獨立。

## 4. 核心功能規格

### 4.1 設定流程（首頁）

使用者依序選擇：
1. **角色**：維克多 / 娜塔莉亞 / 胡利安 / 卡蘿莉娜（共 4 個）
2. **練習範圍**：
   - 全劇（從第 41 頁到第 44 頁）
   - 單頁（41 / 42 / 43 / 44 擇一）
   - 自訂起訖行（精準選擇某段）
3. **提示模式**：
   - 完整顯示（適合走戲）
   - 開頭 5 字提示（適合半背稿）
   - 完全隱藏（背稿驗收）

點擊「開始對練」進入練習畫面。

### 4.2 對練流程（核心狀態機）

```
[IDLE]
   ↓ start()
[SYSTEM_SPEAKING]  ── 系統用 TTS 唸非己方角色台詞
   ↓ utterance.end
   ├─ 下一行是舞台指示 → 顯示 1.5 秒（不朗讀）→ 推進
   ├─ 下一行是其他非己方角色台詞 → 繼續 SYSTEM_SPEAKING
   └─ 下一行是己方角色台詞 → [WAITING_ACTOR]
[WAITING_ACTOR]   ── 等待演員念
   ├─ STT 比對成功 → 推進下一行
   ├─ 按空白鍵   → 強制推進（備援）
   └─ 按 R       → 重念當前
[PAUSED]          ── Esc / 視窗失焦
   ↓ resume()
回到先前狀態
[DONE]            ── 練到範圍結尾
```

### 4.3 TTS（系統發聲）

- 使用 Web Speech API `SpeechSynthesisUtterance`
- 中文 zh-TW 語音
- 每個非己方角色分配不同 voice（依瀏覽器可用清單）
  - 維克多：男聲 A
  - 娜塔莉亞：女聲 A
  - 胡利安：男聲 B（或男聲 A + 微調 pitch/rate）
  - 卡蘿莉娜：女聲 B
- 若可用 voice 不足，以 pitch/rate 微調區分

### 4.4 STT（語音辨識）

- 使用 Web Speech API `SpeechRecognition`（webkit 前綴相容）
- `lang = 'zh-TW'`
- `continuous = true`，`interimResults = true`
- **比對演算法**：累積 interim 結果 → 移除標點與空白 → 計算與目標台詞的字元重疊率
  - 達 **60%** 以上即視為念完，自動推進
  - 演員可按空白鍵強制推進（不依賴 STT）

### 4.5 舞台指示處理

- 畫面顯示為**斜體灰字**，置中
- **不朗讀**
- 停留 1.5 秒後自動推進

### 4.6 互動快捷鍵

| 鍵 | 功能 |
|---|---|
| `空白鍵` | 強制推進當前句 / 演員念完手動確認 |
| `←` (左方向鍵) | 跳到上一句 |
| `R` / `r` | 重念當前句 |
| `Esc` | 暫停 / 繼續 |
| `1` / `2` / `3` | 切換提示模式（完整 / 前5字 / 隱藏）|
| 滑鼠點任一行 | 跳轉到該行開始 |

### 4.7 持久化（localStorage）

```ts
type PracticeState = {
  lastCharacter: string;            // 上次練習的角色簡稱
  lastLineIndex: number;            // 上次練到第幾行（扁平化索引）
  practiceCountByCharacter: Record<string, number>;  // 各角色累計練習次數
};
```

- key: `script-rehearsal:practice-state`
- 每次完成範圍練習 +1 計數
- 首頁顯示「上次練到：娜塔莉亞 / 第 42 頁第 5 行」並提供「繼續上次」按鈕

## 5. UI 風格

**極簡黑底白字 — 劇場提詞器風格**

- 背景：純黑 `#000`
- 主文字：白 `#fff` / 大字 `text-2xl ~ text-4xl`
- 已過台詞：淡灰 `#666`（向上捲動淡出）
- 當前台詞：白色高亮 + 微微放大
- 未來台詞：依提示模式控制是否顯示
- 角色名標籤：淡藍/淡黃等次要色，置於台詞左側
- 舞台指示：`italic text-gray-500 text-center`
- 控制列固定底部，提示快捷鍵與當前狀態（聆聽中 / 系統說話中 / 暫停）

## 6. 專案結構（規劃）

```
/
├─ SPEC.md                        # 本文件
├─ PROGRESS.md                    # 進度追蹤
├─ README.md                      # 使用指引（最後產出）
├─ script.json                    # 劇本資料
├─ package.json
├─ tsconfig.json
├─ next.config.ts
├─ tailwind.config.ts
├─ app/
│  ├─ layout.tsx                  # 全域 layout
│  ├─ page.tsx                    # 首頁（設定流程）
│  ├─ rehearse/
│  │  └─ page.tsx                 # 對練畫面
│  └─ globals.css
├─ components/
│  ├─ setup/
│  │  ├─ CharacterPicker.tsx
│  │  ├─ RangePicker.tsx
│  │  └─ HintModePicker.tsx
│  └─ rehearse/
│     ├─ Teleprompter.tsx         # 提詞器主畫面
│     ├─ LineRow.tsx              # 單行
│     └─ StatusBar.tsx
├─ lib/
│  ├─ types.ts                    # 劇本與狀態型別
│  ├─ script.ts                   # 劇本載入與扁平化
│  ├─ tts.ts                      # TTS 服務
│  ├─ stt.ts                      # STT 服務 + 比對演算法
│  ├─ stateMachine.ts             # 對練狀態機
│  └─ storage.ts                  # localStorage 包裝
├─ hooks/
│  ├─ useScript.ts
│  ├─ useTTS.ts
│  ├─ useSTT.ts
│  ├─ useRehearsal.ts             # 整合對練流程
│  ├─ useKeyboard.ts
│  └─ useLocalStorage.ts
└─ data/
   └─ script.json                 # （由根目錄移入或 symlink）
```

## 7. 開發里程碑

| 階段 | 內容 | 負責 |
|---|---|---|
| M0 | SPEC.md + PROGRESS.md | 主代理 |
| M1 | Next.js 專案初始化 | 資深 Next.js 工程師 |
| M2 | 型別與資料層 | 資深 Next.js 工程師 |
| M3 | 設定畫面 | 資深 Next.js 工程師 |
| M4 | 對練核心引擎（TTS/STT/狀態機） | 資深 Next.js 工程師 |
| M5 | 對練畫面與互動 | 資深 Next.js 工程師 |
| M6 | 整合 + README | 資深 Next.js 工程師 |

**每個里程碑完成後由資深 QA 工程師審查並更新 `PROGRESS.md`。**

## 8. 已知風險與緩解

| 風險 | 緩解方式 |
|---|---|
| Chrome 中文 STT 準確率 70-85% | 提供空白鍵強制推進；模糊比對門檻 60% |
| 部分瀏覽器無可用中文 voice | TTS 啟動前列出可用 voice，缺中文 voice 時警示並 fallback 至系統預設 |
| `script.json` 中 p.41 維克多有一行台詞為「胡：」可能為原稿錯位 | 暫時保留原資料當正常台詞處理，使用者實際使用後再決定 |
| `script.json` 中多處 `(?)` 標記為辨識不確定字 | 不影響系統運作；使用者可隨時修正 JSON |
