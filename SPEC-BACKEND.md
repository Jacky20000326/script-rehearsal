# 劇本對練平台 — 後端整合規格 (SPEC-BACKEND)

> 版本：v1.0（規劃，未實作）
> 最後更新：2026-05-17
> 狀態：技術選型已決，待使用者批准後進入 M29
> 母規格：SPEC.md v1.0（不變）／與 SPEC-AUDIO.md v3.0 並行
> 適用里程碑：**M29 ~ M35**

---

## 0. 文件目的

本文件規範「**從純前端 IndexedDB 架構，演進為前端 + 雲端後端**」的整體設計與分階段實作流程。

- 不取代 SPEC.md / SPEC-AUDIO.md / SPEC-SCRIPT.md；只**新增**雲端同步層。
- 文件本身不含任何代碼，只規範介面、流程、驗收。
- 每個里程碑（M29 ~ M35）的具體實作仍須由 `/dev-trio`（PM + Dev + QA）流程接手。

---

## 1. 背景與動機

### 1.1 現況

| 項目 | 現況 |
|---|---|
| 持久化 | IndexedDB（劇本 + 音檔 Blob）／localStorage（PracticeState）／sessionStorage（SessionConfig） |
| 同步能力 | 無，所有資料只活在當前瀏覽器與當前裝置 |
| 共享能力 | 無，劇本與錄音無法分享給其他成員 |
| 風險 | 清除瀏覽器資料 / 換裝置 / 換瀏覽器 = 完全失去資料 |

### 1.2 觸發需求（2026-05-17 使用者確認）

1. **跨裝置同步**：手機練、回家用桌機接續；現在做不到。
2. **小團隊使用情境**：< 50 人工作室規模，演員 / 導演間需要共享劇本與錄音。
3. **預期音檔規模**：1 ~ 50 GB（多人多劇本累積）。
4. **成本約束**：完全免費 / 接近免費，不接受月費數十美元級別的服務。

### 1.3 不變的承諾

引入後端後，**離線優先（offline-first）體驗仍是核心**：
- 沒有網路時，使用者仍能練習已下載過的劇本與音檔。
- IndexedDB 從「真相來源」降級為「本地快取 + 離線 buffer」。
- 飛航模式下完整可用，回網時自動同步。

---

## 2. 與既有規格的關係

| 規格 | 影響 | 動作 |
|---|---|---|
| **SPEC.md** | §2 技術棧的「持久化：localStorage」需擴充 | M29 完成後，PR 中同步補充 v2 章節 |
| **SPEC.md §3** | 資料來源加上「雲端 Supabase」一層 | M31 同步更新 |
| **SPEC-AUDIO.md** | §4.1 `AudioSegmentRecord` 增加 `objectKey` / `ownerId` 兩欄 | M32 同步更新 |
| **SPEC-SCRIPT.md** | 多劇本管理需加上 `script_shares` 共享規則 | M34 同步更新 |
| **CLAUDE.md** | 「純前端架構，無後端」原則須改寫為「**離線優先 + 可選雲端同步**」 | M29 同步更新（見 §15） |

---

## 3. 技術選型決議

| 層 | 選擇 | 理由 |
|---|---|---|
| 結構化資料 | **Supabase Postgres**（free tier：500 MB DB / 50k MAU / Auth 內建） | 50 人團隊永遠在配額內；Row Level Security 直接解決共享權限 |
| 音檔儲存 | **Cloudflare R2**（free 10 GB + **永久零 egress 費用**） | 1~50 GB 場景下唯一不會被 egress 噴錢的選項；50 GB 月費約 $0.60 |
| Auth | **Supabase Auth**（Magic Link） | 不需自己接 OAuth；可後續擴 Google SSO |
| 後端執行環境 | **Supabase Edge Functions（Deno）** | 處理 R2 presigned URL 簽發；CPU 時間在 free tier 內充足 |
| 前端 | **Next.js（不變）**，部署 Vercel 或 Cloudflare Pages（皆 free） | 不變更現有前端框架 |
| 本地快取 | **IndexedDB（保留）** | 離線可用、減少 R2 GET 次數 |

**月成本預估**（< 50 人 + 50 GB 音檔上限）：**$0 ~ $1 USD**

