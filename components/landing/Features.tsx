/** Landing 三個特色區塊。 */

import type { ReactElement } from "react";

type Feature = {
  readonly title: string;
  readonly body: string;
};

const features: readonly Feature[] = [
  {
    title: "像真的有對手 — 預先錄下自己念其他角色的聲音",
    body: "對練時播放真實人聲，不是冷冰冰的合成音。",
  },
  {
    title: "節奏由你掌握 — 念完一句，系統才接下一句",
    body: "忘詞時可以開提示，背熟了就關掉。",
  },
  {
    title: "想練哪段就練哪段 — 整齣、單頁、或自選任意起訖行",
    body: "劇本可以匯入文字、PDF 或拍照。",
  },
];

export function Features(): ReactElement {
  return (
    <section className="py-24">
      <div className="mx-auto flex max-w-[640px] flex-col gap-16 px-6">
        {features.map((f) => (
          <div key={f.title} className="space-y-3">
            <h3 className="text-h3 text-[var(--ink-strong)]">{f.title}</h3>
            <p className="text-body text-[var(--ink)]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
