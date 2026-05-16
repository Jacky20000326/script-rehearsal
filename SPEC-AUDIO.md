# 劇本對練平台 — 音檔功能擴充規格 (SPEC v2 / v3)

> 版本：v3.0（逐段引導錄製，當前實作目標）
> 上一版：v2.0（上傳整段音檔 + Whisper + LCS，已完工但棄用）
> 最後更新：2026-05-14
> 母規格：[SPEC.md](./SPEC.md)（v1.0）

---

## v3 — 逐段引導錄製（當前版本）

### v3.1 動機

v2.0 的「上傳整段音檔 + Whisper 轉錄 + LCS 對齊」雖然可行，但：
- 模型首次下載 ~145MB，行動裝置記憶體吃緊
- 中文準確率 85–90%，常需手動校正
- 對齊低信心行需 fallback TTS，體驗不一致

v3.0 改為**系統一段一段引導使用者錄製**，每段台詞錄製獨立子音檔，從根本移除轉錄與對齊環節。

### v3.2 設計原則

1. **天生 1:1**：每行台詞對應一段錄音，無對齊問題
2. **逐段可重錄**：任何單行可隨時點「重錄」，不影響其他段
3. **進度可中斷**：錄到一半關閉頁面，已錄段落保留在 IndexedDB
4. **無需任何模型下載**：移除 `@xenova/transformers` 依賴
5. **降級無痛**：未錄段落 → fallback Web Speech TTS（保留 v1.0 行為）

### v3.3 使用流程

```
設定頁 → 角色音檔管理區
   ├─ 維克多        [已錄 12/17 行]  [繼續錄製]  [刪除全部]
   ├─ 娜塔莉亞      [未開始]         [開始錄製]
   ├─ 胡利安        [已錄 17/17 行]  [重新錄製]  [刪除全部]
   └─ 卡蘿莉娜      [已錄 5/17 行]   [繼續錄製]  [刪除全部]

點「開始錄製 / 繼續錄製」→ /record/[characterKey]

/record/[characterKey]
   ┌──────────────────────────────────────────┐
   │ 維克多 的錄音    進度 12/17    返回設定    │
   ├──────────────────────────────────────────┤
   │                                          │
   │   第 13 行                                │
   │   ┌────────────────────────────────────┐│
   │   │ 「我從沒想過會在這裡見到你」          ││
   │   └────────────────────────────────────┘│
   │                                          │
   │             ⏺  點擊開始錄音               │
   │             （再點一次停止）              │
   │                                          │
   │   ─── 錄完後 ───                          │
   │   時長 2.3s    [▶ 試聽]  [🔁 重錄]  [✓ 確認下一行] │
   │                                          │
   │   ◀ 上一行          下一行 ▶              │
   └──────────────────────────────────────────┘

對練 /rehearse（行為微調）
   ├─ 非己方角色行播放時：
   │    └─ 有子音檔 → audio.play() 自然結束 → TTS_END
   │    └─ 無子音檔 → fallback Web Speech TTS（v1.0 行為）
   └─ StatusBar 顯示「真人錄音」/「合成語音」徽章
```

### v3.4 錄音控制（明確規格）

- **觸發方式**：點一次按鈕開始錄音、再點一次停止（**非**按住空白鍵）
- **MediaRecorder 設定**：
  - 優先 `audio/webm;codecs=opus`，fallback `audio/webm`、再 fallback `audio/mp4`
  - 取樣率交由瀏覽器決定（typical 48kHz）
  - bitrate 預設 `audioBitsPerSecond: 64_000`（適合人聲）
- **權限**：首次進入錄音頁時 `getUserMedia({ audio: true })`，失敗顯示具體錯誤
- **單段長度上限**：60 秒（防止誤觸長期未停）
- **靜音剪裁**：MVP 不做（保留原始錄音）

### v3.5 IndexedDB 結構（簡化）

**資料庫**：`script-rehearsal-audio`
歷代版本：
- v2（v3 引入）：建立單一 `audioSegments`，keyPath `[characterKey, globalIndex]`
- v3：cursor 遍歷補 `scriptHash` 欄位
- v4（M17）：新增 `scripts` store
- **v5（M22）**：擴充 `audioSegments` keyPath 為 `[scriptId, characterKey, globalIndex]`，多劇本不串音

**Object Stores（v5 當前）**：

