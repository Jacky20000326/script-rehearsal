import type { ReactElement } from "react";

export type EditFallbackKind =
  | { kind: "loading" }
  | { kind: "missing"; scriptId: string }
  | { kind: "error"; message: string | null };

export type EditFallbackProps = {
  readonly state: EditFallbackKind;
  readonly onHome: () => void;
};

export function EditFallback({ state, onHome }: EditFallbackProps): ReactElement {
  if (state.kind === "loading") {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-zinc-500">載入中…</p>
        </div>
      </main>
    );
  }

  if (state.kind === "missing") {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl space-y-4 px-6 py-12">
          <h1 className="text-3xl">找不到劇本</h1>
          <p className="text-sm text-zinc-500">id：{state.scriptId}</p>
          <HomeButton onClick={onHome} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-12">
        <h1 className="text-3xl">劇本載入失敗</h1>
        {state.message && (
          <p className="font-mono text-sm text-red-400">{state.message}</p>
        )}
        <HomeButton onClick={onHome} />
      </div>
    </main>
  );
}

function HomeButton({ onClick }: { readonly onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-600 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
    >
      返回首頁
    </button>
  );
}
