// 集中式錯誤碼目錄 + 參考編號（common-tech 情境 9 / 釐清規格 D12）
import { NextResponse } from "next/server";

export type ErrorCategory = "quota" | "user" | "system";

export interface ErrorDef {
  code: string;
  title: string; // 給使用者看的友善訊息
  category: ErrorCategory; // quota=黃 / user=藍 / system=紅
  httpStatus: number;
}

export const ERROR_CODES: Record<string, ErrorDef> = {
  INPUT_EMPTY: {
    code: "INPUT_EMPTY",
    title: "請先貼入你想改編的內容",
    category: "user",
    httpStatus: 400,
  },
  INPUT_TOO_SHORT: {
    code: "INPUT_TOO_SHORT",
    title: "內容太短，建議至少 30 字以上",
    category: "user",
    httpStatus: 400,
  },
  NO_PLATFORM: {
    code: "NO_PLATFORM",
    title: "請至少選 1 個平台",
    category: "user",
    httpStatus: 400,
  },
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    title: "請求格式有誤，請重新整理頁面再試",
    category: "user",
    httpStatus: 400,
  },
  AUTH: {
    code: "AUTH",
    title: "服務設定異常，請聯絡管理者",
    category: "system",
    httpStatus: 500,
  },
  RATE_LIMIT: {
    code: "RATE_LIMIT",
    title: "今日改編次數已用完，請明天再試",
    category: "quota",
    httpStatus: 429,
  },
  OVERLOADED: {
    code: "OVERLOADED",
    title: "服務暫時忙線，請稍後再試",
    category: "system",
    httpStatus: 503,
  },
  TIMEOUT: {
    code: "TIMEOUT",
    title: "產生時間過長，請再試一次",
    category: "system",
    httpStatus: 504,
  },
  PARSE_ERROR: {
    code: "PARSE_ERROR",
    title: "AI 回覆格式異常，請再試一次",
    category: "system",
    httpStatus: 502,
  },
  INTERNAL: {
    code: "INTERNAL",
    title: "發生未預期的錯誤，請再試一次",
    category: "system",
    httpStatus: 500,
  },
};

// 參考編號：避開易混淆字元（0/O、1/I）
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRef(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return s;
}

export interface ApiError {
  code: string;
  title: string;
  category: ErrorCategory;
  ref: string;
}

export function errorResponse(
  codeKey: string,
  logContext = "",
  extra?: Record<string, unknown>,
) {
  const def = ERROR_CODES[codeKey] ?? ERROR_CODES.INTERNAL;
  const ref = generateRef();
  // 固定格式 [err:CODE] ref=xxxxx ...，方便使用者回報 ref 後 grep 定位
  console.error(`[err:${def.code}] ref=${ref} ${logContext}`);
  const body = {
    code: def.code,
    title: def.title,
    category: def.category,
    ref,
    ...extra,
  };
  return NextResponse.json(body, { status: def.httpStatus });
}

// 把 Anthropic SDK / HTTP 錯誤映射成自家錯誤碼
export function mapAnthropicError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) return "AUTH";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429 || status === 529) return "OVERLOADED"; // 上游忙線，非本站每日上限
  if (status !== undefined && status >= 500) return "OVERLOADED";
  const name = (err as { name?: string })?.name;
  if (name === "APIConnectionTimeoutError" || name === "AbortError")
    return "TIMEOUT";
  if (name === "APIConnectionError") return "OVERLOADED";
  return "OVERLOADED";
}
