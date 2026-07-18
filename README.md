# 工具 01｜跨平台貼文改編器

同一篇內容，貼入一次，自動產出 Facebook、Instagram、LinkedIn、Threads、電子報的最佳版本。

依 `spec/tool-01-post-repurposer-spec.md`（原始規格）與 `spec/tool-01-post-repurposer-spec-clarified.md`（釐清補完版）實作。

## 技術架構

- **Next.js 16（App Router）+ 後端 Proxy**：Anthropic API 金鑰只存在後端，前端永不接觸。
- **模型**：`claude-sonnet-4-6`
- **樣式**：Tailwind CSS v4（品牌色 `#2A4189` / `#C67E13`）、Noto Sans TC 自託管字型
- **限流**：每 IP 每日 20 次（需設定 Upstash Redis；未設定則 fail-open 不限流）

## 本機開發

1. 安裝相依套件：

   ```bash
   npm install
   ```

2. 建立 `.env.local`（參考 `.env.example`）並填入你的金鑰：

   ```
   ANTHROPIC_API_KEY=sk-ant-xxxx
   # 選填——設定後才啟用限流
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```

3. 啟動：

   ```bash
   npm run dev
   ```

   開啟 http://localhost:3000

## 部署（Vercel）

1. `git init` → commit（確認不含 `.env.local`）→ push 到 GitHub。
2. Vercel Import 此 repo（自動偵測 Next.js）。
3. Environment Variables 加入 `ANTHROPIC_API_KEY`（設 Sensitive）、（選填）`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。
4. **上線前必做**：到 console.anthropic.com → Billing → Spend limits 設月支出上限 + 預警 email。

## 專案結構

```
src/
├─ app/
│  ├─ page.tsx                # 單頁 UI（輸入 / 平台 / 語氣 / 結果 Tab / Tips）
│  ├─ layout.tsx              # 字型、metadata
│  ├─ globals.css             # Tailwind + 品牌色變數
│  └─ api/
│     ├─ repurpose/route.ts   # 整批改編
│     ├─ regenerate/route.ts  # 單平台重新產生（temperature 0.9）
│     └─ usage/route.ts       # 查當日剩餘次數
├─ lib/
│  ├─ platforms.ts            # 平台/語氣常數、countChars、calcMaxTokens
│  ├─ prompt.ts               # system/user prompt 動態組裝
│  ├─ repurpose-core.ts       # 呼叫模型 + 解析 + 結果組裝（含解析重試）
│  ├─ sanitize.ts             # per-platform 清洗 + JSON 解析容錯
│  ├─ anthropic.ts            # SDK 初始化、重試退避、硬逾時 25s
│  ├─ rate-limit.ts           # IP 每日限流（Upstash，fail-open）
│  ├─ error-codes.ts          # 集中錯誤碼 + ref
│  └─ env.ts                  # 金鑰讀取 fallback helper
└─ proxy.ts                   # 安全標頭
```

## 關鍵設計（對應釐清規格）

- **動態 `max_tokens`**：依勾選平台字數上限換算（避免原規格寫死 1000 在多平台時截斷 → JSON 解析失敗）。
- **字數計算**：以碼點計（`Array.from`），正確處理中英混排與 emoji。
- **平台字數上限**為目標值；超過 110% 以紅字提示但不自動截斷，由使用者重新產生。
- **輸出清洗**：移除 Markdown 粗體/標題，保留 IG 的 `#hashtag`。
- **友善錯誤**：分類配色 banner（黃=額度 / 藍=可修正 / 紅=系統）+ 可複製錯誤碼與 ref。