**已排除**（理由見前述討論）：Firebase（egress 噴錢）、Cloudflare D1 全家桶（缺 RLS 成熟度）、自架 VPS（時間成本不划算）、純前端 + Google Drive 同步（不是真同步）。

---

## 4. 系統架構（邏輯視圖）

```
┌────────────────────────────────────────────────────────────────────────┐
│                          瀏覽器（Next.js）                              │
│                                                                        │
│   ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐    │
│   │  UI 元件     │ ←→ │  Hooks / 業務層   │ ←→ │  本地快取 (IDB)  │    │
│   └──────────────┘    └──────────────────┘    └──────────────────┘    │
│                              ↕                                         │
│                       ┌──────────────────┐                             │
│                       │  Cloud Sync 層   │                             │
│                       └──────────────────┘                             │
└─────────────────────────────│──────────│───────────────────────────────┘
                              │          │
                  (HTTPS, JWT)│          │(presigned URL, 直連 R2)
                              ↓          ↓
              ┌────────────────────┐  ┌──────────────────────┐
              │  Supabase          │  │  Cloudflare R2       │
              │  - Postgres        │  │  - audio blobs       │
              │  - Auth            │  └──────────────────────┘
              │  - Edge Functions  │
              │  - Realtime        │
              └────────────────────┘
```

**關鍵設計：音檔流量永不經過 Supabase Edge Function**。前端拿到 presigned URL 後直連 R2，免費 egress 才有意義。

---

## 5. 資料模型（Supabase Postgres Schema）

### 5.1 Table 定義（DDL 草圖，非最終代碼）

```sql
-- 使用者：Supabase Auth 自動建立 auth.users，業務 metadata 另開
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz default now()
);

create table scripts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  source        text not null check (source in ('plain-text','pdf','image-ocr')),
  content       jsonb not null,    -- 整份 Script（characters + pages + lines）
  content_hash  text not null,     -- SHA-256；對應現有 scriptHash
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index scripts_owner_idx on scripts(owner_id);

create table script_shares (
  script_id   uuid not null references scripts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  permission  text not null check (permission in ('read','write')),
  created_at  timestamptz default now(),
  primary key (script_id, user_id)
);

create table audio_segments (
  id             uuid primary key default gen_random_uuid(),
  script_id      uuid not null references scripts(id) on delete cascade,
  owner_id       uuid not null references profiles(id) on delete cascade,
  character_key  text not null,
  global_index   int  not null,
  object_key     text not null,        -- R2 物件 key，命名規則見 §6
  mime_type      text not null,
  duration_ms    int  not null,
  size_bytes     bigint not null,
  script_hash    text not null,        -- 錄製當下劇本 hash
  recorded_at    timestamptz default now(),
  unique (script_id, owner_id, character_key, global_index)
);
create index audio_segments_script_char_idx
  on audio_segments(script_id, character_key);

create table practice_states (
  user_id                       uuid not null references profiles(id) on delete cascade,
  script_id                     uuid not null references scripts(id) on delete cascade,
  last_character                text,
  last_line_index               int,
  practice_count_by_character   jsonb default '{}'::jsonb,
  updated_at                    timestamptz default now(),
  primary key (user_id, script_id)
);
```

### 5.2 與現有型別的對應

| 現有 TypeScript 型別 | 雲端 table |
|---|---|
| `ScriptRecord` (`lib/types.ts:171`) | `scripts` |
| `AudioSegmentRecord` (`lib/types.ts:157`) | `audio_segments`（blob 改放 R2，多 `object_key` 欄） |
| `PracticeState` (`lib/types.ts:114`) | `practice_states`（per script_id） |
| `SessionConfig` (`lib/sessionConfig.ts`) | **不上雲**，繼續放 sessionStorage |

> **重點**：`practiceCountByCharacter` 由全局移到 per script_id，順帶解決 M28 QA 列的 backlog（同名 character key 計數混疊）。

---

## 6. R2 物件命名規則

```
scripts/{script_id}/{owner_id}/{character_key}/{global_index}.{ext}
```

- `{ext}` 由 `mime_type` 決定（`audio/webm` → `webm`、`audio/mp4` → `mp4`）。
- 路徑中含 `owner_id` 可用 prefix 批次刪除某使用者所有錄音。
- 刪除劇本時：先列出 `scripts/{script_id}/` 下所有物件 → 批次刪 → 再刪 row（cascade 已處理 metadata 但 R2 不會自動清）。

