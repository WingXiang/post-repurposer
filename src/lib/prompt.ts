// Prompt 動態組裝 —— 對應釐清規格 D5 / 附錄 1
import {
  PLATFORM_MAP,
  TONE_MAP,
  type PlatformCode,
  type ToneCode,
} from "./platforms";

// System：永遠不變的角色與輸出格式硬規則（附錄 1）
export const SYSTEM_PROMPT = `你是專業的跨平台內容改編助手，服務對象是經營多個社群平台的知識型自媒體經營者。
你的任務：把使用者提供的一篇原始內容，改寫成各指定平台的最佳版本，保留原意與重點，但依各平台特性調整字數、語氣與結構。

輸出規則（務必嚴格遵守）：
1. 只輸出一個 JSON 物件，不要有任何 JSON 以外的文字、說明、前後綴或 markdown 程式碼框。
2. JSON 的 key 必須是平台代碼（例如 facebook、instagram），value 是該平台的改編後純文字。
3. 只輸出使用者指定的平台，不要自行增減平台。
4. 不要使用 Markdown 標題（#）、粗體（**）或清單符號等排版語法；內容要能直接複製貼上到該平台發布。例外：Instagram 版本可使用 # 開頭的 hashtag。
5. 嚴格遵守每個平台的字數上限。
6. 內容一律使用繁體中文，語氣自然、像真人撰寫，避免明顯的 AI 腔與罐頭句。`;

// User：依勾選平台與語氣動態組裝（附錄 1）
export function buildUserPrompt(
  sourceText: string,
  platforms: PlatformCode[],
  tone: ToneCode,
): string {
  const toneDesc = TONE_MAP[tone].promptDesc;
  const rules = platforms
    .map((c) => `- ${PLATFORM_MAP[c].promptRule}`)
    .join("\n");
  const example =
    "{\n" +
    platforms
      .map((c) => `  "${c}": "改編後的${PLATFORM_MAP[c].name}版本文字"`)
      .join(",\n") +
    "\n}";

  return [
    "【語氣風格】",
    toneDesc,
    "",
    "【要改編的平台與規則】",
    rules,
    "",
    "【輸出格式】",
    "請只回傳一個 JSON 物件，key 與下方範例相同（只含上述指定平台），value 為改編後純文字：",
    example,
    "",
    "【原始內容】",
    sourceText,
  ].join("\n");
}