```ts
// 每劇本 × 每行台詞一筆
type AudioSegmentRecord = {
  scriptId: string;            // M22 新增；對應 ScriptRecord.id
  characterKey: string;        // 例：'維'、'娜塔'
  globalIndex: number;         // script flat 的 globalIndex
  blob: Blob;                  // 通常為 audio/webm; codecs=opus
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  recordedAt: number;          // epoch ms
  scriptHash: string;          // M16 新增；錄製當下劇本內容 SHA-256
};
// store: 'audioSegments'
// keyPath: ['scriptId', 'characterKey', 'globalIndex']
// index: 'byCharacter' on 'characterKey'（單欄；getAllSegments / getFirstSegment
//        會在結果上額外過濾 scriptId）
```

**v4 → v5 migration（M22）**：
- IndexedDB 不支援 alter keyPath → 必須 delete store + recreate
- migration 全程在 `onupgradeneeded` 同一 versionchange transaction 內：
  1. cursor 撈出舊 records 到記憶體
  2. deleteObjectStore + createObjectStore（新 keyPath + 索引）
  3. 對每筆 record 補 `scriptId = 'default'` 後 put 回
- 不可 await 外部 promise（會跨 transaction 邊界導致 abort）

v2 的 `audioFiles` / `transcriptions` / `alignments` 三個 store 早於 v2 升級時即移除。

### v3.6 對練播放邏輯

`hooks/useRehearsal.ts` 在 `system_speaking` 副作用：

```ts
if (status === 'system_speaking' && !isStageDirection(currentLine)) {
  const segment = await audioSegments.get(currentLine.character, currentLine.globalIndex);
  if (segment) {
    audioPlayer.play(segment.blob);
    audioPlayer.onEnd(() => dispatch({ type: 'TTS_END' }));
  } else {
    tts.speak({ text: currentLine.text, characterKey: currentLine.character });
  }
}
```

**`lib/audioPlayer.ts` 簡化**：
- `play(blob)` → 內部 `URL.createObjectURL` + `<audio>.play()`，`ended` 事件觸發 `onEnd`
- `stop()`：`pause()` + `revokeObjectURL`
- 不需 `currentTime` 控制（自然結束）

### v3.7 設定頁狀態徽章

| 狀態 | 顯示 | 顏色 |
|---|---|---|
| 未開始 | `未開始` | 灰 |
| 進行中 | `已錄 N/M 行` | 藍 |
| 完整 | `已錄 M/M 行` | 綠 |
| 部分遺失 | `已錄 N/M 行（劇本變更）` | 橘 |

劇本變更偵測：`scriptHash` 仍保留（存在 character 維度 metadata store 或推導），不一致時提示重新錄製缺漏行。

### v3.8 檔案結構（v3 調整）

```
lib/
├─ audioStorage.ts          # IndexedDB CRUD（改為操作 audioSegments 單一 store）
├─ audioPlayer.ts           # HTMLAudio 播放（取 blob → play → ended）
└─ scriptHash.ts            # 保留

hooks/
├─ useAudioSegments.ts      # 取得各角色錄音進度（取代 useAudioFiles / useAlignment）
└─ useRecorder.ts           # 包裝 MediaRecorder：start/stop/blob/state

components/
└─ setup/
   └─ AudioManager.tsx      # 改為顯示「錄製進度」

app/
└─ record/
   └─ [characterKey]/
      └─ page.tsx           # 逐段錄音 UI（取代 /calibrate）

（移除）
- workers/whisper.worker.ts
- lib/whisperService.ts
- lib/alignment.ts
- app/calibrate/[characterKey]/page.tsx
- components/calibrate/*
- 依賴 @xenova/transformers
```

### v3.9 對 v1.0 既有檔案的變更

| 檔案 | 變更 |
|---|---|
| `hooks/useRehearsal.ts` | `system_speaking` effect 改查 `audioSegments`，無則 fallback TTS |
| `app/rehearse/page.tsx` | 引入 `useAudioSegments`，傳給 `useRehearsal` |
| `app/page.tsx` | 有 active script 時才掛載 `<AudioManager />`（顯示錄音進度）；空狀態（v6 / M28）下不掛載 |
| `components/rehearse/StatusBar.tsx` | 當前行有錄音時顯示「真人錄音」徽章 |
| `lib/script.ts` | 新增 `getCharacterLines(script, characterKey)` 用於錄音頁 |

