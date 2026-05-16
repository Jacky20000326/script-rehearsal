/**
 * 錄音頁 — 動態路由 server component 包層
 *
 * 本檔保持極簡：
 *   - 解開 Next 15 async params（Promise）
 *   - decodeURIComponent 還原 characterKey（連結時以 encodeURIComponent 編碼）
 *   - 將實際邏輯委派給 client component `<RecordClient />`
 *
 * 所有麥克風存取、IndexedDB 讀寫、UI 互動皆在 client 端進行。
 */

import type { ReactElement } from "react";
import { RecordClient } from "@/components/record/RecordClient";

type PageProps = {
  params: Promise<{ characterKey: string }>;
};

export default async function RecordPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { characterKey: encodedKey } = await params;
  const characterKey = decodeURIComponent(encodedKey);

  return <RecordClient characterKey={characterKey} />;
}
