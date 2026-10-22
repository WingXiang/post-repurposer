// Edge 也會編譯此檔案；Node 專用欄位必須隔離在條件式動態匯入的模組。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
