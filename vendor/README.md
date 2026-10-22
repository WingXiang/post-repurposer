# braces 本地安全修補

來源：npm braces 3.0.3，保留 MIT LICENSE 與原版本號。
GHSA-vfj7-8cjw-p6xm 尚無上游已發布修補版。這份 tarball 為本地維護版本，不能視為官方發布，也不會隱藏 audit 警示。

解析器入棧及 compile／expand／stringify 的 AST 遞迴前固定限制深度 128，迭代預檢直接 AST、循環及 parent chain。一般 glob、數值範圍與歷史 API 保留。深度超限會拋出可預期的 SyntaxError，呼叫端仍應處理無效 pattern。

SHA-256：1b9f2d034dd32a2f13e019f37831d79db3354bc346fef230bfa91052cbae19d8

驗證：node scripts/security-dependencies.mjs

更新上游後，確認攻擊測試仍通過才移除本地修補。
