/**
 * TTS 服務 — Web Speech API SpeechSynthesis 封裝
 *
 * 負責：
 *   - 取得瀏覽器可用 voices（異步載入處理）
 *   - 將角色 key 映射到 voice + pitch/rate
 *   - 朗讀單行台詞，並把開始/結束/錯誤事件回拋給呼叫端
 *
 * 設計重點：
 *   1. Voice 載入是非同步的（Chrome 第一次取會回空陣列），透過
 *      `voiceschanged` 事件與超時保底 polling 一起處理。
 *   2. 中文偏好順序：zh-TW > zh-CN > zh > 系統預設。
 *   3. 角色音色分配：先按 voice 名稱啟發式分性別（包含關鍵字），
 *      角色性別表決定挑選池，再用 pitch/rate 微調區分同性別兩位角色。
 *   4. 若無 zh voice：console.warn，全部 fallback 預設 voice，純靠 pitch/rate 區分。
 *   5. SSR 安全：所有 `speechSynthesis` 存取在 `typeof window !== 'undefined'` 後。
 *
 * 注意：本服務 stateful（內部緩存 voice map 與 pending utterance），
 *      不適合作為純 module-level singleton（會在 HMR 下殘留 state）。
 *      請透過 useTTS hook 在 effect 內建立並 cancel。
 */

/** 對外 speak 設定 */
export type TTSConfig = {
  /** 要朗讀的文字 */
  readonly text: string;
  /** 角色簡稱（例：「維」「娜塔」） */
  readonly characterKey: string;
  /** utterance 開始播放時呼叫 */
  readonly onStart?: () => void;
  /** utterance 結束（自然念完或被 cancel）時呼叫 */
  readonly onEnd?: () => void;
  /** utterance 發生錯誤時呼叫；err 為原生事件物件 */
  readonly onError?: (err: SpeechSynthesisErrorEvent) => void;
};

/** 角色音色配置（每個角色一份） */
type VoiceAssignment = {
  /** 指派到的 voice；可能為 undefined（瀏覽器無 zh voice）→ 走預設 */
  voice?: SpeechSynthesisVoice;
  /** pitch 微調（0–2，預設 1） */
  pitch: number;
  /** rate 微調（0.1–10，預設 1） */
  rate: number;
};

/** 角色性別啟發式判定 — 純內部用，命中性別表 fallback */
type Gender = "male" | "female" | "unknown";

/**
 * 角色性別表（硬編碼）
 *
 * 用於：voice 名稱中常見性別關鍵字（如「Male」「Female」「曉婷」等）
 * 配對時，挑選與角色性別相符的 voice 池；若 voice 不足以一角色一聲，
 * 同性別的兩位角色用 pitch 微差區分。
 *
 * 若未來新增角色，請在此補上。
 */
const CHARACTER_GENDER: Readonly<Record<string, Gender>> = {
  維: "male", // 維克多
  胡: "male", // 胡利安
  娜塔: "female", // 娜塔莉亞
  卡: "female", // 卡蘿莉娜
};

/** 用於從 voice 名稱啟發式判斷性別 */
const FEMALE_VOICE_KEYWORDS = [
  "female",
  "woman",
  "girl",
  "f)",
  "f ",
  "zh-TW-HsiaoChenNeural", // Edge 微軟
  "zh-TW-HsiaoYuNeural",
  "Mei-Jia",
  "Meijia",
  "Sin-ji",
  "Ting-Ting",
  "Tingting",
];

const MALE_VOICE_KEYWORDS = [
  "male",
  "man",
  "boy",
  "m)",
  "m ",
  "zh-TW-YunJheNeural",
  "Yun",
  "Liang",
  "Hanhan", // 介於兩者，視作 male 後備
];

function guessVoiceGender(voice: SpeechSynthesisVoice): Gender {
  const name = voice.name;
  if (FEMALE_VOICE_KEYWORDS.some((k) => name.includes(k))) return "female";
  if (MALE_VOICE_KEYWORDS.some((k) => name.includes(k))) return "male";
  return "unknown";
}

