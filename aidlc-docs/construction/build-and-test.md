# Code Generation / Build and Test

## 生成したコード

| Unit | ファイル |
| --- | --- |
| U1 醸造エンジン | `shared/engine.ts` |
| U2 API | `api/handler.ts` |
| U3 フロントエンド | `web/public/*`, `web/src/*`, `scripts/build-web.mjs` |
| U4 インフラ | `bin/app.ts`, `lib/sakagura-stack.ts`, `cdk.json` |

## テスト戦略

| 種類 | 内容 | コマンド |
| --- | --- | --- |
| 型チェック | 全 TypeScript | `npm run typecheck` |
| 単体テスト | エンジン（決定性・範囲・判断ごとの影響・特定名称・入力検証）、API（再計算・入力検証・一覧上限・番付・不正 ID） | `npm test` |
| 合成 | cdkd でテンプレートを合成 | `npm run synth` |
| E2E（開発時） | ヘッドレス Chromium で全 14 判断 → 結果 → 保存 → 記録表示 → 記録帳を、デスクトップ幅・スマートフォン幅で実行（API はモック） | 開発時に実施 |

## 結果（2026-11-06）

- 型チェック：成功
- 単体テスト：30 件すべて成功
- `cdkd synth`：成功（22 リソース。CloudFront CachePolicy 以外はすべて cdkd の SDK プロバイダー対象）
- E2E：デスクトップ・モバイルとも全画面を通過、横スクロールなし、アプリ由来のコンソールエラーなし
- スコアバランス：各注文 × 冬の条件で、最適解 88〜98 点・ランダム操作の中央値 34〜69 点

## 未実施

- 実 AWS 環境へのデプロイ（作業環境に AWS 認証情報がなかったため）。手順は README を参照