**Bucket 名稱**：`script-rehearsal-audio`（production）／`script-rehearsal-audio-dev`（開發）。

---

## 7. Row Level Security (RLS) 策略

> 所有 table 啟用 RLS。以下為 policy 規則的文字描述，實際 SQL 由 M30/M31/M32 撰寫。

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | 自己 + 與自己共享劇本的成員 | 自己 | 自己 | 自己 |
| `scripts` | `owner_id = auth.uid()` OR 出現在 `script_shares` | `owner_id = auth.uid()` | owner OR share=write | owner |
| `script_shares` | 自己參與的列（任一側） | owner of script | owner of script | owner of script |
| `audio_segments` | script 可讀者皆可 | `owner_id = auth.uid()` AND script 可讀 | 錄音 owner | 錄音 owner OR script owner |
| `practice_states` | `user_id = auth.uid()` | `user_id = auth.uid()` | 自己 | 自己 |

---

## 8. Edge Function API 介面

> 命名格式 `/functions/v1/{name}`，皆需 `Authorization: Bearer <JWT>`。

### 8.1 `audio-upload-url`（POST）

**目的**：簽發 R2 presigned PUT URL，回傳給前端直傳音檔。

**Request body**：
```json
{
  "scriptId": "uuid",
  "characterKey": "維",
  "globalIndex": 12,
  "mimeType": "audio/webm",
  "sizeBytes": 48213,
  "durationMs": 3120,
  "scriptHash": "sha256-hex"
}
```

**Response**：
```json
{
  "segmentId": "uuid",
  "objectKey": "scripts/{...}/12.webm",
  "uploadUrl": "https://r2-presigned-put-url",
  "expiresAt": "2026-05-17T12:34:56Z"
}
```

**流程**：
1. 驗 JWT → 取 `user_id`
2. 透過 Supabase service-role 驗證 RLS（script 可寫）
3. 在 `audio_segments` 寫 row（狀態欄可加 `status: 'pending'`，待前端 confirm 後改 `complete`）
4. 用 R2 S3 API 簽 5 分鐘 presigned PUT
5. 回傳

### 8.2 `audio-upload-complete`（POST）

**目的**：前端 PUT 成功後通知後端，標記 segment 為已完成。

```json
{ "segmentId": "uuid" }
```

### 8.3 `audio-play-url`（GET）

**目的**：簽發 R2 presigned GET URL 供前端播放。

**Query**：`?segmentId=uuid`

**Response**：
```json
{ "playUrl": "https://r2-presigned-get-url", "expiresAt": "..." }
```

### 8.4 `audio-delete`（POST）

刪一筆 segment（同步刪 R2 物件 + Postgres row）。

### 8.5 `script-delete-cascade`（POST）

刪整份劇本：列出 R2 prefix → 批次刪物件 → 刪 Postgres row（後者由 cascade 處理 audio_segments / shares / practice_states）。

---

## 9. 同步協定（IDB ↔ Cloud）

### 9.1 寫入路徑（mutation）

```
使用者動作（新增/編輯劇本、錄音、更新 practiceState）
   │
   ├─► 立即寫本地 IDB（樂觀更新，UI 不卡）
   │     並標記 dirty = true、bumped local updated_at
   │
   └─► 嘗試寫雲端（透過 Edge Function 或 supabase-js）
        │
        ├─ 成功 → 清 dirty 旗標
        └─ 失敗（離線 / 5xx）→ 留 dirty，下次回網時補 push
```

### 9.2 讀取路徑（query）

```
首次登入 / 切裝置：
  1. supabase-js 取 cloud scripts / audio_segments metadata → 寫 IDB
  2. 音檔 Blob 不預先全部下載；播放時才 GET presigned URL，下載完存進 IDB 快取

日常使用：
  1. 直接讀 IDB（無感）
  2. 背景訂閱 Supabase Realtime（postgres_changes），雲端有變動時 patch IDB
```

### 9.3 衝突解決

**規則：last-write-wins by `updated_at`（cloud 時鐘為準）**

