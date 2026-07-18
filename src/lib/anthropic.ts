// Anthropic SDK 封裝：初始化、重試退避、硬逾時 —— 對應釐清規格 D2、D3、D6、D13、D14
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "./env";

const MODEL = "claude-sonnet-4-6";
const HARD_TIMEOUT_MS = 25_000; // 釐清規格 D14
const MAX_RETRIES = 2; // 釐清規格 D13

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
        await sleep(400 * Math.pow(2, attempt)); // 400ms, 800ms 指數退避
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