### v3.10 v3 里程碑拆分

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| M12 | IndexedDB v2 schema 遷移 + `audioStorage` 重寫 | ⚪ |
| M13 | `useRecorder` hook + 錄音頁 UI（MediaRecorder 整合） | ⚪ |
| M14 | 設定頁 `AudioManager` 改寫（進度徽章） | ⚪ |
| M15 | 對練播放邏輯切回 segment 路徑 + StatusBar 徽章 | ⚪ |
| M16 | 整合測試 + 文件同步（README / PROGRESS） | ⚪ |

每個里程碑遵循 **PM → Dev → QA** 三角色開發流程（見 `~/.claude/skills/dev-trio/`），結束時 PM 更新 `PROGRESS.md`。

### v3.11 v3 驗收標準

- [ ] 不錄任何音檔 → 產品行為與 v1.0 完全一致（前提是已匯入並啟用 active script；v6 / M28 起無預設劇本，無 active script 時首頁進入空狀態，不會進入對練流程）
- [ ] 為某角色錄完所有行 → 該角色對練播放全程真人語音
- [ ] 錄到一半關閉頁面 → 重開後可繼續錄製，已錄段落保留
- [ ] 重錄單行不影響其他行
- [ ] 移除 `@xenova/transformers` 依賴；`package.json` 乾淨
- [ ] typecheck / build 全綠
- [ ] PROGRESS.md / README.md / TEST-FLOW.md 同步更新

### v3.12 非範圍

- 不做雲端 TTS
- 不做線上音檔上傳（僅瀏覽器內錄製）
- 不做降噪 / 等化 / 編輯
- 不做多語言
- 不做說話人分離
- **不再做 Whisper 轉錄與 LCS 對齊**（v2 功能整段廢除）

---

## v2 — 上傳音檔 + Whisper（已棄用，保留供考古）

> ⚠️ 以下內容為 v2.0 的歷史規格，已被 v3.0 取代。
> v2 實作於 2026-05-14 完工，但因模型體積、行動裝置體驗、中文準確率等問題，棄用改採 v3 逐段錄製。

### v2 章節（已棄用）

---

## 1. 動機

v1.0 的對手台詞由瀏覽器內建 Web Speech API TTS 唸出，使用者反饋**機器感過重**、影響演員進入角色情緒。本 v2.0 擴充允許上傳**真人錄音**作為對手聲音來源，從根本上消除合成語音的違和感，同時保留 TTS 作為 fallback。

## 2. 設計原則（不可違反）

1. **不破壞 v1.0 純前端架構**：無後端、無強制金鑰、無強制依賴雲端
2. **降級無痛**：未上傳音檔的角色 / 對齊失敗的行 → 自動 fallback 至 TTS
3. **音檔處理一律在瀏覽器內完成**：上傳、轉錄、對齊、儲存、播放皆 client-side
4. **可重複編輯**：對齊結果可手動校正，可隨時刪除重上傳
5. **可選擇性**：使用者完全不上傳音檔時，產品行為與 v1.0 完全一致

## 3. 使用流程（User Journey）

```
首頁設定區
   │
   ├─ [現有] 選角色 / 範圍 / 提示模式
   │
   └─ [新增] 音檔管理區
        ├─ 每角色一行：[未上傳] / [處理中 25%] / [已對齊 17/17 行] / [需校正 2 行]
        ├─ 「上傳音檔」按鈕（File input，per 角色）
        ├─ 上傳後 → 自動觸發 Whisper 轉錄與對齊
        ├─ 「校正音檔」按鈕 → /calibrate/[characterKey]
        └─ 「刪除音檔」按鈕 → 移除該角色音檔，回到 TTS 模式

校正頁 /calibrate/[characterKey]
   ├─ 顯示音檔波形（Canvas）
   ├─ 顯示該角色所有台詞列表，每行標記目前對齊到的 startMs/endMs
   ├─ 拖拉時間軸上的邊界可調整起訖
   ├─ 點任一行「預覽」可播放當前對齊的片段
   ├─ 「重新自動對齊」可重跑 Whisper（保留模型已下載狀態）
   └─ 「儲存」寫回 IndexedDB

對練畫面 /rehearse
   ├─ 非己方角色行播放時：
   │    └─ 該行有對齊資料 → 播音檔片段（HTMLAudio + currentTime 控制）
   │    └─ 該行無對齊資料 → fallback Web Speech API TTS（v1.0 行為）
   ├─ 行高亮處顯示小徽章：「真人錄音」/「合成語音」
   └─ 其餘行為與 v1.0 一致（狀態機、快捷鍵、跳轉、提示模式皆不變）
```