- 同一份 `scripts` 雲端與本地都有變動：比較 `updated_at`，較新覆蓋較舊。
- `audio_segments` 不容易衝突（unique key 已綁 owner_id + global_index）；同 owner 在兩裝置錄同一行 → 後到的覆蓋前者，前者 R2 物件由 cleanup job 清除孤兒。
- `practice_states` 永遠以最新 `updated_at` 為準（不合併計數）。

**不做 CRDT**。第一版接受「最後寫入勝」會丟失少量同時編輯場景的中間狀態，文件須明文告知使用者。

### 9.4 離線 → 回網

- 本地維護一個 `sync_queue` IDB store：`{ id, kind, payload, createdAt, retryCount }`
- `online` event → 依序 flush queue
- 衝突仍以 cloud `updated_at` 較新者為準

---

## 10. 安全與合規

| 主題 | 規範 |
|---|---|
| 個資 | 音檔為真人聲紋 = 個資。註冊頁須加同意條款，明示「音檔將上傳至 Cloudflare R2（美國）」。 |
| 機房 | Supabase 預設 `us-east-1`；可選 `ap-southeast-1`（新加坡）較近台灣，註冊專案時指定。 |
| Secret | R2 access key / secret 只放 Supabase Edge Function 的 ENV，**不准**出現在前端 bundle。 |
| JWT | Supabase Auth 簽發；Edge Function 用 `verifyJwt` 驗。 |
| Presigned URL TTL | 上傳 5 分鐘、下載 5 分鐘；過期需重簽。 |
| 刪除權 | 使用者主動刪劇本 → cascade 連同 R2 物件刪光。設定頁需提供「匯出我的資料」與「刪除帳號」入口（M35 之後）。 |

---

## 11. 環境變數規範

| Key | 位置 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel | 前端 supabase-js |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel | 前端 supabase-js（受 RLS 保護） |
| `SUPABASE_SERVICE_ROLE_KEY` | **僅** Edge Function 的 Secrets | Edge Function 跨 RLS 用 |
| `R2_ACCOUNT_ID` | Edge Function Secrets | R2 S3 endpoint |
| `R2_BUCKET` | Edge Function Secrets | bucket name |
| `R2_ACCESS_KEY_ID` | Edge Function Secrets | R2 S3 API |
| `R2_SECRET_ACCESS_KEY` | Edge Function Secrets | R2 S3 API |

**禁止**：任何 `SERVICE_ROLE_KEY` 或 R2 secret 進入 `NEXT_PUBLIC_*`。

---

## 12. 里程碑與實作流程（M29 ~ M35）

> 每個里程碑都需走 `/dev-trio`（PM → Dev → QA）。本節只列**流程**，不寫代碼。
> 預估時程為「集中開發」的工作日，實際視週可用時段而定。

---

### M29 — 雲端基礎建設與規格凍結

**目的**：把帳號、bucket、ENV、CLAUDE.md 都備好，後續里程碑可以直接寫業務代碼。

**前置條件**：本文件（SPEC-BACKEND.md）經使用者批准。

**步驟**：
1. 註冊 Supabase 專案（region 選 `ap-southeast-1`），記錄 URL / anon key / service-role key。
2. 註冊 Cloudflare R2 → 建立 bucket `script-rehearsal-audio` 與 `script-rehearsal-audio-dev`，產 S3 API token。
3. 在 Supabase Dashboard 啟用 Auth → Magic Link，設定 Site URL = 本機 dev URL 與部署 URL。
4. 在 Supabase Edge Functions 設定 Secrets（§11 表所列）。
5. 本機 `.env.local.example` 建立模板（**不寫真實值**），`.gitignore` 確認 `.env.local` 已排除。
6. 更新 `CLAUDE.md`：技術守則第一條「純前端架構，無後端、無雲端強依賴」改為「**離線優先；可選 Supabase + R2 雲端同步**」並指向本文件。
7. 更新 `SPEC.md §2` 技術棧表，新增「雲端同步（可選）」列。

**產出檔案**（無代碼）：
- `.env.local.example`（新增）
- `CLAUDE.md`（修改）
- `SPEC.md`（修改）
- `PROGRESS.md` M29 章節（PM 撰寫）