/**
 * 將 voices 依中文優先級排序：
 *   1. zh-TW > zh-HK > zh-CN > 其他 zh > 非 zh
 *   2. 相同語言內保留瀏覽器原本順序
 */
function rankVoiceByLang(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  if (lang === "zh-tw" || lang.startsWith("zh-tw")) return 0;
  if (lang === "zh-hk" || lang.startsWith("zh-hk")) return 1;
  if (lang === "zh-cn" || lang.startsWith("zh-cn")) return 2;
  if (lang.startsWith("zh")) return 3;
  return 99;
}

/** TTS 服務本體 */
export class TTSService {
  /** 此 service 認得的角色清單（按設定順序） */
  private readonly characters: ReadonlyArray<{ key: string; name: string }>;

  /** 角色 key → voice 配置 */
  private readonly assignments = new Map<string, VoiceAssignment>();

  /** Voice 是否已就緒 */
  private voicesReady = false;

  /** 等候 voices 載入的 promise（共享） */
  private voicesReadyPromise: Promise<void> | null = null;

  /** 當前 utterance，便於 cancel 時釋放 ref */
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(characters: ReadonlyArray<{ key: string; name: string }>) {
    this.characters = characters;
  }

  /**
   * 等待 voices 載入完成，並完成角色 → voice 配置。
   *
   * 解析時機：
   *   - 立即：若 getVoices() 已回非空陣列
   *   - voiceschanged 事件
   *   - 1.5 秒 polling 保底
   *
   * 若最終仍取不到 voices（極端瀏覽器或 SSR），會以「無 voice」狀態完成
   *（角色配置仍存在，只是 voice 為 undefined）。
   */
  async waitForVoices(): Promise<void> {
    if (this.voicesReady) return;
    if (this.voicesReadyPromise) return this.voicesReadyPromise;

    this.voicesReadyPromise = new Promise<void>((resolve) => {
      // SSR 守衛：在 server 環境直接「無 voice」完成
      if (
        typeof window === "undefined" ||
        typeof window.speechSynthesis === "undefined"
      ) {
        this.finalizeAssignments([]);
        this.voicesReady = true;
        resolve();
        return;
      }

      const synth = window.speechSynthesis;

      const tryResolve = (): boolean => {
        const voices = synth.getVoices();
        if (voices.length > 0) {
          this.finalizeAssignments(voices);
          this.voicesReady = true;
          resolve();
          return true;
        }
        return false;
      };

      // 1. 立即嘗試一次
      if (tryResolve()) return;

      // 2. 監聽 voiceschanged
      const onChange = (): void => {
        if (tryResolve()) {
          synth.removeEventListener("voiceschanged", onChange);
          if (pollTimer !== null) {
            window.clearInterval(pollTimer);
            pollTimer = null;
          }
          if (timeoutTimer !== null) {
            window.clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
        }
      };
      synth.addEventListener("voiceschanged", onChange);

      // 3. polling 保底（Chrome 偶爾不觸發 voiceschanged）
      let pollTimer: number | null = window.setInterval(() => {
        if (tryResolve()) {
          synth.removeEventListener("voiceschanged", onChange);
          if (pollTimer !== null) {
            window.clearInterval(pollTimer);
            pollTimer = null;
          }
          if (timeoutTimer !== null) {
            window.clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
        }
      }, 200);

      // 4. 超時保底：1.5 秒內仍無 voice 就視為「無 voice」並解析
      let timeoutTimer: number | null = window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", onChange);
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        if (!this.voicesReady) {
          this.finalizeAssignments(synth.getVoices());
          this.voicesReady = true;
          // eslint-disable-next-line no-console
          console.warn(
            "[TTS] 等待 voices 超時，將以預設 voice 朗讀（pitch/rate 仍會微調角色）。",
          );
          resolve();
        }
      }, 1500);
    });

    return this.voicesReadyPromise;
  }