## 4. 技術設計

### 4.1 音檔儲存（IndexedDB）

**資料庫**：`script-rehearsal-audio`，版本 1

**Object Stores**：

```ts
// 原始音檔（一個角色一筆）
type AudioFileRecord = {
  characterKey: string;        // primary key，例：'維'、'娜塔'
  fileName: string;
  mimeType: string;            // 'audio/mpeg' | 'audio/wav' | 'audio/mp4' | 'audio/webm'
  sizeBytes: number;
  durationMs: number;
  blob: Blob;
  uploadedAt: number;          // epoch ms
};
// store: 'audioFiles'，keyPath: 'characterKey'

// Whisper 原始轉錄（保留以便重新對齊）
type TranscriptionRecord = {
  characterKey: string;
  modelName: string;           // 例：'Xenova/whisper-base'
  segments: TranscriptionSegment[];
  transcribedAt: number;
};
type TranscriptionSegment = {
  startMs: number;
  endMs: number;
  text: string;
  // 可選：confidence 由 Whisper 提供
};
// store: 'transcriptions'，keyPath: 'characterKey'

// 對齊結果（行 → 音檔片段）
type AlignmentRecord = {
  characterKey: string;
  scriptHash: string;          // 為了偵測劇本是否變更，存 script.json 的內容雜湊
  lines: AlignedLine[];
  updatedAt: number;
};
type AlignedLine = {
  globalIndex: number;         // 該角色該行在 flat 中的 globalIndex
  startMs: number;
  endMs: number;
  confidence: number;          // 0-1，由 LCS 比對結果計算
  source: 'auto' | 'manual';   // 是否手動校正過
};
// store: 'alignments'，keyPath: 'characterKey'
```

**容量規劃**：
- 每個音檔約 1-5MB（mp3 / m4a）；4 個角色合計 < 30MB
- IndexedDB 配額通常 ≥ 數 GB（瀏覽器自動分配），充足

**SSR 安全**：所有 IndexedDB 存取必須在 client side，`typeof window === 'undefined'` 守衛。

### 4.2 音檔格式與驗證

| 屬性 | 限制 |
|---|---|
| 接受格式 | mp3 / wav / m4a (AAC) / webm |
| 副檔名檢查 | 是 |
| MIME type 檢查 | 是 |
| 單檔大小上限 | 50 MB |
| 音檔長度上限 | 30 分鐘（避免 Whisper 跑太久）|
| 取樣率 | 不限，Whisper 內部會 resample 到 16kHz |

驗證失敗 → 顯示具體錯誤訊息，不寫入 IndexedDB。

### 4.3 Whisper 轉錄

**模型**：`Xenova/whisper-base`（中文版自動觸發）
- 約 145 MB（量化後），首次下載 cache 於 IndexedDB（transformers.js 自動處理）
- 中文準確率約 85-90%（依清晰度）
- 中等速度（1 分鐘音檔約 30-60 秒處理）

**執行環境**：Web Worker（避免阻塞主執行緒）
- Main thread → postMessage(audioBlob) → Worker
- Worker 內 import `@xenova/transformers`、跑 Whisper
- 進度透過 postMessage 回主執行緒（百分比）
- 結果為 segments[] with timestamps

**取消機制**：使用者切走頁面或手動取消 → Worker.terminate()，重新整理時可重來。

**模型快取**：transformers.js 預設用 IndexedDB cache 模型；首次下載後再次使用無需重抓。

### 4.4 LCS 對齊演算法

**輸入**：
- Whisper segments[]：來自轉錄
- 該角色的所有 lines[]：來自 script.json 過濾

**演算法**：
1. 標準化文字（去標點空白、簡繁轉換可選）
2. 對每一段 Whisper segment 跟所有未匹配的 line 做 LCS 比對
3. 取最高分（且 > 0.5）的 line 配對
4. 若一個 segment 對應到多個 line（segment 較長）→ 用時間比例切分
5. 若一個 line 對應到多個 segment（segment 較短）→ 合併時間範圍
6. 無匹配的 line → `confidence = 0`，預設 fallback TTS

**信心分數**：`confidence = LCS_length / max(line.length, segment.length)`
- > 0.7：高信心，預設不需要校正
- 0.5 - 0.7：中信心，UI 標記為「建議校正」
- < 0.5：低信心，標記為「需校正」並預設 fallback TTS