**驗收**：
- [ ] Supabase / R2 dashboard 可登入且資源就緒
- [ ] `.env.local.example` 列出所有需要的 key（但不含真實值）
- [ ] `CLAUDE.md` 與 `SPEC.md` 已同步
- [ ] `npx tsc --noEmit` exit 0（純文件變動）

**預估**：0.5 工作日（不含等 Supabase confirm email 之類）

---

### M30 — Supabase Auth 接入

**目的**：使用者可以登入 / 登出；其他功能尚不接雲端。

**前置條件**：M29 完成。

**步驟**：
1. 安裝 `@supabase/supabase-js`、建立 `lib/supabase/client.ts` 與 `lib/supabase/server.ts`（分別給 browser / Edge / RSC 用）。
2. 新增 `app/login/page.tsx`：Magic Link 表單，輸入 email → 寄出連結。
3. 新增 `app/auth/callback/route.ts`：處理 magic link 回調，設定 session cookie。
4. 在 `app/layout.tsx` 注入 Auth context provider；新建 `hooks/useUser.ts`。
5. 對需要登入的頁面（`/`, `/setup`, `/rehearse`, `/record`, `/scripts/*`）加 middleware 守衛 → 未登入導 `/login`。
6. Header / 首頁右上角加「登入身份顯示 + 登出按鈕」。
7. 建立 `profiles` table、寫 RLS、寫 trigger（auth.users insert → 自動建 profiles row）。

**產出檔案**：
- `lib/supabase/client.ts`、`lib/supabase/server.ts`（新）
- `app/login/page.tsx`、`app/auth/callback/route.ts`（新）
- `hooks/useUser.ts`（新）
- `middleware.ts`（新，root）
- Supabase migration SQL 檔（profiles + RLS + trigger）

**驗收**：
- [ ] 未登入訪問 `/` 自動導 `/login`
- [ ] 收到 magic link、點擊後成功登入並回到原頁
- [ ] 登入後 header 顯示 email；登出後回 `/login`
- [ ] 重整頁面 session 不掉
- [ ] `npx tsc --noEmit` exit 0、`npm run build` 全綠
- [ ] 多裝置同 email 登入互不衝突

**預估**：1 ~ 1.5 工作日

---

### M31 — 劇本雲端化

**目的**：劇本從 IDB 升為「雲端 + IDB 快取」。跨裝置登入後看得到同一份劇本。

**前置條件**：M30 完成。

**步驟**：
1. 建立 `scripts` + `script_shares` table 與 RLS（見 §5、§7）。
2. `lib/cloudSync/scripts.ts`（新）：封裝 CRUD（list / get / upsert / delete）。
3. 重寫 `lib/scriptStorage.ts` 為「先寫雲端 → 同步寫 IDB；讀取優先 IDB」。
4. 首次登入：呼叫 cloud list → 全量寫入 IDB → 觸發 `ACTIVE_SCRIPT_CHANGED_EVENT`。
5. `hooks/useScript.ts`：在 mount 與 user 切換時補一次背景 cloud refresh。
6. 訂閱 Supabase Realtime postgres_changes（`scripts` table）→ 雲端變動時 patch IDB。
7. **不影響音檔**（音檔仍是純 IDB，下一個里程碑處理）。
8. 同步更新 `SPEC.md §3`、`SPEC-SCRIPT.md`、`README.md` 中關於劇本來源的描述。

**驗收**：
- [ ] A 裝置匯入劇本，B 裝置登入後 5 秒內看得到
- [ ] 離線時編輯劇本 → 回網後自動 push
- [ ] 編輯衝突：以雲端 `updated_at` 較新者為準（手動驗）
- [ ] 既有 IDB 內已有劇本：登入後不丟失，第一次同步走「本地 → 雲端」push
- [ ] 登出 → IDB 清空（避免他人在共用電腦看到上一個人的劇本）
- [ ] `npx tsc --noEmit` exit 0、build 全綠

**預估**：2 ~ 3 工作日

---

### M32 — 音檔 R2 化（核心里程碑）

**目的**：音檔上傳 R2、播放走 presigned URL；IDB 降為快取。

**前置條件**：M31 完成。

