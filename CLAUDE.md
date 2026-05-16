# 劇本對練平台 — 專案開發守則

## 規格版本
- 當前實作目標：**SPEC-AUDIO.md v3.0**（逐段引導錄製）
- v2.0（上傳音檔 + Whisper + LCS）已棄用；v3 章節在 SPEC-AUDIO.md 開頭，v2 章節保留供考古
- 母規格：SPEC.md v1.0（不變）

## 開發流程（強制）

任何「實作 / 修改 / 新增功能 / 重構 / 修 bug / 完成里程碑」類任務，**必須先呼叫 `/dev-trio` skill**，依序派遣資深 PM → 資深 Next.js/TS Dev → 資深 QA 三角色協作。
詳見 `~/.claude/skills/dev-trio/SKILL.md`。

例外（可直接動工）：
- 純規格 / 文件文字微調（README / SPEC）
- 一次性查詢 / 程式碼解釋
- 5 行以內、立即可驗證的 hotfix

## 進度追蹤

每個里程碑完成後，由 `/dev-trio` 的 PM 階段更新 `PROGRESS.md`。不要繞過此流程直接動工後才補 PROGRESS。

## 技術守則
- 純前端架構，無後端、無雲端強依賴
- TypeScript strict、不允許 `any` 與 unused vars
- SSR 安全：所有瀏覽器 API（IndexedDB、MediaRecorder、URL）必須 `typeof window === 'undefined'` 守衛
- 不要寫多餘註解；不要為假設的未來抽象
- 子代理禁止跑 `npm run dev`（會掛住 session），改用 `npx tsc --noEmit` 與 `npm run build`
