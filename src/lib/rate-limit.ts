// IP-based 每日限流（common-tech 情境 5/6 / 釐清規格 D10）
// 採 fail-open：未設定 Redis 或 Redis 故障時，不阻擋使用者。
import { Redis } from "@upstash/redis";

export const DAILY_LIMIT = 20; // 每 IP 每日改編次數上限

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function dateKey(tz = "Asia/Taipei"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

function key(ip: string): string {
  return `rl:repurpose:${dateKey()}:${ip}`;
}

// 計數 + 檢查（fail-open）。repurpose / regenerate 共用同一每日額度。
export async function consume(ip: string): Promise<RateResult> {
  const r = getRedis();
  if (!r) return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  try {
    const k = key(ip);
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, 60 * 60 * 26); // ~26h 覆蓋時區整日
    if (count > DAILY_LIMIT) {
      await r.decr(k); // 超量回滾
      return { allowed: false, remaining: 0, limit: DAILY_LIMIT };
    }
    return {
      allowed: true,
      remaining: Math.max(0, DAILY_LIMIT - count),
      limit: DAILY_LIMIT,
    };
  } catch {
    return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
}

// 唯讀查詢用量（給 /api/usage，不計數）
export async function peek(ip: string): Promise<RateResult> {
  const r = getRedis();
  if (!r) return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  try {
    const count = (await r.get<number>(key(ip))) ?? 0;
    return {
      allowed: count < DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - count),
      limit: DAILY_LIMIT,
    };
  } catch {
    return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
}
