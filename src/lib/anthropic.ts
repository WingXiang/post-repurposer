// Anthropic SDK 封裝：初始化、重試退避、硬逾時 —— 對應釐清規格 D2、D3、D6、D13、D14
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "./env";

const MODEL = "claude-sonnet-4-6";
const HARD_TIMEOUT_MS = 25_000; // 釐清規格 D14
const MAX_RETRIES = 3; // 釐清規格 D13
const MAX_BACKOFF_MS = 4_000; // 上限，避免退避時間超出 Vercel maxDuration 預算

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = getApiKey();
  if (!apiKey) {
    const e = new Error("Missing ANTHROPIC_API_KEY") as Error & {
      status?: number;
    };
    e.status = 401;
    throw e;
  }
  // authToken: null 必傳，否則 SDK 會撿環境裡空 token 報錯（common-tech 情境 2）
  client = new Anthropic({
    apiKey,
    authToken: null,
    timeout: HARD_TIMEOUT_MS,
    maxRetries: 0, // 自行控制重試
  });
  return client;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 429 忙線時 Anthropic 會回 retry-after 秒數，優先照它等；沒有就用指數退避
function getRetryDelayMs(err: unknown, attempt: number): number {
  const headers = (err as { headers?: Headers })?.headers;
  const retryAfter = headers?.get?.("retry-after");
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (!Number.isNaN(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, MAX_BACKOFF_MS);
  }
  return Math.min(400 * Math.pow(2, attempt), MAX_BACKOFF_MS); // 400ms, 800ms, 1600ms...
}

export interface ClaudeCallOpts {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export async function callClaude(opts: ClaudeCallOpts): Promise<string> {
  const anthropic = getClient();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });
      const textBlock = msg.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text block in response");
      }
      return textBlock.text;
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retriable =
        status === 429 ||
        status === 529 ||
        (status !== undefined && status >= 500);
      if (attempt < MAX_RETRIES && retriable) {
        await sleep(getRetryDelayMs(err, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
