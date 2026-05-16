import Link from "next/link";
import type { ReactElement } from "react";

export function ImportHeader(): ReactElement {
  return (
    <header className="space-y-2">
      <Link
        href="/setup"
        className="inline-block text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← 返回設定
      </Link>
      <h1 className="text-3xl font-semibold tracking-wide sm:text-4xl">
        匯入劇本
      </h1>
      <p className="text-sm text-zinc-500">
        支援純文字／PDF／圖片 OCR 三種來源，全程於瀏覽器端處理。
      </p>
    </header>
  );
}
