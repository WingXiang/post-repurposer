"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PLATFORMS,
  TONES,
  countChars,
  DEFAULT_TONE,
  MIN_SOURCE_CHARS,
  SOFT_MAX_SOURCE_CHARS,
  type PlatformCode,
  type ToneCode,
} from "@/lib/platforms";

interface PlatformResult {
  text: string;
  chars: number;
  limit: number;
  overLimit: boolean;
  ok: boolean;
}
type Results = Partial<Record<PlatformCode, PlatformResult>>;

interface ApiErr {
  code: string;
  title: string;
  category: "quota" | "user" | "system";
  ref: string;
}

const LOADING_MESSAGES = [
  "正在讀懂你的內容…",
  "為每個平台量身改寫…",
  "調整語氣與字數…",
  "快好了，正在收尾…",
];

const TIPS = [
  "原文寫得越完整、有重點，改編品質越好。",
  "同一篇可換不同語氣多試幾次，挑最順的版本。",
  "不滿意某個平台版本？用「重新產生」單獨重抓，不影響其他平台。",
  "IG 的 hashtag 可依你的受眾再手動微調。",
  "字數顯示紅色代表超過該平台上限，建議重新產生。",
];

const ERR_STYLE: Record<ApiErr["category"], string> = {
  quota: "bg-amber-50 border-amber-300 text-amber-800",
  user: "bg-blue-50 border-blue-300 text-blue-800",
  system: "bg-red-50 border-red-300 text-red-800",
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [selected, setSelected] = useState<PlatformCode[]>([
    "facebook",
    "instagram",
    "linkedin",
  ]);
  const [tone, setTone] = useState<ToneCode>(DEFAULT_TONE);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [results, setResults] = useState<Results>({});
  const [activeTab, setActiveTab] = useState<PlatformCode | null>(null);
  const [error, setError] = useState<ApiErr | null>(null);
  const [usage, setUsage] = useState<{
    remaining: number;
    limit: number;
  } | null>(null);

  const [regenPlatform, setRegenPlatform] = useState<PlatformCode | null>(null);
  const [copied, setCopied] = useState<PlatformCode | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [platformHint, setPlatformHint] = useState(false);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chars = countChars(sourceText);
  const tooShort = chars > 0 && chars < MIN_SOURCE_CHARS;
  const tooLong = chars > SOFT_MAX_SOURCE_CHARS;
  const canSubmit = !loading && chars >= MIN_SOURCE_CHARS && selected.length > 0;

  // 查當日剩餘次數
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d))
      .catch(() => {});
  }, []);

  // loading 文案輪播
  useEffect(() => {
    if (!loading) return;
    setLoadingMsg(0);
    const id = setInterval(
      () => setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length),
      2000,
    );
    return () => clearInterval(id);
  }, [loading]);

  const togglePlatform = (code: PlatformCode) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        // 至少保留 1 個（釐清規格 C2）
        if (prev.length === 1) {
          setPlatformHint(true);
          setTimeout(() => setPlatformHint(false), 2000);
          return prev;
        }
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const orderedResultCodes = PLATFORMS.map((p) => p.code).filter(
    (c) => results[c],
  );

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, platforms: selected, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data as ApiErr); // 保留舊結果（釐清規格 B6）
        if (data?.usage) setUsage(data.usage);
        return;
      }
      const newResults = data.results as Results;
      setResults(newResults); // 成功才整批替換
      if (data.usage) setUsage(data.usage);
      const first =
        PLATFORMS.map((p) => p.code).find((c) => newResults[c]?.ok) ??
        PLATFORMS.map((p) => p.code).find((c) => newResults[c]) ??
        null;
      setActiveTab(first);
    } catch {
      setError({
        code: "NETWORK",
        title: "網路連線異常，請確認後重試",
        category: "system",
        ref: "-",
      });
    } finally {
      setLoading(false);
    }
  }, [canSubmit, sourceText, selected, tone]);

  const handleRegenerate = async (code: PlatformCode) => {
    setRegenPlatform(code);
    setError(null);
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, platform: code, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data as ApiErr);
        if (data?.usage) setUsage(data.usage);
        return;
      }
      setResults((prev) => ({ ...prev, [code]: data.result as PlatformResult }));
      if (data.usage) setUsage(data.usage);
    } catch {
      setError({
        code: "NETWORK",
        title: "網路連線異常，請確認後重試",
        category: "system",
        ref: "-",
      });
    } finally {
      setRegenPlatform(null);
    }
  };

  const handleCopy = async (code: PlatformCode, text: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(code);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1800);
  };

  const handleEditResult = (code: PlatformCode, text: string) => {
    setResults((prev) => {
      const r = prev[code];
      if (!r) return prev;
      const c = countChars(text);
      return {
        ...prev,
        [code]: { ...r, text, chars: c, overLimit: c > r.limit * 1.1 },
      };
    });
  };

  const copyRef = async (ref: string) => {
    const ok = await copyText(`${error?.code ?? ""} ${ref}`.trim());
    if (ok) {
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 1800);
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-sm font-medium sm:text-base">
            Wing 數位顧問 · AI 工具組
          </span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
            工具 01 / 10
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
        {/* Hero */}
        <section className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            一篇內容，貼一次，產出所有平台的最佳版本
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            把寫好的內容貼進來，選好平台與語氣，AI
            會依各平台規則自動改寫字數、語氣與格式，省下每次手動改稿的 30 分鐘。
          </p>
        </section>

        {/* 原始內容 */}
        <Card title="原始內容">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="貼上你想改編的內容（至少 30 字）…"
            rows={7}
            aria-label="原始內容"
            className="w-full resize-y rounded-lg border border-line bg-white p-3 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span
              className={
                tooLong
                  ? "text-accent"
                  : tooShort
                    ? "text-amber-600"
                    : "text-muted"
              }
            >
              {tooShort
                ? "內容太短，建議至少 30 字以上"
                : tooLong
                  ? `內容較長，建議精簡或分段（目前 ${chars} 字）`
                  : `目前 ${chars} 字`}
            </span>
          </div>
        </Card>

        {/* 平台選擇 */}
        <Card title="選擇平台" subtitle="可多選，至少 1 個">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PLATFORMS.map((p) => {
              const on = selected.includes(p.code);
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => togglePlatform(p.code)}
                  aria-pressed={on}
                  className={[
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    on
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-white text-ink hover:border-brand hover:text-brand",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div
                    className={[
                      "mt-0.5 text-[11px] leading-tight",
                      on ? "text-white/80" : "text-muted",
                    ].join(" ")}
                  >
                    上限 {p.charLimit} 字
                  </div>
                </button>
              );
            })}
          </div>
          {platformHint && (
            <p className="mt-2 text-xs text-amber-600">至少需選 1 個平台</p>
          )}
        </Card>

        {/* 語氣風格 */}
        <Card title="語氣風格">
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => {
              const on = tone === t.code;
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setTone(t.code)}
                  aria-pressed={on}
                  title={t.hint}
                  className={[
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    on
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-white text-ink hover:border-accent",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {TONES.find((t) => t.code === tone)?.hint}
          </p>
        </Card>

        {/* 開始改編 */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className={[
              "w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-colors",
              canSubmit
                ? "bg-brand hover:bg-brand-dark"
                : "cursor-not-allowed bg-gray-300",
            ].join(" ")}
          >
            {loading ? "改編中…" : "開始改編"}
          </button>
          {usage && (
            <p className="mt-2 text-center text-xs text-muted">
              今日剩餘 {usage.remaining} / {usage.limit} 次
            </p>
          )}
        </div>

        {/* 錯誤 banner */}
        {error && (
          <div
            className={`mt-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${ERR_STYLE[error.category]}`}
            role="alert"
          >
            <div>
              <p className="font-medium">{error.title}</p>
              {error.ref !== "-" && (
                <p className="mt-0.5 text-xs opacity-80">
                  錯誤代碼 {error.code} · ref {error.ref}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {error.ref !== "-" && (
                <button
                  type="button"
                  onClick={() => copyRef(error.ref)}
                  className="rounded border border-current/30 px-2 py-1 text-xs hover:bg-black/5"
                >
                  {refCopied ? "已複製 ✓" : "複製代碼"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="關閉"
                className="rounded px-1.5 text-base leading-none hover:bg-black/5"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 載入中 */}
        {loading && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-line bg-card py-10">
            <span className="spinner inline-block h-8 w-8 rounded-full border-4 border-line border-t-brand" />
            <p className="text-sm text-muted">{LOADING_MESSAGES[loadingMsg]}</p>
          </div>
        )}

        {/* 改編結果 */}
        {!loading && orderedResultCodes.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-bold text-ink">改編結果</h2>
            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {orderedResultCodes.map((code) => {
                const p = PLATFORMS.find((x) => x.code === code)!;
                const on = activeTab === code;
                const r = results[code]!;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveTab(code)}
                    className={[
                      "shrink-0 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
                      on
                        ? "border-brand text-brand"
                        : "border-transparent text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {p.name}
                    {!r.ok && <span className="ml-1 text-red-500">!</span>}
                  </button>
                );
              })}
            </div>

            {/* Active tab content */}
            {activeTab &&
              results[activeTab] &&
              (() => {
                const p = PLATFORMS.find((x) => x.code === activeTab)!;
                const r = results[activeTab]!;
                const busy = regenPlatform === activeTab;
                return (
                  <div className="rounded-b-lg rounded-tr-lg border border-line bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        {p.name}
                      </span>
                      <span
                        className={[
                          "text-xs",
                          r.overLimit
                            ? "font-semibold text-red-500"
                            : "text-muted",
                        ].join(" ")}
                      >
                        {r.chars} / {r.limit} 字
                      </span>
                    </div>

                    {r.ok ? (
                      <textarea
                        value={r.text}
                        onChange={(e) =>
                          handleEditResult(activeTab, e.target.value)
                        }
                        rows={8}
                        aria-label={`${p.name} 改編結果`}
                        className="w-full resize-y rounded-lg border border-line bg-white p-3 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-600">
                        此平台產生失敗，請按「重新產生」再試一次。
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={!r.ok || busy}
                        onClick={() => handleCopy(activeTab, r.text)}
                        className={[
                          "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                          r.ok && !busy
                            ? "bg-blue-50 text-brand hover:bg-brand hover:text-white"
                            : "cursor-not-allowed bg-gray-100 text-gray-400",
                        ].join(" ")}
                      >
                        {copied === activeTab ? "已複製 ✓" : "複製"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRegenerate(activeTab)}
                        className={[
                          "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                          busy
                            ? "cursor-wait border-line text-muted"
                            : "border-line text-ink hover:border-brand hover:text-brand",
                        ].join(" ")}
                      >
                        {busy ? "重新產生中…" : "重新產生"}
                      </button>
                    </div>
                  </div>
                );
              })()}
          </section>
        )}

        {/* 空狀態 */}
        {!loading && orderedResultCodes.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-line bg-card py-10 text-center text-sm text-muted">
            改編結果會出現在這裡 —— 貼入內容、選好平台後按「開始改編」。
          </div>
        )}

        {/* 使用技巧 */}
        <section className="mt-10 rounded-xl border border-line bg-accent-soft/40 p-5">
          <h2 className="mb-3 text-sm font-bold text-accent">使用技巧</h2>
          <ul className="space-y-2">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-accent">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Wing 數位顧問 AI 工具組 · 工具 01 跨平台貼文改編器
      </footer>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
