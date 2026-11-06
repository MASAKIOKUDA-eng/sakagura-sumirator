# Units Generation

| Unit | 内容 | 主なファイル |
| --- | --- | --- |
| U1 醸造エンジン | 条件生成・判断の検証・酒質計算・醪の推移計算 | `shared/engine.ts` |
| U2 API | Function URL ハンドラー、入力検証、DynamoDB 読み書き | `api/handler.ts` |
| U3 フロントエンド | 画面（体験・解説・記録帳・番付）、グラフ、API 呼び出し | `web/` |
| U4 インフラ | CDK スタック（S3, CloudFront, Lambda, DynamoDB） | `bin/app.ts`, `lib/sakagura-stack.ts` |

依存関係：U1 ← U2, U3 ／ U4 は U2, U3 の成果物をデプロイする。
