# 劇本對練平台

> 個人化讀本陪練系統 — 演員選定角色後，系統 TTS（或預先錄好的真人錄音）扮演其他角色，輪到你時系統暫停等你念，STT 比對成功後自動接續。

## 功能特色

- 黑底白字提詞器風格 UI，極簡無干擾
- 4 角色（維克多 / 娜塔莉亞 / 胡利安 / 卡蘿莉娜）對練
- 三種練習範圍：全劇 / 單頁（41 / 42 / 43 / 44）/ 自訂起訖行
- 三種提示模式：完整 / 前 5 字 / 隱藏（從走戲到背稿驗收的不同階段）
- 中文 STT 語音辨識比對（LCS 字元覆蓋率，60% 通過門檻）
- 多角色 TTS 自動音色配對（依瀏覽器可用 voice 分配，並用 pitch / rate 微差區分撞聲）
- **v3：逐行真人錄音** — 不喜歡機器人嗓音可在錄音頁逐句錄製對手台詞，對練時自動播放真人錄音、未錄的行自動 fallback TTS
- 鍵盤快捷鍵 + 點任一行跳轉
- `localStorage` 自動記憶上次練到哪、各角色累計練習次數
- 純前端：無後端、無上傳、無使用者帳號

## 快速開始

```bash
npm install
npm run dev
# 開啟 http://localhost:3000
```

建置 / 啟動 production：

```bash
npm run build
npm start
```

型別檢查：

```bash
npm run typecheck
```

## 瀏覽器需求

| 瀏覽器 | TTS（系統說話） | STT（語音辨識） | 錄音（MediaRecorder） |
|---|---|---|---|
| Chrome | 支援 | 支援（建議） | 支援 |
| Edge | 支援 | 支援 | 支援 |
| Safari | 支援 | 支援不穩 | 支援（iOS 14.5+） |
| Firefox | 支援 | 不支援 | 支援 |

不支援 STT 的瀏覽器仍可使用 — 系統會偵測並提示，改以空白鍵手動推進；
不支援 TTS 的環境（罕見）則所有對手台詞需要全程手動推進。

**首次啟動小提醒**：部分瀏覽器需先有使用者互動才會解鎖音訊（autoplay policy）。
若第一輪 TTS 沒聲音，按一次空白鍵即可解鎖；後續即可正常運作。

**權限**：第一次進入對練畫面時瀏覽器會詢問麥克風權限（STT），錄音頁則會另外詢問麥克風權限（MediaRecorder）。

## 操作指引

### 快捷鍵（對練畫面）

| 鍵 | 功能 |
|---|---|
| 空白鍵 | 強制推進當前句 / 演員念完手動確認 |
| 左方向鍵 | 跳到上一句 |
| R / r | 重念當前句 |
| Esc | 暫停 / 繼續 |
| 1 / 2 / 3 | 切換提示模式（完整 / 前 5 字 / 隱藏） |
| 滑鼠點任一行 | 跳轉到該行 |

### 主流程

1. **首頁設定**
   - 選角色（維克多 / 娜塔莉亞 / 胡利安 / 卡蘿莉娜）
   - 選練習範圍（全劇 / 單頁 / 自訂起訖行）
   - 選提示模式（完整 / 前 5 字 / 隱藏）
   - 設定頁底部可看到「逐行錄音」區塊，每角色一個進度條（`recorded / total`）
   - 點「開始對練」直接進入對練畫面

2. **逐行錄音（選用，跳過即走純 TTS）**
   - 設定頁的角色卡上點「錄音」進入 `/record/[角色簡稱]`
   - 提詞器逐行顯示該角色台詞（依劇本順序）
   - 每行 60 秒上限；點「⏺ 開始錄音」→「⏹ 停止」→「✓ 確認下一行」即寫入 IndexedDB
   - 「✓ 確認下一行」會自動跳到下一未錄的行；「🔁 重錄」拋棄當前 preview 重來
   - 中途離開（關頁 / 返回設定）已確認的行皆已落地，下次回到錄音頁會直接續錄
   - 對任一行重新錄音會覆蓋舊片段（依複合 key `[characterKey, globalIndex]`）

