# MR/PR Quiz Bot

PR/MR作成時にAIが自動でクイズを生成し、開発者の理解度を確認するBotです。個人のスキルマップを管理し、成長を追跡・可視化します。

## 🎯 主な機能

### ✅ 実装済み

#### 基本機能
- **AIクイズ自動生成**: PR/MRの差分からGemini AIがクイズを自動生成
- **クイズ回答**: 選択式クイズに回答し、正誤判定と解説を取得
- **PRコメント回答**: `/answer` コマンドでPRコメントから直接回答可能 🆕
- **回答履歴保存**: Firestoreに全ての回答を記録

#### スキルマップ・成長分析 🆕
- **ユーザープロファイル管理**: キャリア目標、経験レベル、注力分野、自己評価を記録
- **PRコメントでプロファイル設定**: `/profile` コマンドで簡単に設定可能 🆕
- **スキル統計の自動追跡**: カテゴリ別正答率、平均難易度、成長トレンドを自動計算
- **成長マイルストーン**: 初回正解、カテゴリマスター、累計回答数などの達成を記録
- **パーソナライズ出題**: 苦手分野を優先し、目標分野を重視した出題アルゴリズム
- **学習推奨システム**: 弱点分析と次のステップを提案
- **チーム分析**: 期間別・レベル別・カテゴリ別の統計とパーセンタイル計算

#### Webhook連携 🆕
- **GitHub PR自動トリガー**: PR作成時に自動でクイズを生成・投稿
- **PRコメントコマンド**: `/profile` と `/answer` コマンドをコメントで実行可能

### 🚧 今後の実装予定
- Looker Studioでの可視化ダッシュボード
- クイズスキップ・リマインド機能
- GitLab対応

---

## ☁️ Cloud Run デプロイ

### 自動デプロイ

このプロジェクトは GitHub Actions による自動デプロイに対応しています。

1. Google Cloud プロジェクトで Workload Identity Federation を設定
2. GitHub Secrets に以下を登録:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`
   - `CLOUD_RUN_URL`
   - `BOT_APP_ID`
   - `BOT_APP_PRIVATE_KEY`
3. `main` ブランチへのプッシュで自動的に Cloud Run にデプロイされます

### 詳細な手順

完全なデプロイ手順は [Cloud Run デプロイガイド](./docs/cloud-run-deployment.md) を参照してください。

#### 必要なもの
- Google Cloud プロジェクト
- Gemini API Key
- GitHub Personal Access Token（GitHub連携の場合）

#### 主な機能
- ✅ ワンコマンドデプロイ (`./deploy.sh`)
- ✅ Secret Manager 自動連携
- ✅ 自動スケーリング（0〜10インスタンス）
- ✅ Webhook 署名検証
- ✅ Cloud Logging/Monitoring

**コスト見積もり**: 1日100PRの場合、月額 $0〜数ドル（無料枠内で運用可能）

---

## 🏗️ 技術スタック

- **フレームワーク**: Hono（軽量Webフレームワーク）
- **AI**: Google Gemini API
- **データベース**: Firestore
- **言語**: TypeScript
- **実行環境**: Node.js 24+
- **デプロイ**: Google Cloud Run（予定）

---

## 🚀 セットアップ

### 前提条件
- Node.js 24以上
- Google Cloud アカウント
- Gemini API キー

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd mr-quiz-poc

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .env を編集して必要な値を設定
```

### 環境変数

```bash
# .env
PORT=3000
NODE_ENV=development

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Firestore Emulator（ローカル開発時）
FIRESTORE_EMULATOR_HOST=localhost:8080

# Webhook（オプション）
WEBHOOK_SECRET=your-webhook-secret
```

---

## 📦 コマンド

### 開発

```bash
# 開発サーバー起動（ホットリロード）
npm run dev

# Firestoreエミュレーター起動
npm run emulator
```

### ビルド・本番

```bash
# TypeScriptビルド
npm run build

# 本番サーバー起動
npm start
```

### コード品質

```bash
# TypeScript型チェック
npm run typecheck

# コードリント（Biome）
npm run lint

# リント自動修正
npm run lint:fix

# コード整形
npm run format
```

### テスト

```bash
# テスト実行（watch mode）
npm test

# テスト実行（1回）
npm run test:run
```

---

