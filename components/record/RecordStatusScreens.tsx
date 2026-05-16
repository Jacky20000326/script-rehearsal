import type { ReactElement, ReactNode } from "react";
import Link from "next/link";

function PageShell({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">{children}</div>
    </main>
  );
}

function BackToSetup(): ReactElement {
  return (
    <Link
      href="/setup"
      className="inline-block rounded border border-zinc-700 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
    >
      返回設定
    </Link>
  );
}

export function LoadingScreen(): ReactElement {
  return (
    <PageShell>
      <p className="text-zinc-500">載入中…</p>
    </PageShell>
  );
}

export function ScriptErrorScreen({
  message,
}: {
  readonly message: string;
}): ReactElement {
  return (
    <PageShell>
      <h1 className="text-3xl">載入劇本失敗</h1>
      <p className="text-red-400 font-mono">{message}</p>
      <BackToSetup />
    </PageShell>
  );
}

export function ScriptMissingScreen(): ReactElement {
  return (
    <PageShell>
      <h1 className="text-3xl">劇本不存在</h1>
      <BackToSetup />
    </PageShell>
  );
}

export function NoLinesScreen({
  characterFullName,
}: {
  readonly characterFullName: string;
}): ReactElement {
  return (
    <PageShell>
      <h1 className="text-3xl">此角色沒有任何台詞</h1>
      <p className="text-zinc-400">
        找不到角色「{characterFullName}」的任何對白行，請確認角色設定。
      </p>
      <BackToSetup />
    </PageShell>
  );
}

export function SegmentsErrorScreen({
  message,
}: {
  readonly message: string;
}): ReactElement {
  return (
    <PageShell>
      <h1 className="text-3xl">讀取已錄片段失敗</h1>
      <p className="text-red-400 font-mono">{message}</p>
      <BackToSetup />
    </PageShell>
  );
}

export function InvalidCursorScreen(): ReactElement {
  return (
    <PageShell>
      <h1 className="text-3xl">行索引無效</h1>
      <BackToSetup />
    </PageShell>
  );
}
