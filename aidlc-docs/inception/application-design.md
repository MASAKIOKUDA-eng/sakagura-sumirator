# Application Design / NFR Design

## 構成

```
 ブラウザ ───────────────▶ Cognito マネージドログイン（日本語）… 登録・ログイン（認可コード + PKCE）
   │ HTTPS
   ▼
 WAF（us-east-1：レート制限 + マネージドルール）
   ▼
 CloudFront (PriceClass 200 / HTTP2+3 / 圧縮)
   ├─ /*      → S3 バケット（非公開, OAC）       … 静的フロントエンド + config.json
   └─ /api/*  → Lambda Function URL（IAM, OAC）… API (Node.js 22 / arm64)、アクセストークン検証
                     │
                     ▼
               DynamoDB（オンデマンド, TTL）    … 蔵の記録帳
```

| リソース | 選定理由（コスト重視） |
| --- | --- |
| CloudFront | 無料利用枠（1TB/月・1,000万リクエスト/月）。API も同一オリジンで配信し CORS 不要 |
| S3 | 静的ファイルのみ。数 MB 以下 |
| Lambda Function URL | API Gateway の料金が不要。arm64（x86 より約 20% 安い）、256MB |
| DynamoDB オンデマンド | アイドル時の課金なし。GSI なしの単一テーブル設計で書き込み課金を最小化 |
| CloudWatch Logs | 保持期間 1 週間でログ保管料を抑制 |
| Cognito（Essentials） | 月 1 万 MAU まで無料。日本語のマネージドログイン画面を使えるため Lite ではなく Essentials |
| WAF | 固定費 約 8 USD/月。`-c waf=false` で無効化できる |

想定月額：個人・イベント規模（〜数千アクセス/月）では **WAF の約 8 USD のみ**（他は無料利用枠内）。

## 設計判断

### ADR-1 認証方式：Cognito マネージドログイン（認可コード + PKCE）

- **Context**：記録の保存をログイン必須にしたい。コストを抑え、日本語で使えること。
- **Decision**：Cognito ユーザープール（Essentials）のマネージドログイン画面を使い、SPA は認可コード + PKCE でトークンを取得する。API は Lambda 内で aws-jwt-verify によりアクセストークンを検証する。
- **Consequences**：パスワードがアプリを通らず、登録・確認・パスワード再設定の画面を自作しなくてよい。トークンはブラウザの localStorage に保存するため、XSS 対策（出力時のエスケープ）が前提になる。
- **Alternatives Rejected**：
  - 自作のログインフォーム + USER_SRP_AUTH：SRP のライブラリが必要で、画面・確認フローの実装量が多い
  - API Gateway の Cognito オーソライザー：API Gateway の料金が発生し、Function URL 構成の利点が失われる

### ADR-2 トークンの受け渡しヘッダー

- **Context**：CloudFront OAC は Lambda Function URL への SigV4 署名に `Authorization` ヘッダーを使う。
- **Decision**：アクセストークンは独自ヘッダー `x-auth-token` で送る。
- **Consequences**：API の利用者は独自ヘッダーを使う必要がある。CloudFront のキャッシュキーにこのヘッダーを含めないため、利用者ごとの応答（`/api/me/brews`）は `Cache-Control: no-store` で返す。
- **Alternatives Rejected**：OAC をやめて Function URL を公開（`authType: NONE`）：Lambda を CloudFront・WAF を通さず直接呼べてしまう

### ADR-3 トークン検証でクライアント ID を指定しない

- **Context**：Lambda の環境変数にアプリクライアント ID を渡すと、Lambda → クライアント → CloudFront（コールバック URL）→ Function URL → Lambda の循環参照になる。
- **Decision**：ユーザープール ID とトークン種別（access）で検証し、クライアント ID は検証しない。このプールのアプリクライアントは 1 つだけとする。
- **Consequences**：同じプールに別のクライアントを追加すると、そのトークンも受け付ける。追加する場合は SSM パラメータ経由でクライアント ID を渡す方式に変える。
- **Alternatives Rejected**：コールバック URL を後からカスタムリソースで設定：デプロイが複雑になり、cdkd での高速性も落ちる

