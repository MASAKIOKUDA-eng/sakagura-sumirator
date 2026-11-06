# Application Design / NFR Design

## 構成

```
 ブラウザ
   │ HTTPS
   ▼
 CloudFront (PriceClass 200 / HTTP2+3 / 圧縮)
   ├─ /*      → S3 バケット（非公開, OAC）       … 静的フロントエンド
   └─ /api/*  → Lambda Function URL（IAM, OAC）… API (Node.js 22 / arm64)
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

想定月額：個人・イベント規模（〜数千アクセス/月）では **ほぼ 0 USD**（無料利用枠内）。
無料枠外でも S3/DynamoDB のストレージ代として数セント程度。

## API

すべて CloudFront 経由（`/api` 配下）。POST/PUT は OAC の仕様上、
クライアントが `x-amz-content-sha256`（本文の SHA-256）を付与する。

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/brews?limit=20` | 最近の記録（新しい順, 最大 50） |
| GET | `/api/brews/{id}` | 記録の詳細 |
| POST | `/api/brews` | 記録を保存（サーバーで結果を再計算） |
| GET | `/api/ranking` | 直近 200 件のうちスコア上位 10 件 |

## データモデル（単一テーブル）

| 属性 | 例 | 説明 |
| --- | --- | --- |
| `pk` (PK) | `BREW` | 固定値。少量データ前提で 1 パーティションに集約 |
| `sk` (SK) | `mhm1x2ab-k3f9` | 先頭が時刻の base36 のため、辞書順 = 作成順 |
| `brewerName` / `sakeName` | | 杜氏名・酒銘 |
| `seed` / `decisions` | | 再計算に必要な入力 |
| `result` | | 計算結果（スコア・酒質など） |
| `expiresAt` | | TTL（1 年後に自動削除） |

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
- cdkd が SDK プロバイダーを持つリソース（S3, CloudFront, OAC, Lambda, Function URL, DynamoDB, IAM, Logs）中心で構成し高速化
- 静的ファイルは `BucketDeployment`（カスタムリソース）で同じデプロイ内に反映
