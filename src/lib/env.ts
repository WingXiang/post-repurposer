// API 金鑰讀取 helper（common-tech 情境 3）
// 環境變數為空時 fallback 讀 .env.local，避免父程序空字串覆蓋。
import { readFileSync } from "fs";
import { join } from "path";

export function getApiKey(name = "ANTHROPIC_API_KEY"): string | null {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] === name) {
        return m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local 不存在（例如 Vercel 上）—— 只靠 process.env
  }
  return null;
}
