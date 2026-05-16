/** Landing 頁尾。 */

import type { ReactElement } from "react";

export function SiteFooter(): ReactElement {
  return (
    <footer className="h-12 w-full border-t border-[var(--border)]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <p className="text-caption text-[var(--ink-muted)]">劇本對練 · 2026</p>
      </div>
    </footer>
  );
}
