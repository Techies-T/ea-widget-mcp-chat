# 🔌 ea-widget-mcp-chat (v1.1.0)

**EmployeeAgent-Core (`EA-Core`)** から独立してインストール・バージョンアップ可能な **ZTA 準拠 MCP チャットクライアント** コンテナウィジェットです（Port: `8092`）。

ZTA-MCP-Gateway（OAuth 2.0 JWT + SSE + SQL ファイアウォール）経由で社内データベース（MariaDB / **AWS Aurora MySQL / AWS RDS MariaDB・MySQL [IAM 認証]**）や業務システムへ安全に接続し、自然言語でのデータ分析・インタラクティブ HTML ダッシュボード生成・ナレッジ共有を行います。

---

## 📦 インストール・アップデート方法（推奨：Widget Store からワンクリック）

**`EA-Core v1.3.0` 以降** を導入済みの環境（`ea-plugin-updater` サイドカー稼働中）では、**サーバーへ SSH/SSM ログインしてコマンドを打つ必要はありません**。

1. ブラウザで **EmployeeAgent-Core** を開き、**「⚙️ System Settings」 ➔ 「🧩 Widget Store」** を開きます。
2. **新規インストール**: 「追加可能アドオン」一覧から **MCP クライアント** の **「インストール」** をクリックします。
3. **アップデート（VUP）**: インストール済み一覧の **MCP クライアント** で **「🔄 更新確認」 ➔ 「⬆️ v1.1.0 へ Update」** をクリックします。
4. 裏側で `ea-plugin-updater` が以下を自動実行します（数十秒〜1分ほどで完了）：
   - **Sigstore Cosign（GitHub OIDC）証明書検証**（公式ワークフロー由来の正規イメージであることを検証）
   - **GHCR** (`ghcr.io/techies-t/ea-widget-mcp-chat@sha256:...`) からの安全なイメージ取得
   - コンテナ起動＆ヘルスチェック（`/api/health`）※失敗時は旧バージョンへ自動ロールバック
   - **PQC Hybrid 署名検証**（Ed25519 + NIST FIPS 204 ML-DSA-65）
5. 完了後、カード内の **「📜 証明書詳細」** ボタンからコンテナ証明書（OIDC Issuer / ビルド元ワークフロー / Rekor 透明性ログ）と PQC 署名の出所を確認できます。

---

## 🗄️ AWS Aurora / RDS (IAM 認証) との連携

- `EA-Core` 管理画面の **「⚙️ System Settings」 ➔ 「🔌 MCP サーバー接続設定」 ➔ 「+ Aurora / RDS (IAM 認証)」** から接続を登録すると、MCP クライアントのヘッダーに **「🛡️ Aurora/RDS IAM 保護」** バッジと専用クイックプロンプトが自動表示されます。
- AWS 側の IAM ポリシーや DB ユーザー作成手順の詳細は、EA-Core 側の [`zta-mcp-stack/docs/aurora-rds-iam-setup.md`](https://github.com/Techies-T/EmployeeAgent-Core/blob/main/zta-mcp-stack/docs/aurora-rds-iam-setup.md) を参照してください。

---

## 🛠️ 構成・開発・手動リリース

### 構成
- **Frontend (`src/`)**: React + Vite + Tailwind CSS (`McpChat.jsx`, `HtmlPreviewCodeBlock.jsx`, `SaveToKnowledgeModal.jsx`)
- **Backend (`server/`)**: Express 5 (`PORT=8092`) + SQLite (`mcp_tasks`) + ZTA Agent JWT 検証 (`ztaVerifier.cjs`) + EA-Core Host API クライアント (`coreClient.cjs`)

### ローカル開発起動
```bash
npm install
npm run dev
```

### PQC 署名付き本番ビルド
```bash
npm run build:signed
```

### 自動リリース（CI/CD）
Git タグ `v*`（例: `v1.1.0`）をプッシュすると、`.github/workflows/release-signed-plugin.yml` により以下が自動実行されます：
1. Docker イメージビルド ＆ **Trivy 脆弱性スキャン**（OS＋npm の `CRITICAL` 検出時は自動ブロック）
2. **GHCR** へのイメージプッシュ ＆ **Sigstore Cosign（GitHub OIDC）** 証明書署名
3. **PQC Hybrid 署名** ＆ GitHub Release（`widget.manifest.json`, `container-image.json`）公開

---

## 📄 変更履歴
- [CHANGELOG.md](./CHANGELOG.md)
