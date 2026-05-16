/**
 * AudioPlayer — 對練時播放音檔片段（v3 / M15）
 *
 * 設計目標（v3）：
 *   - 直接接收 Blob，內部建立短暫 HTMLAudioElement + ObjectURL
 *   - 一次只播一個片段，stop / 切換時立即中斷且釋放資源
 *   - 用 generation 機制丟棄舊 ended 事件，避免狀態機被舊片段誤推進
 *
 * 為何不再預載 / 不再切片：
 *   v3 將「整檔錄音 + 對齊」改為「逐行錄音」，每段 blob 即是一句台詞；
 *   不需要 currentTime 定位、不需要 endMs 兜底停止，故移除 v2 的 rAF / setTimeout 雙保險。
 *
 * SSR 安全：所有 Audio / URL 操作在 isClient() 守衛後執行；建構函式內不存取 window。
 */

// ---------- 對外型別 ----------

export type AudioPlayerPlayOptions = {
  /** 自然播完時觸發；被 stop() 中斷不觸發 */
  readonly onEnd?: () => void;
  /** 預載 / play() reject / audio error 時觸發 */
  readonly onError?: (message: string) => void;
};

// ---------- 內部小工具 ----------

function isClient(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// ---------- 主類別 ----------

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  /** stop / 切換時遞增，用以丟棄上一輪 audio ended / play() reject */
  private generation = 0;
  private disposed = false;

  // ---------- 公開 API ----------

  /**
   * 播放一段 Blob。
   * 規則：
   *   1. 先 stop()，釋放上一段資源並使其 ended / play() reject 失效
   *   2. createObjectURL + new Audio + 綁 ended / error
   *   3. audio.play().catch → onError
   */
  play(blob: Blob, opts: AudioPlayerPlayOptions): void {
    if (this.disposed) return;
    if (!isClient()) {
      opts.onError?.("AudioPlayer.play() 僅可於瀏覽器端呼叫");
      return;
    }

    this.stop();

    const myGen = ++this.generation;
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;

    audio.onended = (): void => {
      if (myGen !== this.generation) return;
      opts.onEnd?.();
    };
    audio.onerror = (): void => {
      if (myGen !== this.generation) return;
      opts.onError?.("音檔播放錯誤");
    };

    this.audio = audio;
    this.currentUrl = url;

    const playPromise = audio.play();
    void Promise.resolve(playPromise).catch((err: unknown) => {
      if (myGen !== this.generation) return;
      const msg = err instanceof Error ? err.message : "音檔播放失敗";
      opts.onError?.(msg);
    });
  }

  /**
   * 停止當前播放並釋放 ObjectURL。
   * 不會觸發 onEnd / onError。
   */
  stop(): void {
    if (this.disposed) return;
    this.generation++;

    if (!isClient()) {
      this.audio = null;
      this.currentUrl = null;
      return;
    }

    const audio = this.audio;
    const url = this.currentUrl;
    this.audio = null;
    this.currentUrl = null;

    if (audio) {
      try {
        audio.pause();
      } catch {
        // 忽略：某些瀏覽器在 play() 還沒 resolve 時 pause 會丟錯
      }
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.src = "";
      } catch {
        // 忽略
      }
    }
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // 忽略
      }
    }
  }

  /** 完整清理。呼叫後本 instance 不再可用。 */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  /** 是否正在播放 */
  isPlaying(): boolean {
    return this.audio !== null;
  }
}
