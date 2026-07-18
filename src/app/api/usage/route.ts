// GET /api/usage —— 查當日剩餘改編次數（釐清規格 D10）
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, peek } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const u = await peek(ip);
  return NextResponse.json({ remaining: u.remaining, limit: u.limit });
}