3. **對練**
   - 系統依劇本順序播放對手角色台詞
   - 該行有真人錄音 → 播放錄音；無錄音 / 錄音失敗 → fallback TTS
   - 輪到自己時系統暫停聆聽，STT 自動推進或空白鍵手動備援
   - StatusBar 顯示當前對手台詞的播放來源（真人錄音 / TTS）
   - 練習到範圍結尾顯示「練習完成 +1」彈窗

下次回到首頁會顯示「上次練到」摘要，可一鍵繼續上次未完成的進度。

### 行動裝置

錄音頁完全支援行動裝置（透過 MediaRecorder API）；建議用手機 / 平板就地錄製，桌機用來對練。

## 劇本變更與「橘色徽章」

設定頁角色卡的進度條右側若顯示**橘色「劇本已變更」徽章**，代表你錄音當下的劇本內容與目前 `script.json` 不一致（透過比對 `scriptHash` 偵測）。

行為：
- 該角色已錄的片段**仍會嘗試播放**（除非該行 `globalIndex` 已不存在）
- 建議進入錄音頁針對「缺漏 / 內容變動」的行**重錄**
- 或可從設定頁角色卡點「刪除全部」清空後重來

`scriptHash` 是該角色任一筆片段的 hash 與當前劇本 hash 的對照；若刪光該角色全部片段，徽章會回歸無顯示。

## 替換為自己的劇本

> 本專案有**根目錄 `script.json`** 與 **`public/script.json`** 兩處。
> 根目錄是「來源」（給你編輯）、`public/` 才是 Next.js 真正載入的位置。
> `package.json` 內已加上 `predev` / `prebuild` 自動同步腳本（執行 `npm run dev` 或 `npm run build` 都會先 `cp script.json public/script.json`）。
> 不重啟 dev server 也可以手動執行 `npm run sync-script` 立即同步。

劇本資料位於 `public/script.json`，格式為：

```ts
type Script = {
  characters: Record<string, string>;  // 簡稱 → 全名
  pages: Page[];
};

type Page = {
  page: number;
  lines: Line[];
};

type Line =
  | { character: string; text: string }       // 角色台詞，character 必須是 characters 的 key
  | { type: 'stage_direction'; text: string }; // 舞台指示，僅顯示不朗讀
```

範例見當前 `public/script.json`（內容為一齣 4 角色、4 頁的劇本）。
**修改流程**：
1. 編輯**根目錄** `script.json`（不要直接改 `public/script.json`，會被覆蓋）
2. 執行 `npm run sync-script`（或重啟 dev / build，會自動觸發）
3. 重新整理頁面即生效；無需重新建置

> 若你已逐行錄過音，**改劇本後 `scriptHash` 會對不上**，設定頁該角色會出現橘色徽章 — 進錄音頁重錄缺漏 / 變動的行即可。

> 若改了角色數量或 key，記得清掉 `localStorage` 中的 `script-rehearsal:practice-state`
> （DevTools → Application → Local Storage），避免「上次練到」指向不存在的角色。

## 隱私說明

- 練習進度與計數儲存於 `localStorage`；本次對練設定儲存於 `sessionStorage`
- 錄音音檔片段（Blob）儲存於本機 IndexedDB（`script-rehearsal-audio` db）
- **完全不上傳任何資料到外部伺服器**；無後端、無使用者帳號、無分析追蹤
- STT 麥克風語音由瀏覽器原生 Web Speech API 即時處理，**不會被儲存或上傳**
- 想完全清空音檔：DevTools → Application → IndexedDB → 刪除 `script-rehearsal-audio`

## 技術棧

- Next.js 15（App Router）
- React 19
- TypeScript（strict mode）
- Tailwind CSS 4
- Web Speech API（TTS：`SpeechSynthesisUtterance` / STT：`SpeechRecognition`）
- MediaRecorder API（逐行錄音）
- IndexedDB（音檔片段持久化）

無任何執行期外部依賴；STT 比對演算法為自實作 LCS（Longest Common Subsequence）字元覆蓋率。

## IndexedDB schema（v3）

資料庫 `script-rehearsal-audio` 僅存在單一 store：

