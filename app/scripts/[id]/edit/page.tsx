/**
 * 劇本編輯頁 — 動態路由 server component 包層（M19）
 *
 * 解開 Next 15 async params；實際 UI 與儲存邏輯委派 ScriptEditClient。
 */

import type { ReactElement } from "react";
import { ScriptEditClient } from "@/components/scripts/ScriptEditClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScriptEditPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { id: encodedId } = await params;
  const id = decodeURIComponent(encodedId);
  return <ScriptEditClient scriptId={id} />;
}
