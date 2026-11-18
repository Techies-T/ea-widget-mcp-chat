# ea-widget-mcp-chat

**EmployeeAgent-Core** から独立してバージョンアップ・デプロイ可能な **ZTA MCP チャットクライアント** ウィジェットプラグインです（Port: `8092`）。

## 構成
- **Frontend (`src/`)**: React + Vite + Tailwind CSS (`McpChat.jsx`, `HtmlPreviewCodeBlock.jsx`, `SaveToKnowledgeModal.jsx`)
- **Backend (`server/`)**: Express 5 (`PORT=8092`) + SQLite (`mcp_tasks`) + ZTA Agent JWT 検証 (`ztaVerifier.cjs`) + EA-Core Host API クライアント (`coreClient.cjs`)

## 開発起動
```bash
npm install
npm run dev
```

## 本番ビルド & 署名
```bash
npm run build
```
Git タグ `v*` をプッシュすると、`.github/workflows/release-signed-plugin.yml` により PQC Hybrid 署名付きリリースおよび GHCR イメージが自動公開されます。
