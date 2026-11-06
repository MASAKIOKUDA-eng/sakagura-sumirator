# AI-DLC 成果物（酒蔵シミュレーター「杜氏の一季」）

本プロジェクトは [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)（AI-DLC v2.11.3）の
方法論に沿って開発しました。要件が明確で小規模なため、**Express プロファイル相当**のルート
（Requirements → Units → Code Generation → Build and Test）を採用しています。

| フェーズ | ステージ | 成果物 |
| --- | --- | --- |
| Inception | Requirements Analysis | [inception/requirements.md](inception/requirements.md) |
| Inception | Application Design / NFR | [inception/application-design.md](inception/application-design.md) |
| Inception | Units Generation | [inception/units.md](inception/units.md) |
| Construction | Code Generation / Build and Test | [construction/build-and-test.md](construction/build-and-test.md) |

## AI-DLC を使って追加開発する

AI-DLC はプロジェクトに Claude Code 用ハーネスとして設定済みです（`aidlc config --harness claude`）。
新しい Claude Code セッションを開き、次のように指示すると承認ゲート付きのワークフローで続きを開発できます。

```text
/aidlc feature 酒蔵シミュレーターに「利き酒クイズ」機能を追加したい
```

AI-DLC 本体がない環境では、先にインストールしてください。

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
aidlc config --harness claude
aidlc doctor
```
