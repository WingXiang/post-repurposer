// POST /api/repurpose —— 整批改編（釐清規格 D2、D9、D12）
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
  let body: { sourceText?: unknown; platforms?: unknown; tone?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_REQUEST", "invalid json body");
  }

  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  const platformsRaw = Array.isArray(body.platforms) ? body.platforms : [];
  const tone: ToneCode =
    typeof body.tone === "string" && isToneCode(body.tone)
      ? body.tone
      : DEFAULT_TONE;

  // 輸入驗證（釐清規格 C1、C2）
  if (!sourceText.trim()) return errorResponse("INPUT_EMPTY");
  if (countChars(sourceText) < MIN_SOURCE_CHARS)
    return errorResponse("INPUT_TOO_SHORT");
  const platforms = platformsRaw.filter(
    (p): p is PlatformCode => typeof p === "string" && isPlatformCode(p),
  );
  if (platforms.length === 0) return errorResponse("NO_PLATFORM");

  // 限流（釐清規格 D10）
  const ip = getClientIp(req.headers);
  const rate = await consume(ip);
  if (!rate.allowed) {
    return errorResponse("RATE_LIMIT", `ip=${ip}`, {
      remaining: 0,
      limit: rate.limit,
    });
  }

  try {
    const results = await generateResults(sourceText, platforms, tone, 0.7);
    if (!results) {
      return errorResponse("PARSE_ERROR", `ip=${ip} unparseable`, {
        usage: { remaining: rate.remaining, limit: rate.limit },
      });
    }
    return NextResponse.json({
      results,
      usage: { remaining: rate.remaining, limit: rate.limit },
    });
  } catch (err) {
    return errorResponse(
      mapAnthropicError(err),
      `ip=${ip} ${String((err as Error)?.message)}`,
      { usage: { remaining: rate.remaining, limit: rate.limit } },
    );
  }
}
