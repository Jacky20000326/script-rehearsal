/**
 * 純文字劇本匯入頁（M19）
 *
 * Server component 包層，邏輯委派 PlainTextImportClient。
 */

import type { ReactElement } from "react";
import { PlainTextImportClient } from "@/components/scripts/PlainTextImportClient";

export default function ScriptImportPage(): ReactElement {
  return <PlainTextImportClient />;
}
