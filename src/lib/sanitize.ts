// 輸出清洗與 JSON 解析容錯 —— 對應釐清規格 D7、D8、附錄 2

// common-tech 情境 2：JSON.parse 前修掉字串內未跳脫的控制字元
export function escapeControlCharsInJsonStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      result += ch;
      inString = !inString;
      continue;
    }
    if (inString) {
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
    }
    result += ch;
  }
  return result;
}

// 若模型用 ```json ... ``` 包裹輸出，先剝除
export function stripJsonFence(s: string): string {
  const t = s.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence ? fence[1].trim() : t;
}

// 抽出第一個 {...} JSON 物件（容忍前後夾雜說明文字）
export function extractJsonObject(s: string): string {
  const stripped = stripJsonFence(s);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }
  return stripped;
}

// per-platform 輸出清洗（釐清規格 D7 / 附錄 2）
// 注意：只移除「# 」開頭的 Markdown 標題（# 後有空白），
//       保留「#hashtag」（# 後緊接非空白），讓 IG 的 hashtag 不被誤刪。
export function sanitizeOutput(text: string): string {
  let t = text;
  // 移除多餘程式碼框
  t = t.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
  // 移除粗體 / 底線強調符號
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
  // 移除 Markdown 標題語法（# 後接空白）；保留 #hashtag
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // 壓縮 3 個以上連續換行為 2 個
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}