  /**
   * 將拿到的 voices 配置給角色。
   *
   * 演算法：
   *   1. 篩選中文 voice（zh-TW / zh-CN / zh-*），按 rankVoiceByLang 排序
   *   2. 若無任何中文 voice：console.warn，全部角色 voice = undefined，
   *      pitch/rate 仍依角色性別微調
   *   3. 否則：依角色性別到符合性別的 voice 池中依序取（不夠就 round-robin），
   *      同性別兩位角色用 pitch/rate 偏移區分
   */
  private finalizeAssignments(voices: SpeechSynthesisVoice[]): void {
    const zhVoices = voices
      .filter((v) => v.lang.toLowerCase().startsWith("zh"))
      .sort((a, b) => rankVoiceByLang(a) - rankVoiceByLang(b));

    if (zhVoices.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[TTS] 找不到中文（zh-*）voice，將使用預設 voice。角色仍以 pitch/rate 區分。",
      );
      // 仍給每個角色一份「無 voice」的配置，pitch/rate 依性別微調
      for (let i = 0; i < this.characters.length; i++) {
        const c = this.characters[i];
        if (!c) continue;
        const gender = CHARACTER_GENDER[c.key] ?? "unknown";
        this.assignments.set(c.key, this.basePitchRate(gender, i));
      }
      return;
    }

    // 將 zh voices 依性別分桶
    const malePool: SpeechSynthesisVoice[] = [];
    const femalePool: SpeechSynthesisVoice[] = [];
    const unknownPool: SpeechSynthesisVoice[] = [];
    for (const v of zhVoices) {
      const g = guessVoiceGender(v);
      if (g === "male") malePool.push(v);
      else if (g === "female") femalePool.push(v);
      else unknownPool.push(v);
    }

