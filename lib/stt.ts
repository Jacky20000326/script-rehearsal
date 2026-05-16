/**
 * STT 服務 — Web Speech API SpeechRecognition 封裝 + 模糊比對演算法
 *
 * 負責：
 *   - 啟動 / 停止語音辨識（continuous + interimResults）
 *   - 將累積的 interim/final 結果與目標台詞做模糊比對
 *   - 達到比對門檻時透過 onMatch 回拋
 *
 * 設計重點：
 *   1. TypeScript 對 `SpeechRecognition` 沒有官方型別，本檔在內部宣告
 *      最小化型別，避免引入 @types/dom-speech-recognition。
 *   2. 不同瀏覽器入口：標準 `SpeechRecognition` 與 webkit 前綴
 *      `webkitSpeechRecognition`；以 unknown + type guard 取得。
 *   3. 比對演算法：LCS（最長公共子序列）/ 目標字數，比單純 includes 穩健，
 *      能處理「辨識結果包含目標字元但中間摻雜其他字」的情況。
 *   4. 標點與空白統一以 Unicode property /[\p{P}\s]/gu 過濾。
 *   5. SSR 安全：所有 window 存取在 typeof window !== 'undefined' 後。
 */

// ---------- 內部最小化 Web Speech API 型別 ----------
//
// 這些型別僅供本檔使用，不對外輸出。命名沿用 W3C 草案。
// 我們只用到 onresult / onerror / onend / start / stop / abort
// 與 continuous / interimResults / lang 設定，故只宣告必要欄位。

type SRAlternative = {
  readonly transcript: string;
  readonly confidence: number;
};

type SRResult = {
  /** 是否為 final（非 interim） */
  readonly isFinal: boolean;
  /** 索引化以便 [0] 取出最佳替代 */
  readonly [index: number]: SRAlternative;
  readonly length: number;
};

type SRResultList = {
  readonly [index: number]: SRResult;
  readonly length: number;
};

type SREvent = {
  readonly results: SRResultList;
  readonly resultIndex: number;
};

type SRErrorEvent = {
  readonly error: string;
  readonly message?: string;
};

type SRInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SRConstructor = new () => SRInstance;

/** 取得瀏覽器的 SpeechRecognition constructor，沒有就回 null */
function getSpeechRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------- 公開：模糊比對演算法 ----------

/**
 * 統一化：移除所有標點與空白，並做全形→半形（僅針對 ASCII 範圍）的最小化處理。
 *
 * - 中英文標點都會被吃掉（/[\p{P}\s]/gu）
 * - 全形空白也屬於 \s，會被吃掉
 * - 不做繁簡轉換（瀏覽器辨識結果通常已是 zh-TW；
 *   若辨識回 zh-CN 簡體字，將被視為不同字元，這是已知限制）
 */
function normalizeForCompare(text: string): string {
  return text.replace(/[\p{P}\s]/gu, "");
}

/**
 * 計算兩字串的最長公共子序列（LCS）長度。
 *
 * - 時間 O(m*n)，空間優化為 O(min(m, n))。
 * - 中文常用句長度（< 200 字），此實作足夠快。
 */
function lcsLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // 確保 b 是較短的那個，以節省記憶體
  let short = a;
  let long = b;
  if (a.length > b.length) {
    short = b;
    long = a;
  }

  const m = short.length;
  // 兩層滾動陣列
  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= long.length; i++) {
    for (let j = 1; j <= m; j++) {
      if (long[i - 1] === short[j - 1]) {
        curr[j] = (prev[j - 1] ?? 0) + 1;
      } else {
        curr[j] = Math.max(prev[j] ?? 0, curr[j - 1] ?? 0);
      }
    }
    // swap
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[m] ?? 0;
}

/**
 * 計算辨識結果與目標台詞的相似度。
 *
 * 演算法：LCS(recognized, target) / target.length
 *
 * 為什麼選 LCS 而非簡單 includes 或 Levenshtein：
 *   - includes 太嚴格：「快了親愛的吧」不會 include「快了，親愛的」（標點問題雖然在 normalize 後消失，但仍對「插入字」零容忍）。
 *   - Levenshtein 給插入/刪除/替換都計分，對「STT 多辨識出一些字」太敏感。
 *   - LCS 衡量「目標中有多少比例的字按順序出現在辨識結果中」，
 *     對「念對了但 STT 多辨識出別的字」最寬容，符合「念完即算過關」的需求。
 *
 * 邊界：
 *   - target 為空 → 回 1（避免除以 0；空目標視為立刻通過）
 *   - recognized 為空 → 回 0
 *
 * 範例（normalize 後比較）：
 *   - target=「快了親愛的」(5) recognized=「快了親愛的吧」 → LCS=5 → 1.0
 *   - target=「快了親愛的」(5) recognized=「快了親」 → LCS=3 → 0.6（達門檻）
 *   - target=「快了親愛的」(5) recognized=「快樂親愛」 → LCS=4 → 0.8
 *   - target=「快了親愛的」(5) recognized=「我說快了」 → LCS=2 → 0.4
 */
export function compareSpeech(recognized: string, target: string): number {
  const t = normalizeForCompare(target);
  if (t.length === 0) return 1;
  const r = normalizeForCompare(recognized);
  if (r.length === 0) return 0;
  const lcs = lcsLength(r, t);
  return lcs / t.length;
}