**步驟**：
1. 建立 `audio_segments` table 與 RLS。
2. 在 Supabase 寫 4 個 Edge Function（§8）：`audio-upload-url`、`audio-upload-complete`、`audio-play-url`、`audio-delete`。
3. `lib/cloudSync/audio.ts`（新）：封裝呼叫上述 Function 的 helper。
4. 修改 `lib/recordingFlow.ts`：錄音 stop 後 → 申請 presigned PUT → 直傳 R2 → 通知 complete → 同時把 Blob 留在 IDB 當快取。
5. 修改 `lib/audioPlayer.ts`：播放時先試 IDB 快取；miss 則呼叫 `audio-play-url` → fetch Blob → 快取進 IDB → 播放。
6. 修改 `app/record/*`：UI 顯示「上傳中／上傳成功／上傳失敗（重試）」狀態。
7. 修改 `app/setup` 的 AudioManager 進度徽章：合併本地與雲端覆蓋率（雲端優先）。
8. 同步更新 `SPEC-AUDIO.md §4.1` 的 `AudioSegmentRecord` 型別新欄位。

**驗收**：
- [ ] A 裝置錄音 → R2 console 看得到對應物件
- [ ] B 裝置登入 → 點播放 → 成功從 R2 拉取並播放
- [ ] 已快取的音檔再播 → IDB 直接命中，不打 R2
- [ ] 離線錄音 → queue 起來，回網後自動 PUT
- [ ] 上傳失敗：UI 顯示錯誤、可手動重試
- [ ] 刪除一筆 segment → R2 物件與 Postgres row 同步消失
- [ ] `npx tsc --noEmit` exit 0、build 全綠

**預估**：3 ~ 4 工作日（含 Edge Function 寫 + 測試）

---

### M33 — 練習狀態（PracticeState）雲端化

**目的**：跨裝置記住「上次練到哪、各角色累計次數」。

**前置條件**：M32 完成。

**步驟**：
1. 建立 `practice_states` table（per script_id）與 RLS。
2. 修改 `lib/storage.ts`：將 `PracticeState` 改成「per scriptId」儲存；同步寫入雲端與 localStorage。
3. 既有 localStorage 的 global PracticeState：第一次登入時做一次性 migration（推到當前 active script 對應的雲端 row），完成後刪除舊 key。
4. `hooks/usePractice.ts`（新或既有）：訂閱雲端變化、回寫雲端。
5. 同步解決 M28 QA 列的 backlog（per-scriptId 索引）。

**驗收**：
- [ ] A 裝置練到第 10 行登出，B 裝置登入後接續顯示第 10 行
- [ ] 各角色 practice count 在兩裝置一致
- [ ] 既有 localStorage PracticeState 自動遷移後不再殘留
- [ ] 不同劇本的 PracticeState 互不干擾
- [ ] `npx tsc --noEmit` exit 0、build 全綠

**預估**：1 工作日

---

### M34 — 劇本共享（script_shares）

**目的**：演員 / 導演間互相分享劇本與錄音。

**前置條件**：M33 完成。

**步驟**：
1. RLS 已於 M31 預埋；本里程碑加 UI。
2. 在劇本管理頁加「共享」按鈕 → 輸入對方 email → 查 `auth.users` → 寫 `script_shares` 一筆。
3. 受邀者首頁顯示「他人分享給我的劇本」分區（與「我的劇本」分開）。
4. 權限差異：`read` 可看可練可錄自己的音檔；`write` 額外可編輯劇本內容。
5. 對方未註冊：顯示「該 email 尚未註冊，邀請寄出後對方註冊即可看到」（M35 之後可加 invite email）。
6. 同步更新 `SPEC-SCRIPT.md` 共享章節。

**驗收**：
- [ ] A 將劇本共享給 B（read）→ B 看得到、能練、能錄自己音檔
- [ ] A 設定 B 為 write → B 能編輯劇本，A 的劇本同步更新
- [ ] B 看不到 C 的音檔（owner_id 隔離）
- [ ] A 撤銷共享 → B 立即看不到該劇本
- [ ] `npx tsc --noEmit` exit 0、build 全綠

**預估**：1.5 ~ 2 工作日

---

### M35 — 離線優先強化 + 觀測 + 結案

**目的**：把離線體驗、cleanup、用量監控收尾，整個雲端化里程碑可以對外宣稱完成。

**前置條件**：M34 完成。