```
audioSegments  (keyPath: [characterKey, globalIndex])
  ├─ index byCharacter (characterKey, 非 unique)
  └─ record {
       characterKey: string
       globalIndex:  number
       blob:         Blob       // MediaRecorder 產出的音檔片段
       mimeType:     string
       durationMs:   number
       sizeBytes:    number
       recordedAt:   number     // epoch ms
       scriptHash:   string     // 錄製當下劇本 SHA-256
     }
```

upgrade 時若偵測到舊三 store schema（`audioFiles` / `transcriptions` / `alignments`）會直接 delete 後重建 `audioSegments`；自 v2 升 v3 時則以 cursor 遍歷 `audioSegments`，將舊 record 缺漏的 `scriptHash` 欄位補為空字串 sentinel。（v3 alpha 既有錄音遇到 `scriptHash` 為空時將標為「劇本變更」，建議重錄該角色取得乾淨資料。）

## 檔案結構

```
.
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # 設定首頁
│   ├── record/[characterKey]/    # 逐行錄音頁
│   ├── rehearse/page.tsx         # 對練畫面
│   └── globals.css
├── components/
│   ├── setup/                    # 設定流程元件
│   │   ├── CharacterPicker.tsx
│   │   ├── RangePicker.tsx
│   │   ├── HintModePicker.tsx
│   │   └── AudioManager.tsx      # 逐行錄音進度 / 入口
│   ├── record/
│   │   └── RecordClient.tsx      # 錄音頁主元件
│   └── rehearse/                 # 對練畫面元件
├── lib/                          # 純邏輯模組
│   ├── types.ts
│   ├── script.ts
│   ├── storage.ts
│   ├── sessionConfig.ts
│   ├── tts.ts
│   ├── stt.ts
│   ├── stateMachine.ts
│   ├── scriptHash.ts             # 劇本內容 SHA-256（偵測變更）
│   ├── audioStorage.ts           # IndexedDB CRUD（audioSegments）
│   └── audioPlayer.ts            # 對練時播放音檔片段
├── hooks/                        # React hooks
│   ├── useScript.ts
│   ├── useLocalStorage.ts
│   ├── useTTS.ts
│   ├── useSTT.ts
│   ├── useRecorder.ts            # MediaRecorder 封裝
│   ├── useAudioSegments.ts       # 各角色逐行錄音進度
│   └── useRehearsal.ts           # 整合 hook（狀態機 + TTS + STT + 持久化 + 音檔播放）
├── public/
│   └── script.json               # 劇本資料
├── SPEC.md                       # v1.0 產品規格
├── SPEC-AUDIO.md                 # v2/v3 音檔功能規格（v2 章節保留考古）
├── PROGRESS.md                   # 開發進度紀錄
├── TEST-FLOW.md                  # v3 使用者實機測試流程
└── README.md
```

## 已知限制

- TTS voice 依瀏覽器與作業系統而異；不同電腦上音色會有差異，無法保證一致
- STT 中文準確率約 70–85%，嘈雜環境會明顯下降；可隨時用空白鍵推進
- 首次開啟可能要等 1–2 秒讓中文 voice 載入完成
- 沒有提供「劇本編輯器」UI，需手動編輯 `public/script.json`
- 4 個角色的對練流程，多人同時對練需要拓展
- 練習進度持久化採節流寫入（每 5 行寫一次 + done / unmount 補寫），極端情境下可能漏寫最後幾行
- 每行錄音上限 60 秒；超過自動停止
- IndexedDB 配額視瀏覽器 / 裝置而異（通常數 GB），全劇逐行錄音遠低於限制

## 開發與規格文件

- [`SPEC.md`](./SPEC.md)：v1.0 產品規格
- [`SPEC-AUDIO.md`](./SPEC-AUDIO.md)：v2/v3 音檔功能規格（v2 章節保留考古）
- [`PROGRESS.md`](./PROGRESS.md)：所有里程碑（M1+）的開發紀錄與 QA 結果
- [`TEST-FLOW.md`](./TEST-FLOW.md)：v3 使用者實機測試流程

## 授權

僅供個人練習用途。
