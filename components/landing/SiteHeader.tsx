/** Landing 用極輕 header。 */

import Link from "next/link";
import type { ReactElement } from "react";

export function SiteHeader(): ReactElement {
  return (
    <header className="h-16 w-full border-b border-[var(--border)]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-[18px] text-[var(--ink-strong)]"
          style={{ fontFamily: "var(--font-serif-tc)" }}
        >
          劇本對練
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-[var(--ink)] transition-colors duration-[120ms] ease-out hover:bg-[rgba(28,26,23,0.04)]"
          >
            關於
          </Link>
          <Link
            href="/setup"
            className="rounded-md px-3 py-2 text-sm text-[var(--ink)] transition-colors duration-[120ms] ease-out hover:bg-[rgba(28,26,23,0.04)]"
          >
            開始
          </Link>
        </nav>
      </div>
    </header>
  );
}
