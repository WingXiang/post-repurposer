// 平台 / 語氣常數、字數計算、動態 max_tokens —— 對應釐清規格 A1、B1、D1、附錄 2

export type PlatformCode =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "threads"
  | "newsletter";

export type ToneCode = "professional" | "casual" | "story" | "direct";

export interface Platform {
  code: PlatformCode;
  name: string;
  charLimit: number;
  rule: string; // UI 上顯示的簡短規則
  promptRule: string; // 注入 prompt 的完整規格句（附錄 1 F3）
}

// 固定顯示順序（釐清規格 B1）—— 不隨勾選順序變動
export const PLATFORMS: Platform[] = [
  {
    code: "facebook",
    name: "Facebook",
    charLimit: 500,
    rule: "加入開放式問句引發留言",
    promptRule:
      "Facebook：上限 500 字。結尾加入一個開放式問句，引導讀者留言互動。",
  },
  {
    code: "instagram",
    name: "Instagram",
    charLimit: 220,
    rule: "加入 5–8 個 hashtag",
    promptRule:
      "Instagram：上限 220 字。文末加入 5–8 個與內容高度相關的 hashtag（繁中或英文皆可）。",
  },
  {
    code: "linkedin",
    name: "LinkedIn",
    charLimit: 600,
    rule: "強調專業洞察，加行動呼籲",
    promptRule:
      "LinkedIn：上限 600 字。強調專業洞察與觀點，結尾加入明確的行動呼籲（CTA）。",
  },
  {
    code: "threads",
    name: "Threads",
    charLimit: 300,
    rule: "對話感，可拆短句",
    promptRule:
      "Threads：上限 300 字。對話感強，可把長句拆成多個短句、適度換行，營造輕快節奏。",
  },
  {
    code: "newsletter",
    name: "電子報段落",
    charLimit: 800,
    rule: "私密語氣，像寫信給訂閱者",
    promptRule:
      "電子報段落：上限 800 字。私密、有溫度的語氣，像寫信給訂閱者，可用「你」直接對話。",
  },
];

export const PLATFORM_MAP: Record<PlatformCode, Platform> = Object.fromEntries(
  PLATFORMS.map((p) => [p.code, p]),
) as Record<PlatformCode, Platform>;

export interface Tone {
  code: ToneCode;
  label: string;
  hint: string;
  promptDesc: string; // 注入 prompt 的語氣描述句（附錄 1 F2）
}

export const TONES: Tone[] = [
  {
    code: "professional",
    label: "專業知識感",
    hint: "有說服力、邏輯清楚",
    promptDesc:
      "用「專業知識感」的語氣：有說服力、邏輯清楚、用詞精準，展現專業但不艱澀。",
  },
  {
    code: "casual",
    label: "輕鬆對話感",
    hint: "像朋友在說話",
    promptDesc: "用「輕鬆對話感」的語氣：像跟朋友聊天，親切、口語、不拘謹。",
  },
  {
    code: "story",
    label: "故事引導型",
    hint: "先帶情境再點題",
    promptDesc: "用「故事引導型」的語氣：先用情境或小故事帶入，再自然帶到重點。",
  },
  {
    code: "direct",
    label: "直接結論型",
    hint: "不廢話、直接點重點",
    promptDesc: "用「直接結論型」的語氣：不鋪陳廢話，開門見山直接點出重點。",
  },
];

export const TONE_MAP: Record<ToneCode, Tone> = Object.fromEntries(
  TONES.map((t) => [t.code, t]),
) as Record<ToneCode, Tone>;

export const DEFAULT_TONE: ToneCode = "professional";
export const MIN_SOURCE_CHARS = 30;
export const SOFT_MAX_SOURCE_CHARS = 5000;

// 統一字數函式（釐清規格 A1）—— 以碼點計，正確處理 emoji / 代理對
export function countChars(str: string): number {
  return Array.from(str.trim()).length;
}

// 動態 max_tokens（釐清規格 D1 / 附錄 2）
const CHAR_TO_TOKEN = 2.2; // 中文字 → token 保守係數
const JSON_OVERHEAD = 256; // key、引號、括號等結構開銷

export function calcMaxTokens(codes: PlatformCode[]): number {
  const sum = codes.reduce((n, c) => n + (PLATFORM_MAP[c]?.charLimit ?? 0), 0);
  const raw = Math.ceil(sum * CHAR_TO_TOKEN) + JSON_OVERHEAD;
  return Math.min(8192, Math.max(1024, raw));
}

export function isPlatformCode(v: string): v is PlatformCode {
  return Object.prototype.hasOwnProperty.call(PLATFORM_MAP, v);
}

export function isToneCode(v: string): v is ToneCode {
  return Object.prototype.hasOwnProperty.call(TONE_MAP, v);
}
