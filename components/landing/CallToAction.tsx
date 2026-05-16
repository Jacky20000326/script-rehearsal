/** Landing 頁尾 CTA + 「適合誰」區塊。 */

import type { ReactElement } from "react";
import { LinkButton } from "@/components/ui/Button";

export function CallToAction(): ReactElement {
  return (
    <section className="py-24">
      <div className="mx-auto flex max-w-[560px] flex-col items-center px-6 text-center">
        <p className="text-caption uppercase text-[var(--ink-muted)]">
          適合誰
        </p>
        <h2 className="text-h2 mt-4 text-[var(--ink-strong)]">
          給正在準備試鏡、定目劇排練、或單純想把台詞背熟的演員。
        </h2>
        <div className="mt-12">
          <LinkButton href="/setup" variant="primary" size="lg">
            開始準備我的劇本
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