## 🔌 APIエンドポイント

### 基本機能

#### ヘルスチェック
```http
GET /health
```

#### クイズ生成
```http
POST /api/quiz/generate
Content-Type: application/json

{
  "platform": "github",
  "owner": "username",
  "repo": "repository",
  "number": 123,
  "accountId": "user123",
  "title": "Add new feature",
  "diff": "diff --git a/file.js..."
}
```

#### クイズ回答
```http
POST /api/quiz/:quizId/answer
Content-Type: application/json

{
  "accountId": "user123",
  "selectedAnswerIndex": 2
}
```

### スキルマップ機能 🆕

#### ユーザープロファイル作成・更新
```http
PUT /api/users/:accountId/profile
Content-Type: application/json

{
  "careerGoal": "フルスタックエンジニアを目指す",
  "experienceLevel": "junior",
  "yearsOfExperience": 1.5,
  "focusAreas": ["security", "performance"]
}
```

#### プロファイル取得
```http
GET /api/users/:accountId/profile
```

#### スキル統計取得
```http
GET /api/users/:accountId/skills
```

#### 成長マイルストーン取得
```http
GET /api/users/:accountId/growth
```

#### 学習推奨取得
```http
GET /api/users/:accountId/recommendations
```

### チーム分析 🆕

#### チーム統計取得
```http
GET /api/analytics/team?period=2026-01&experienceLevel=junior&category=security
```

#### ベンチマークデータ取得
```http
GET /api/analytics/benchmarks?period=2026-01&level=junior
```

#### チーム分析計算（バッチ処理用）
```http
POST /api/analytics/team/calculate
Content-Type: application/json

{
  "period": "2026-01"
}
```

### Webhook 🆕

#### GitHub Webhook
```http
POST /api/webhook/github
X-GitHub-Event: pull_request
X-Hub-Signature-256: sha256=...
Content-Type: application/json

{
  "action": "opened",
  "pull_request": { ... },
  "repository": { ... }
}
```

#### GitLab Webhook（予定）
```http
POST /api/webhook/gitlab
X-Gitlab-Token: ...
Content-Type: application/json

{
  "object_kind": "merge_request",
  ...
}
```

---

## 📊 プロファイル設定

より最適なクイズを受け取るために、プロファイル情報を設定できます。

### PRコメントで設定（推奨）🆕

PRのコメント欄で `/profile` コマンドを使用：

```
/profile experience=mid years=3 focus=security,performance
```

**パラメータ:**
- `experience`: junior / mid / senior
- `years`: 経験年数（数値）
- `focus`: 注力分野（最大5つ、カンマ区切り）
  - bug_fix, performance, refactoring, security, logic
- `goal`: キャリア目標（文字列、省略可）

**例:**
```
/profile experience=senior years=5 focus=performance,security goal="フルスタックエンジニアを目指しています"
```

**ヘルプ表示:**
```
/profile
```

### API経由で設定

```bash
curl -X PUT https://your-bot.run.app/api/users/your-github-id/profile \
  -H "Content-Type: application/json" \
  -d '{
    "experienceLevel": "mid",
    "yearsOfExperience": 3,
    "focusAreas": ["security", "performance"],
    "careerGoal": "フルスタックエンジニアを目指しています"
  }'
```

---

## 💬 クイズに回答

### PRコメントで回答（推奨）🆕

PRのコメント欄で `/answer` コマンドを使用：

```
/answer 1 eb6577c1-43cd-4c80-a5f5-081998520d88
```

**フォーマット:**
```
/answer <選択肢番号> <Quiz ID>
```

**パラメータ:**
- `選択肢番号`: 1〜4の数字
- `Quiz ID`: ボットがクイズを投稿したコメントに記載されているUUID形式のID

**重要:** Quiz IDは必須です。ボットがクイズを投稿したコメントから、`Quiz ID: ` で始まる行のUUIDをコピーして使用してください。

**例:**
```
/answer 2 eb6577c1-43cd-4c80-a5f5-081998520d88
```

### API経由で回答

```bash
curl -X POST https://your-bot.run.app/api/quiz/quiz_abc123/answer \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your-github-id",
    "selectedAnswerIndex": 1
  }'
```

---

## 🧪 テスト

### 自動テスト

GitHub Actions により自動的にテストが実行されます：

