# Changelog

本プロジェクトのすべての主要な変更履歴は本ファイルに記録されます。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に準拠し、バージョン番号は [セマンティック バージョニング](https://semver.org/lang/ja/) に従います。

## [1.1.0] - 2026-11-24

### ✨ 追加機能（Aurora / RDS IAM 認証対応 & サプライチェーン強化）
- **AWS Aurora (MySQL互換) / AWS RDS (MariaDB・MySQL) IAM 認証対応 UI (`src/apps/McpChat.jsx`)**:
  - Aurora / RDS（IAM 認証）サーバー接続時に、ヘッダーへ **「🛡️ Aurora/RDS IAM 保護」** および **「🔒 Read-Only」** バッジ・接続先メタ情報（エンジン種別・認証方式・AWS リージョン）を表示。
  - Aurora / RDS 向けの分析クイックプロンプト 3 種（テーブル＆スキーマ確認／主要テーブルのレコード件数サマリーダッシュボード化／IAM 接続ステータス確認）を追加。
- **Aurora / RDS MCP ツールハンドリング強化 (`server/routes/mcpChat.cjs`, `server/claudeRunner.cjs`)**:
  - `aurora-rds-mcp` および AWS 公式 `awslabs.mysql-mcp-server` のツール群（`check_connection_status`, `list_tables`, `describe_table`, `get_table_schema`, `execute_query`, `run_query`）に対応し、ツール引数名の揺れ（`query`/`sql`/`statement`、`table_name`/`table`）を自動補完。
  - `GET /api/mcp/meta` に `auroraRdsStatus` サマリーを追加し、EA-Core 側メタデータ（`is_aurora_rds`, `aurora_rds_meta`, `endpoint_url`, `domain_key`, `operation_level`）と完全統合。
- **CI/CD 脆弱性チェック ＆ 証明書署名パイプライン (`.github/workflows/release-signed-plugin.yml`)**:
  - **Trivy コンテナ脆弱性スキャン**（OS パッケージ＋npm 依存関係、`CRITICAL` 検出時は自動ブロック＋SARIF レポート出力）を導入。
  - **Sigstore Cosign（GitHub OIDC キーレス証明書）** による GHCR コンテナイメージダイジェスト（`@sha256:...`）署名および `container-image.json` 公開を追加。
  - `.dockerignore` で Trivy キャッシュ DB（`.cache`）や一時アーカイブを除外し、コンテナイメージサイズを約 600MB 削減。

### 🐛 バグ修正
- **「別タブ」全画面プレビュー修正 (`src/components/HtmlPreviewCodeBlock.jsx`)**:
  - `openInNewTab` で未完結スクリプト補完済みの `preparedCode` および `text/html;charset=utf-8` を使用するよう改善（EA-Core 側 `PluginHostFrame` の `allow-popups` 対応と連携）。
- **デフォルト Gemini モデルフォールバック統一 (`server/routes/mcpChat.cjs`)**:
  - 未設定時のフォールバックモデルを `gemini-3.8-flash` に統一。

---

## [1.0.0] - 2026-11-20

### 🚀 初回独立リリース
- **EmployeeAgent-Core からの完全分離（独立コンテナプラグイン化）**:
  - Port `8092` で独立稼働する Express 5 + React/Vite プラグインとして切り出し、EA-Core 本体と独立してバージョンアップ可能に。
- **PQC Hybrid 署名対応**:
  - Ed25519 + NIST FIPS 204 ML-DSA-65 によるハイブリッド署名（`npm run build:signed`）をマニフェスト（`public/widget.manifest.json` / `dist/widget.manifest.json`）へ適用。
- **不具合修正**:
  - `server/routes/mcpChat.cjs` での `msgLower` 未定義エラーを修正。
