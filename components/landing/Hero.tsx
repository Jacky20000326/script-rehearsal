/** Landing Hero 區塊。 */

import type { ReactElement } from "react";
import { LinkButton } from "@/components/ui/Button";

export function Hero(): ReactElement {
  return (
    <section className="flex min-h-screen items-start">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-6 pb-24 pt-[18vh]">
        <h1 className="text-display text-[var(--ink-strong)]">
          一個人，也能把對手戲練好。
        </h1>
        <div className="mt-8 max-w-[560px] space-y-2">
          <p className="text-body-lg text-[var(--ink-muted)]">
            不用約時間、不用拜託朋友陪你讀本。
          </p>
          <p className="text-body-lg text-[var(--ink-muted)]">
            系統幫你念其他角色的台詞，你只負責把自己的演出來。
          </p>
        </div>
        <div className="mt-12">
          <LinkButton href="/setup" variant="primary" size="lg">
            開始準備我的劇本
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
