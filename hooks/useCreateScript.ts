"use client";

/**
 * useCreateScript — 共用「建立 ScriptRecord → setActive → 跳轉編輯頁」流程（M24）
 *
 * 把 putScript + setActiveScriptId + router.push 抽離主元件，
 * 同時統一 SSR 安全的 id 產生（crypto.randomUUID 守衛）。
 */

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ParseResult } from "@/lib/scriptParser";
import { putScript, setActiveScriptId } from "@/lib/scriptStorage";
import type { ScriptRecord } from "@/lib/types";

function newScriptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `script-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type UseCreateScript = {
  busy: boolean;
  error: string | null;
  create: (args: {
    name: string;
    source: ScriptRecord["source"];
    preview: ParseResult;
  }) => Promise<void>;
  clearError: () => void;
};

export function useCreateScript(): UseCreateScript {
  const router = useRouter();
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async ({
      name,
      source,
      preview,
    }: {
      name: string;
      source: ScriptRecord["source"];
      preview: ParseResult;
    }): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const id = newScriptId();
        const now = Date.now();
        const record: ScriptRecord = {
          id,
          name: name.trim(),
          script: preview.script,
          createdAt: now,
          updatedAt: now,
          source,
        };
        await putScript(record);
        setActiveScriptId(id);
        router.push(`/scripts/${encodeURIComponent(id)}/edit`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    },
    [router],
  );

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return { busy, error, create, clearError };
}