// ---------- 公開：STT 服務 ----------

/** STT listen 期間的回呼集合 */
export type STTConfig = {
  /** interim（含 final）每次有更新時觸發；text 是「累積文字」非單次差異 */
  readonly onInterim?: (text: string) => void;
  /** 出現 isFinal 結果時觸發；text 為該段 final 內容 */
  readonly onFinal?: (text: string) => void;
  /** 累積文字達到比對門檻時觸發 */
  readonly onMatch?: (recognized: string, score: number) => void;
  /** 任何錯誤（含 'no-speech' / 'audio-capture' / 'not-allowed' 等） */
  readonly onError?: (err: { error: string; message?: string }) => void;
};

/** STT 服務 */
export class STTService {
  /** 0–1 之間的比對門檻 */
  private readonly matchThreshold: number;

  /** 當前 SpeechRecognition 實例 */
  private recognition: SRInstance | null = null;

  /** 當前是否在 listening 狀態（注意：與 recognition.onend 同步） */
  private listening = false;

  /** 當前目標台詞 */
  private target = "";

  /** 累積辨識結果（所有 final + 最後一段 interim） */
  private accumulatedFinal = "";
  private lastInterim = "";

  /** 是否已對當前 target 觸發過 onMatch（避免重複觸發） */
  private hasMatched = false;

  /** 當前回呼集合 */
  private config: STTConfig = {};

  constructor(matchThreshold: number = 0.6) {
    // clamp 在 [0, 1]，避免外部誤傳極端值
    this.matchThreshold = Math.min(1, Math.max(0, matchThreshold));
  }

  /** 瀏覽器是否支援 Web Speech API SpeechRecognition */
  isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  /** 是否正在辨識中 */
  isListening(): boolean {
    return this.listening;
  }

  /**
   * 開始辨識；若先前還在辨識，會自動 stop 再啟動。
   *
   * 行為：
   *   - target 用於 onMatch 比對
   *   - 內部累積 final + 最後 interim 後與 target 比對
   *   - 達門檻立即觸發 onMatch（後續仍會 interim 推送，但不會再次觸發 onMatch）
   *   - 若瀏覽器不支援，立即 onError 並不啟動
   */
  startListening(target: string, config: STTConfig): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      config.onError?.({
        error: "not-supported",
        message: "此瀏覽器不支援 Web Speech API SpeechRecognition。",
      });
      return;
    }

    // 若先前還在跑：先收尾再重啟（abort 不會觸發 final 結果）
    if (this.recognition !== null) {
      this.stopListening();
    }

    this.target = target;
    this.accumulatedFinal = "";
    this.lastInterim = "";
    this.hasMatched = false;
    this.config = config;

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "zh-TW";
    // maxAlternatives 預設 1；多了沒幫助反而吃效能

    r.onstart = (): void => {
      // 純標記；不對外暴露 onStart（避免 API 過大）
    };

    r.onresult = (event: SREvent): void => {
      // 從 event.resultIndex 往後掃，把新加入的 final 累積、interim 取最後一段
      let newFinalChunk = "";
      let latestInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          newFinalChunk += alt.transcript;
        } else {
          latestInterim = alt.transcript;
        }
      }
      if (newFinalChunk.length > 0) {
        this.accumulatedFinal += newFinalChunk;
        this.config.onFinal?.(newFinalChunk);
      }
      this.lastInterim = latestInterim;

      const accumulated = this.accumulatedFinal + this.lastInterim;
      this.config.onInterim?.(accumulated);

      // 比對
      if (!this.hasMatched && this.target.length > 0) {
        const score = compareSpeech(accumulated, this.target);
        if (score >= this.matchThreshold) {
          this.hasMatched = true;
          this.config.onMatch?.(accumulated, score);
        }
      }
    };

    r.onerror = (ev: SRErrorEvent): void => {
      // 'no-speech' 等錯誤不一定致命，原樣回拋給呼叫端決策
      this.config.onError?.({ error: ev.error, message: ev.message });
    };

    r.onend = (): void => {
      this.listening = false;
      // Web Speech API 在 continuous=true 時也可能因 silence/timeout 而觸發 onend；
      // 由呼叫端（useRehearsal）決定是否要在當前狀態下重啟。
    };

    try {
      r.start();
      this.recognition = r;
      this.listening = true;
    } catch (e) {
      // 例：在 listening 已啟動時又 start 會丟 InvalidStateError
      this.config.onError?.({
        error: "start-failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * 停止辨識（會觸發 onend）。
   *
   * 使用 abort() 而非 stop()：
   *   - stop() 會把已收到的 audio 做最後一次 final 比對，可能在停止後仍呼叫 onresult
   *     導致 race condition（在 paused 狀態下又被 onMatch 推進）。
   *   - abort() 直接放棄並結束，更可預測。
   */
  stopListening(): void {
    if (this.recognition === null) return;
    const r = this.recognition;
    this.recognition = null;
    this.listening = false;
    // 先解綁 callback，避免 abort 過程中還觸發 result/error
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    r.onstart = null;
    try {
      r.abort();
    } catch {
      // 已停止或瀏覽器極端狀態 → 忽略
    }
  }
}