```bash
# ローカルでテストを実行
npm run test

# TypeScript 型チェック
npm run typecheck

# Lint チェック
npm run lint
```

このプロジェクトは以下をテストします：
1. ユーザープロファイル作成
2. プロファイル取得
3. クイズ生成と回答（5回）
4. スキル統計取得
5. 成長マイルストーン取得
6. 学習推奨取得
7. チーム分析計算
8. チーム統計取得

### 手動テスト例

```bash
# 1. プロファイル作成
curl -X PUT http://localhost:3000/api/users/testuser/profile \
  -H "Content-Type: application/json" \
  -d '{
    "careerGoal": "セキュリティエンジニアを目指す",
    "experienceLevel": "junior",
    "yearsOfExperience": 1,
    "focusAreas": ["security"]
  }'

# 2. スキル統計確認
curl http://localhost:3000/api/users/testuser/skills

# 3. 学習推奨確認
curl http://localhost:3000/api/users/testuser/recommendations
```

---

## 📊 データモデル

### 主要エンティティ

- **User**: 開発者アカウント（累積統計）
- **UserProfile**: ユーザープロファイル（キャリア目標、経験レベル）
- **Quiz**: クイズ（問題文、選択肢、正解、解説）
- **Answer**: 回答履歴（選択した回答、正誤判定）
- **SkillStats**: スキル統計（カテゴリ別正答率、成長トレンド）
- **GrowthMilestone**: 成長マイルストーン（達成記録）
- **MergeRequest**: PR/MRメタデータ
- **TeamAnalytics**: チーム分析データ（集計統計）

### カテゴリ

- `bug_fix`: バグ修正
- `performance`: パフォーマンス改善
- `refactoring`: リファクタリング
- `security`: セキュリティ
- `logic`: ロジック・アルゴリズム

### 難易度

- `easy`: 簡単
- `medium`: 中級
- `hard`: 難しい

---

## 📈 パーソナライズ出題アルゴリズム

優先度スコアの計算式：

```
スコア = 苦手度(40%) + 目標関連度(30%) + 復習タイミング(20%) + 成長機会(10%)
```

- **苦手度**: 正答率が低いほど高スコア
- **目標関連度**: 注力分野に設定されていると高スコア
- **復習タイミング**: 1週間以上経過していると高スコア
- **成長機会**: 平均難易度が低い分野は高スコア

---

## 📊 データ可視化（Looker Studio連携）

### 準備

1. Firestore → BigQueryエクスポートを設定
2. Looker StudioでBigQueryに接続
3. ダッシュボードを作成

### ダッシュボード例

#### 個人ダッシュボード
- スキルレーダーチャート（分野別正答率）
- 成長曲線（時系列）
- マイルストーンタイムライン
- 弱点分野トップ5

#### チームダッシュボード
- チーム全体の正答率推移
- 分野別平均正答率
- 新人エンジニア成長パターン（パーセンタイル比較）
- アクティブユーザー数

詳細は [`docs/skill-map-implementation-guide.md`](./docs/skill-map-implementation-guide.md) を参照してください。

---

## 🎯 成功指標（KPI）

### 個人レベル
- 月次正答率の改善（前月比）
- 苦手分野の克服率（正答率50%→70%達成）

### チームレベル
- 新人エンジニアの標準成長期間（50%→70%達成までの日数）
- チーム全体の正答率中央値の向上

### プロダクトレベル
- ユーザーのプロファイル登録率
- ダッシュボードの月次アクティブビュー数
- クイズ継続率（月次回答ユーザー数）

---

## 📚 ドキュメント

- [アーキテクチャ図](./docs/architecture.md)
- [データモデル](./specs/001-mr-quiz-bot/data-model.md)
- [スキルマップ設計書](./specs/001-mr-quiz-bot/skill-map-design.md)
- [スキルマップ実装ガイド](./docs/skill-map-implementation-guide.md)
- [API仕様書](./specs/001-mr-quiz-bot/contracts/openapi.yaml)

---

## 🤝 コントリビューション

コミット前に以下のチェックを実行してください：

```bash
npm run format    # コードフォーマット
npm run lint      # リント
npm run typecheck # 型チェック
```

---

## 📄 ライセンス

MIT

---

## 🙏 謝辞

- Google Gemini API
- Hono Framework
- Firestore
