// repurpose / regenerate 共用的解析與結果組裝邏輯
import { callClaude } from "./anthropic";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  calcMaxTokens,
  countChars,
  PLATFORM_MAP,
  type PlatformCode,
  type ToneCode,
} from "./platforms";
import {
  escapeControlCharsInJsonStrings,
  extractJsonObject,
  sanitizeOutput,
} from "./sanitize";

export interface PlatformResult {
  text: string;
  chars: number;
  limit: number;
  overLimit: boolean; // 超過上限 110%（釐清規格 A3）
  ok: boolean;
}

function tryParse(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = escapeControlCharsInJsonStrings(extractJsonObject(raw));
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toResult(code: PlatformCode, value: unknown): PlatformResult {
  const limit = PLATFORM_MAP[code].charLimit;
  const rawText = typeof value === "string" ? value : "";
  if (!rawText.trim()) {
    return { text: "", chars: 0, limit, overLimit: false, ok: false };
  }
  const text = sanitizeOutput(rawText);
  const chars = countChars(text);
  return { text, chars, limit, overLimit: chars > limit * 1.1, ok: true };
}

/**
 * 呼叫模型並組裝多平台結果。
 * JSON 解析失敗時自動重試 1 次（釐清規格 D8）。
 * 回傳 null 代表重試後仍無法解析 → 呼叫端回 PARSE_ERROR。
 */
export async function generateResults(
  sourceText: string,
  platforms: PlatformCode[],
  tone: ToneCode,
  temperature: number,
): Promise<Record<string, PlatformResult> | null> {
  const user = buildUserPrompt(sourceText, platforms, tone);
  const maxTokens = calcMaxTokens(platforms);

  let raw = await callClaude({
    system: SYSTEM_PROMPT,
    user,
    maxTokens,
    temperature,
  });
  let parsed = tryParse(raw);

  if (!parsed) {
    raw = await callClaude({ system: SYSTEM_PROMPT, user, maxTokens, temperature });
    parsed = tryParse(raw);
  }
  if (!parsed) return null;

  const results: Record<string, PlatformResult> = {};
  for (const code of platforms) {
    results[code] = toResult(code, parsed[code]);
  }
  return results;
}