**Buffer**：每段對齊加 ±200ms（避免起頭尾被切掉）

### 4.5 手動校正 UI

**路由**：`/calibrate/[characterKey]`

**畫面結構（黑底白字、提詞器一致風格）**：

```
┌─────────────────────────────────────────────────┐
│ Header  維克多 的音檔校正                返回設定 │
├─────────────────────────────────────────────────┤
│                                                 │
│   ╔═══════ 波形圖 (Canvas) ═══════╗             │
│   ║▁▂▃▅█▆▄▂▁▂▄▆█▅▃▂▁▁▂▄▆█▆▄▂▁▂▄▆║             │
│   ╚═════════════════════════════╝             │
│   標尺：0:00────0:30────1:00────1:30           │
│                                                 │
│   ▼ 對齊行列表 (該角色的所有台詞)               │
│   ┌─────────────────────────────────────┐     │
│   │ #5  「這是你說的，娜塔莉亞」          │     │
│   │     0:12.5 ───── 0:14.8  [預覽]      │     │
│   │     信心：92%                         │     │
│   ├─────────────────────────────────────┤     │
│   │ #11 「胡：」  ⚠ 需校正                │     │
│   │     0:25.0 ───── 0:25.5  [預覽]      │     │
│   │     信心：38%                         │     │
│   └─────────────────────────────────────┘     │
│                                                 │
│   [重新自動對齊]  [儲存校正]                    │
└─────────────────────────────────────────────────┘
```

**互動**：
- 點任一行 → 在波形圖上高亮該段、可拖拉左右邊界
- 拖拉同時即時更新 startMs / endMs 顯示
- 點「預覽」播放當前對齊片段
- 點「儲存」寫回 IndexedDB（標記為 `source: 'manual'`）
- 點「重新自動對齊」重跑 Whisper（保留模型 cache，速度快）

**鍵盤可訪問性**：當前選取行用左右鍵微調邊界（±50ms / 按）。

### 4.6 對練時的播放邏輯

修改 `hooks/useRehearsal.ts` 的副作用 effect：

```ts
// 偽碼
if (status === 'system_speaking' && !isStageDirection(currentLine)) {
  const aligned = alignmentMap.get(currentLine.globalIndex);
  if (aligned && aligned.confidence >= 0.5) {
    // 走音檔播放路徑
    audioPlayer.play(aligned.characterKey, aligned.startMs, aligned.endMs);
    audioPlayer.onEnd(() => dispatch({ type: 'TTS_END' }));
  } else {
    // 走 TTS 路徑 (v1.0 行為)
    tts.speak({ text: currentLine.text, characterKey: currentLine.character });
  }
}
```

**新增模組 `lib/audioPlayer.ts`**：
- 載入該角色的 audio blob（從 IndexedDB → Blob URL）
- 提供 `play(characterKey, startMs, endMs)`：設 `currentTime` → 播放 → `setTimeout` 在 endMs 時 `pause`
- 提供 `stop()`、`isPlaying()`、`onEnd(cb)`
- 維護 audio element 池（一個 character 一個 HTMLAudioElement，避免反覆 createObjectURL）

**Edge cases**：
- 片段結尾的精準度：用 `setTimeout` 預定停止；同時監聽 `timeupdate` 雙保險
- 多個片段連續播放：每段獨立 reset currentTime
- 使用者跳轉到中間行：cancel 當前 audio + 重新 play
- 暫停 / 繼續：HTMLAudio.pause() / play()

**視覺指示（StatusBar 或當前行）**：
- 音檔模式：「真人錄音」徽章
- TTS 模式：「合成語音」徽章（或不顯示，保持安靜）

## 5. 設定頁 UI 變更

在現有設定頁底部新增「音檔管理」區塊，預設摺疊（保持 v1.0 視覺乾淨）：

```
┌─────────────────────────────────────────────┐
│ ▽ 音檔管理（可選，可讓對手聽起來像真人）       │
└─────────────────────────────────────────────┘
   ▼ 展開後：
┌─────────────────────────────────────────────┐
│ 維克多        [未上傳]      [上傳音檔]         │
│ 娜塔莉亞      [已對齊 18 行]  [校正]  [刪除]    │
│ 胡利安        [處理中 45%]                     │
│ 卡蘿莉娜      [需校正 3 行]  [校正]  [刪除]    │
└─────────────────────────────────────────────┘
```

