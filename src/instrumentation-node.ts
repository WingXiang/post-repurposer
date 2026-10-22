// 建置版本不能代表 Function 版本；只在平台私有日誌記錄主程序 runtime。
console.info("Node.js runtime", JSON.stringify({ node: process.version, execPath: process.execPath, openssl: process.versions.openssl }));
export {};