### ADR-4 WAF の配置

- **Context**：CloudFront 用の WAF は us-east-1 にしか作れない。本体は東京に置きたい。
- **Decision**：WAF だけ us-east-1 の別スタックにし、本体スタックから `Fn::GetStackOutput` で ARN を参照する（スタック依存で WAF を先にデプロイ）。
- **Consequences**：2 スタック構成になる。参照は弱い参照のため、WAF スタックを先に削除しないこと。
- **Alternatives Rejected**：
  - 全体を us-east-1 に置く：DynamoDB・Lambda が日本から遠くなり API の応答が遅くなる
  - CDK の `crossRegionReferences`：カスタムリソースと SSM を使うため、構成が複雑になる
  - CloudFront 定額プラン（WAF 込み）：CDK/cdkd の管理外になり、設定が手作業になる

## API

すべて CloudFront 経由（`/api` 配下）。POST/PUT は OAC の仕様上、
クライアントが `x-amz-content-sha256`（本文の SHA-256）を付与する。

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/brews?limit=20` | 最近の記録（新しい順, 最大 50） |
| GET | `/api/brews/{id}` | 記録の詳細 |
| POST | `/api/brews` | 記録を保存（サーバーで結果を再計算） |
| GET | `/api/ranking` | 直近 200 件のうちスコア上位 10 件 |
| GET | `/api/me/brews` | 自分の記録（要ログイン、キャッシュなし） |

POST `/api/brews` と GET `/api/me/brews` は `x-auth-token` ヘッダーに Cognito のアクセストークンが必要（なければ 401）。

## データモデル（単一テーブル）

| 属性 | 例 | 説明 |
| --- | --- | --- |
| `pk` (PK) | `BREW` | 固定値。少量データ前提で 1 パーティションに集約 |
| `sk` (SK) | `mhm1x2ab-k3f9` | 先頭が時刻の base36 のため、辞書順 = 作成順 |
| `brewerName` / `sakeName` | | 杜氏名・酒銘 |
| `seed` / `decisions` | | 再計算に必要な入力 |
| `result` | | 計算結果（スコア・酒質など） |
| `userSub` | | 保存した利用者の ID（API の応答には含めない） |
| `expiresAt` | | TTL（1 年後に自動削除） |

「自分の記録」用に、保存時に同じトランザクションで要約アイテムも書き込む（GSI を使わず書き込み課金を抑える）。

| 属性 | 例 | 説明 |
| --- | --- | --- |
| `pk` (PK) | `USER#<sub>` | 利用者ごとのパーティション |
| `sk` (SK) | 本体と同じ ID | |
| 要約項目 | | 酒銘・杜氏名・スコア・ランク・特定名称など |

## シミュレーションモデル

`shared/engine.ts` に純粋関数として実装し、フロントエンドと Lambda で同じコードを使う
（esbuild でそれぞれにバンドル）。乱数はシード付き（mulberry32）で、同じ入力からは
必ず同じ結果になる。そのためサーバーで再計算でき、改ざん対策になる。

- 条件：シードから「米の硬さ」「冬の寒さ」「蔵元の注文」を決定
- 酒質：香り・旨味・キレ・綺麗さ（0〜100）、日本酒度・酸度・アルコール度
- 評価：綺麗さ（造りの確かさ）45% ＋ 注文への適合度 45% ＋ 酒質の個性 10%
- 蔵人の配置：ベテランを置いた工程の失敗を軽減する

## デプロイ（cdkd）

- CDK アプリ（TypeScript）をそのまま `cdkd deploy` で直接 SDK 呼び出しによりデプロイ
- cdkd が SDK プロバイダーを持つリソース（S3, CloudFront, OAC, Lambda, Function URL, DynamoDB, IAM, Logs, Cognito UserPool, WAFv2）中心で構成し高速化
- 静的ファイルは `BucketDeployment`（カスタムリソース）で同じデプロイ内に反映
- Cognito のドメイン・クライアント ID はデプロイ時に `config.json` として配置し、フロントエンドが起動時に読み込む
- `cdkd deploy --all` で WAF（us-east-1）→ 本体（東京）の順にデプロイされる
