# sakagura-sumirator

JAWS FESTA 2026 前日イベント（酒蔵見学）から着想を得たアプリ開発

## 杜氏の一季 〜酒蔵シミュレーター〜

**杜氏（とうじ）**になって酒造りの判断を体験し、杜氏と蔵人の役割を学べる Web アプリです。

- 蔵元からの注文（鑑評会用の大吟醸、食中酒、燗酒、晩酌酒）と、その年の米・冬の条件が出題されます
- 蔵人の配置 → 原料米 → 精米 → 浸漬 → 製麹 → 酒母 → 酵母 → 醪の温度管理（3 回）→ 上槽 → 火入れ の判断を行います
- 結果として特定名称・日本酒度・酸度・味わい・総合評価と、杜氏としての振り返りが表示されます
- 結果は「蔵の記録帳」（DynamoDB）に保存され、番付で競えます

## 構成（サーバーレス・低コスト）

```
ブラウザ ─▶ CloudFront ─┬─ /*     ─▶ S3（非公開・OAC）           静的サイト
                        └─ /api/* ─▶ Lambda Function URL（IAM・OAC）─▶ DynamoDB（オンデマンド・TTL）
```

| 工夫 | 内容 |
| --- | --- |
| 常時起動リソースなし | EC2 / NAT / ALB / RDS / API Gateway を使わない |
| API Gateway 不要 | Lambda Function URL を CloudFront の背後に置き、OAC で直接アクセスを禁止 |
| Lambda | arm64・256MB・AWS SDK はランタイム同梱のものを利用（バンドル約 17KB） |
| DynamoDB | オンデマンド課金、GSI なし、1 年で TTL 削除 |
| ログ | 保持期間 1 週間 |
| CloudFront | 価格クラス 200（日本のエッジを含む）、API 応答も数秒〜1 分キャッシュ |

小規模利用なら AWS 無料利用枠に収まり、月額はほぼ 0 円です。

## ディレクトリ

| パス | 内容 |
| --- | --- |
| `shared/engine.ts` | 醸造シミュレーションエンジン（フロントと Lambda で共有） |
| `api/handler.ts` | API（Lambda） |
| `web/` | フロントエンド（TypeScript + esbuild、フレームワークなし） |
| `lib/`, `bin/` | CDK スタック |
| `test/` | Vitest のテスト |
| `aidlc-docs/` | AI-DLC の成果物（要件・設計・ユニット・テスト） |

## 使い方

前提：Node.js 22.12 以上、AWS 認証情報（デプロイするリソースを直接作成できる権限）

```bash
npm ci
npm test              # テスト
npm run dev           # http://localhost:8000 でフロントを確認（記録機能はデプロイ後）
```

### cdkd でデプロイ

[cdkd](https://github.com/go-to-k/cdkd)（CDK Direct）は CloudFormation を介さず AWS SDK を直接呼び出して CDK アプリをデプロイするツールです。
cdkd 自体は開発・検証用途向け（本番は通常の `cdk deploy` を推奨）と案内されています。

```bash
export AWS_PROFILE=<profile> AWS_REGION=ap-northeast-1
aws sts get-caller-identity   # デプロイ先アカウントを確認

npx cdkd bootstrap            # 初回のみ（cdkd の状態保存用 S3 バケットを作成）
npm run diff                  # 変更内容の確認
npm run deploy                # フロントをビルドしてデプロイ（出力の SiteUrl を開く）
npm run deploy:fast           # 安定化待ちを省略してさらに高速に
```

`SiteUrl` は CloudFront の配信開始後（数分）に表示できるようになります。

### 削除

```bash
npm run destroy
```

記録（DynamoDB テーブル）は誤削除を防ぐため既定で残ります。テーブルごと削除する場合は
`npx cdkd deploy -c destroyData=true` で設定を反映してから `npm run destroy` を実行してください。

通常の AWS CDK CLI でも同じアプリをデプロイできます（`npx cdk deploy`、要 `cdk bootstrap`）。

## AI-DLC

本アプリは [AI-DLC](https://github.com/awslabs/aidlc-workflows) の方法論に沿って開発しました。成果物は
[aidlc-docs/](aidlc-docs/README.md) にあります。AI-DLC は Claude Code 用に設定済みのため、
新しいセッションで `/aidlc` から続けて開発できます。
