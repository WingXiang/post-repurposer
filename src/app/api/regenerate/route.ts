// POST /api/regenerate —— 單一平台重新產生（釐清規格 B4）
// 只帶該平台規格，temperature 0.9 求變化，只回該平台結果。
import { NextRequest, NextResponse } from "next/server";
import {
  countChars,
  isPlatformCode,
  isToneCode,
  MIN_SOURCE_CHARS,
  DEFAULT_TONE,
  type PlatformCode,
  type ToneCode,
} from "@/lib/platforms";
import { errorResponse, mapAnthropicError } from "@/lib/error-codes";
import { consume, getClientIp } from "@/lib/rate-limit";
import { generateResults } from "@/lib/repurpose-core";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { sourceText?: unknown; platform?: unknown; tone?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_REQUEST", "invalid json body");
  }

  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  const tone: ToneCode =
    typeof body.tone === "string" && isToneCode(body.tone)
      ? body.tone
      : DEFAULT_TONE;

  if (!sourceText.trim()) return errorResponse("INPUT_EMPTY");
  if (countChars(sourceText) < MIN_SOURCE_CHARS)
    return errorResponse("INPUT_TOO_SHORT");
  if (typeof body.platform !== "string" || !isPlatformCode(body.platform)) {
    return errorResponse("NO_PLATFORM");
  }
  const platform: PlatformCode = body.platform;

  const ip = getClientIp(req.headers);
  const rate = await consume(ip);
  if (!rate.allowed) {
    return errorResponse("RATE_LIMIT", `ip=${ip}`, {
      remaining: 0,
      limit: rate.limit,
    });
  }

  try {
    const results = await generateResults(sourceText, [platform], tone, 0.9);
    if (!results || !results[platform]?.ok) {
      return errorResponse("PARSE_ERROR", `ip=${ip} platform=${platform}`, {
        usage: { remaining: rate.remaining, limit: rate.limit },
      });
    }
    return NextResponse.json({
      platform,
      result: results[platform],
      usage: { remaining: rate.remaining, limit: rate.limit },
    });
  } catch (err) {
    return errorResponse(
      mapAnthropicError(err),
      `ip=${ip} platform=${platform} ${String((err as Error)?.message)}`,
      { usage: { remaining: rate.remaining, limit: rate.limit } },
    );
  }
}