**狀態徽章**：
- 未上傳（淡灰）
- 處理中 X%（藍色，附停止按鈕）
- 已對齊 N/M 行（綠色）
- 需校正 N 行（橘色）
- 失敗（紅色，附「重試」）

## 6. 檔案結構（新增）

```
lib/
├─ audioStorage.ts          # IndexedDB CRUD（音檔、轉錄、對齊）
├─ audioPlayer.ts           # HTMLAudio 播放控制（含片段）
├─ whisperService.ts        # Worker 包裝、轉錄 API
├─ alignment.ts             # LCS 對齊演算法
└─ scriptHash.ts            # 計算 script.json 雜湊（偵測劇本變更）

hooks/
├─ useAudioFiles.ts         # 取得各角色的音檔狀態
├─ useTranscription.ts      # 觸發與監控 Whisper 轉錄進度
└─ useAlignment.ts          # 讀取對齊資料、提供 hasAlignment(globalIndex) 等查詢

components/
└─ setup/
   └─ AudioManager.tsx      # 設定頁底部的音檔管理區塊

workers/
└─ whisper.worker.ts        # Whisper Web Worker

app/
└─ calibrate/
   └─ [characterKey]/
      └─ page.tsx           # 手動校正畫面
```

## 7. 對 v1.0 既有檔案的變更

| 檔案 | 變更 |
|---|---|
| `hooks/useRehearsal.ts` | 在 `system_speaking` effect 內加入「先查對齊」邏輯，無則 fallback TTS |
| `app/rehearse/page.tsx` | 引入 useAlignment，傳給 useRehearsal |
| `app/page.tsx` | 設定頁底部插入 `<AudioManager />` |
| `components/rehearse/StatusBar.tsx` | 當前行為非己方角色且有對齊時顯示「真人錄音」徽章 |
| `lib/script.ts` | 新增 `getCharacterLines(script, characterKey)` 用於校正頁 |

不變：所有狀態機 / 鍵盤 / 提示模式 / 範圍切片邏輯。

## 8. 里程碑拆分

| 里程碑 | 內容 | 任務 ID |
|---|---|---|
| M7 | 音檔上傳 + IndexedDB 儲存 + 設定頁 UI | #14, #15 (QA) |
| M8 | Whisper Worker + 自動對齊 | #16, #17 (QA) |
| M9 | 手動校正 UI（波形 + 拖拉） | #18, #19 (QA) |
| M10 | 對練時播放音檔片段 + fallback | #20, #21 (QA) |
| M11 | 整合測試 + README 更新 | #22 |

每個里程碑完成後由資深 QA 工程師審查並更新 `PROGRESS.md`。

## 9. 風險與緩解

| 風險 | 緩解 |
|---|---|
| Whisper 模型首次下載 ~145MB | 顯示明顯進度條 + 允許跳過、純走 TTS |
| Whisper 中文準確率 85-90% | 提供手動校正 UI；低信心行預設 fallback TTS |
| 行動裝置記憶體不足跑 Whisper 卡 | 偵測為行動裝置時顯示警示，建議改桌機處理 |
| IndexedDB 配額不足 | 上傳前 estimate quota；超過時提示刪除舊音檔 |
| 音檔片段切換不順 | HTMLAudio pool + 預載入；±200ms buffer |
| 劇本變更後對齊失效 | 用 scriptHash 偵測；不一致時提示「劇本變更，請重新對齊」 |
| 模型授權 | transformers.js + Xenova/whisper-base 為 MIT/Apache 系列，可商用 |

## 10. 非範圍（明確排除）

- 不做雲端 TTS 整合（OpenAI / Azure / ElevenLabs）— 維持純前端
- 不做音檔線上錄音功能（只接受上傳）
- 不做音檔降噪 / 等化 / 編輯（要求使用者自行處理）
- 不做多語言（僅中文）
- 不做說話人分離（diarization）— 因採「每角色一檔」結構

## 11. 驗收標準

整個 v2 完成後應滿足：
- [ ] 不上傳任何音檔，產品行為與 v1.0 完全一致（向後相容）
- [ ] 上傳一個角色的音檔後，該角色台詞在對練中改為真人語音播放
- [ ] 自動對齊信心分數合理（高品質錄音的高信心行 > 80%）
- [ ] 手動校正 UI 可調整邊界並儲存
- [ ] 整體 typecheck / build 全綠
- [ ] PROGRESS.md 與 README.md 同步更新