**步驟**：
1. 引入 `sync_queue` IDB store + `online` 事件 listener，統一管理離線 dirty 任務。
2. 加 UI 指示器：右上角小圖示顯示「離線中（n 項待同步）／同步中／已同步」。
3. 在 Supabase 寫 cron Function（每日跑一次）：列出 R2 但 Postgres 無對應 row 的物件（孤兒）→ 刪除。
4. 在設定頁加「我的雲端用量」：DB rows 數、R2 GB 數（呼叫一個 stat Edge Function 取得）。
5. 設定頁加「匯出全部資料」（zip 含所有劇本 JSON + 音檔）與「刪除我的帳號」（cascade 清光）。
6. 撰寫 `TEST-FLOW.md` 新章節：跨裝置 / 離線 / 共享情境完整測試流程。
7. 更新 `README.md`：新增「雲端同步（可選）」章節，含註冊、設定、ENV 指引。

**驗收**：
- [ ] 飛航模式下完整可用（已快取資料）；恢復網路後自動同步
- [ ] 同步指示器狀態與實際 queue 一致
- [ ] R2 孤兒物件每日自動清理
- [ ] 「匯出」按鈕產出可用 zip
- [ ] 「刪除帳號」後 Postgres 與 R2 都清空
- [ ] `npx tsc --noEmit` exit 0、build 全綠

**預估**：2 ~ 3 工作日

---

## 13. 累計時程預估

| 里程碑 | 工作日 |
|---|---|
| M29 雲端基礎建設 | 0.5 |
| M30 Auth | 1 ~ 1.5 |
| M31 劇本雲端化 | 2 ~ 3 |
| M32 音檔 R2 化 | 3 ~ 4 |
| M33 PracticeState 雲端化 | 1 |
| M34 劇本共享 | 1.5 ~ 2 |
| M35 離線強化 + 結案 | 2 ~ 3 |
| **合計** | **11 ~ 15 工作日** |

---

## 14. 風險與待決策事項

| # | 風險 / 議題 | 因應 |
|---|---|---|
| R1 | 同時編輯衝突丟資料（不做 CRDT） | UI 明文告知；衝突發生時保留 loser 版本到「衝突紀錄」可手動還原（M35 後可加） |
| R2 | R2 / Supabase 任一服務宕機 | 完全離線可用；前端不依賴雲端才能啟動 |
| R3 | Free tier 用量超標 | M35 用量看板 + email 告警；50 GB 上限提前提示 |
| R4 | 個資合規（GDPR / 台灣個資法） | 註冊頁同意條款；提供匯出 / 刪除入口 |
| R5 | Magic Link email 寄不到（垃圾信箱） | 第一次設定時測試；後續可加 Google OAuth |
| R6 | R2 presigned URL 在防火牆嚴格網路下被擋 | 預留可改走 Edge Function 代理的 fallback（成本：吃 CPU + egress；只在必要時開啟） |
| R7 | `SUPABASE_SERVICE_ROLE_KEY` 外洩 | CI / git hook 加 secret scan；只放 Edge Function Secrets |

---

## 15. CLAUDE.md 須更新清單（M29 內完成）

| 段落 | 變更前 | 變更後 |
|---|---|---|
| 技術守則 1 | 純前端架構，無後端、無雲端強依賴 | **離線優先**；可選 Supabase + R2 雲端同步（見 SPEC-BACKEND.md） |
| 規格版本 | 當前實作目標：SPEC-AUDIO.md v3.0 | 新增：雲端整合 SPEC-BACKEND.md v1.0（並行） |
| 技術守則 SSR 安全 | （不變） | 加註：Supabase client 也須 SSR 守衛或走 server client |

---

## 16. 不在本規格範圍

以下功能**不**在 M29 ~ M35 範圍，避免 scope creep：

- 多語系 / i18n
- 分析儀表板（進步曲線、熱力圖）
- AI 回饋（情緒分析、語速建議）
- 商用付費方案
- 行動原生 App
- 即時對戲（多人同時連線練同一段）
- CRDT / 真正的並行編輯

以上若日後需要，各自獨立開新 SPEC 文件。

---

## 17. 變更歷史

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-05-17 | v1.0 | 初版（規劃，未實作）。等使用者批准後進入 M29。 |