    // 為每個角色挑選 voice
    // 同性別索引（第幾位男角 / 第幾位女角）用來決定 pitch 偏移
    let maleSeq = 0;
    let femaleSeq = 0;
    let unknownSeq = 0;
    for (let i = 0; i < this.characters.length; i++) {
      const c = this.characters[i];
      if (!c) continue;
      const gender = CHARACTER_GENDER[c.key] ?? "unknown";

      let chosen: SpeechSynthesisVoice | undefined;
      let sameGenderIndex: number;

      if (gender === "male") {
        sameGenderIndex = maleSeq;
        chosen =
          malePool[sameGenderIndex] ??
          unknownPool[unknownSeq] ??
          femalePool[femaleSeq] ??
          zhVoices[i % zhVoices.length];
        if (chosen && malePool.includes(chosen)) maleSeq++;
        else if (chosen && unknownPool.includes(chosen)) unknownSeq++;
      } else if (gender === "female") {
        sameGenderIndex = femaleSeq;
        chosen =
          femalePool[sameGenderIndex] ??
          unknownPool[unknownSeq] ??
          malePool[maleSeq] ??
          zhVoices[i % zhVoices.length];
        if (chosen && femalePool.includes(chosen)) femaleSeq++;
        else if (chosen && unknownPool.includes(chosen)) unknownSeq++;
      } else {
        sameGenderIndex = unknownSeq;
        chosen = zhVoices[i % zhVoices.length];
        unknownSeq++;
      }

      const base = this.basePitchRate(gender, sameGenderIndex);
      this.assignments.set(c.key, {
        ...(chosen ? { voice: chosen } : {}),
        pitch: base.pitch,
        rate: base.rate,
      });
    }
  }

  /**
   * 依性別 + 同性別序號回傳 pitch/rate 基準。
   *
   * 設計：
   *   - 男聲：pitch 0.85（稍低）+ 0.1 * sameGenderIndex 防同性別兩角色撞聲
   *   - 女聲：pitch 1.15（稍高）+ 0.1 * sameGenderIndex
   *   - unknown：pitch 1.0 + 0.08 * sameGenderIndex（避免極端）
   *   - rate：固定 1.0，使用者聽得清楚優先；同性別第二人略快 1.05
   *
   * 邊界：pitch 強制 clamp 在 [0.5, 1.8]、rate 在 [0.7, 1.4]
   */
  private basePitchRate(
    gender: Gender,
    sameGenderIndex: number,
  ): { pitch: number; rate: number } {
    let pitch: number;
    if (gender === "male") pitch = 0.85 + 0.1 * sameGenderIndex;
    else if (gender === "female") pitch = 1.15 + 0.1 * sameGenderIndex;
    else pitch = 1.0 + 0.08 * sameGenderIndex;

    const rate = 1.0 + (sameGenderIndex > 0 ? 0.05 : 0);

    return {
      pitch: Math.min(1.8, Math.max(0.5, pitch)),
      rate: Math.min(1.4, Math.max(0.7, rate)),
    };
  }

  /**
   * 朗讀單行台詞。
   *
   * 注意：
   *   - 呼叫前若 voices 尚未就緒，會自動跳過 voice 指派（用預設）。
   *     建議搭配 `waitForVoices` 在 useEffect 啟動時先等。
   *   - 同一時間只允許一個 utterance；若先前還在播，會先 cancel。
   *   - onEnd 與 onError 二擇一觸發；cancel 也會走 onEnd（瀏覽器原生行為）。
   */
  speak(config: TTSConfig): void {
    if (
      typeof window === "undefined" ||
      typeof window.speechSynthesis === "undefined"
    ) {
      // SSR 或極端不支援的瀏覽器：直接視為立即結束
      config.onEnd?.();
      return;
    }

    // 先取消任何尚未結束的 utterance
    if (this.currentUtterance !== null) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    const utterance = new SpeechSynthesisUtterance(config.text);
    utterance.lang = "zh-TW";

    const assignment = this.assignments.get(config.characterKey);
    if (assignment) {
      if (assignment.voice) utterance.voice = assignment.voice;
      utterance.pitch = assignment.pitch;
      utterance.rate = assignment.rate;
    }

    utterance.onstart = (): void => {
      config.onStart?.();
    };
    utterance.onend = (): void => {
      // 只有當前還是這次 utterance 才釋放 ref
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      config.onEnd?.();
    };
    utterance.onerror = (e: SpeechSynthesisErrorEvent): void => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      config.onError?.(e);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /** 取消目前播放（會觸發當前 utterance 的 onend）。 */
  cancel(): void {
    if (
      typeof window === "undefined" ||
      typeof window.speechSynthesis === "undefined"
    ) {
      return;
    }
    if (this.currentUtterance !== null) {
      this.currentUtterance = null;
      window.speechSynthesis.cancel();
    } else {
      // 即使內部沒 ref，也保險呼叫一次（清掉佇列中的殘留）
      window.speechSynthesis.cancel();
    }
  }

  /** 是否正在朗讀。回傳的是「最近一次 speak 尚未結束」的狀態。 */
  isSpeaking(): boolean {
    if (
      typeof window === "undefined" ||
      typeof window.speechSynthesis === "undefined"
    ) {
      return false;
    }
    return window.speechSynthesis.speaking || this.currentUtterance !== null;
  }

  /**
   * 取得目前角色 → 配置的快照（debug 用）。
   * 回傳新物件避免外部改動內部狀態。
   */
  getAssignmentsSnapshot(): Array<{
    characterKey: string;
    voiceName: string | null;
    pitch: number;
    rate: number;
  }> {
    const out: Array<{
      characterKey: string;
      voiceName: string | null;
      pitch: number;
      rate: number;
    }> = [];
    for (const c of this.characters) {
      const a = this.assignments.get(c.key);
      if (!a) continue;
      out.push({
        characterKey: c.key,
        voiceName: a.voice ? a.voice.name : null,
        pitch: a.pitch,
        rate: a.rate,
      });
    }
    return out;
  }
}
