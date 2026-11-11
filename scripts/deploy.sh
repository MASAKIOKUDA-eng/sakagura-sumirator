#!/usr/bin/env bash
# フロントエンドをビルドして cdkd でデプロイし、ログを deploy-logs/ に残す。
#
#   AWS_REGION=us-east-1 npm run deploy            # 通常のデプロイ
#   AWS_REGION=us-east-1 npm run deploy -- --no-wait   # cdkd の追加オプションはそのまま渡す
#
# - ログ：deploy-logs/<UTC 日時>.log（色の制御文字を除き、AWS アカウント ID は伏せ字）
# - 一覧：deploy-logs/HISTORY.md に 1 行ずつ追記
# リポジトリは公開されているため、ログをコミットする前に内容を確認すること。
set -uo pipefail

cd "$(dirname "$0")/.."
LOG_DIR=deploy-logs
mkdir -p "$LOG_DIR"

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
log_file="$LOG_DIR/$stamp.log"
region=${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-northeast-1}}
commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
dirty=$([ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ] && echo " (未コミットの変更あり)" || echo "")
account=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
caller=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null || echo "unknown")

# アカウント ID を伏せ字にし、色の制御文字を除く
sanitize() {
  if [ -n "$account" ]; then
    sed -e $'s/\x1b\\[[0-9;]*[A-Za-z]//g' -e "s/$account/<ACCOUNT_ID>/g"
  else
    sed -e $'s/\x1b\\[[0-9;]*[A-Za-z]//g'
  fi
}

{
  echo "# cdkd deploy log"
  echo "started_at: $started_at"
  echo "commit:     $commit ($branch)$dirty"
  echo "region:     $region（WAF スタックは us-east-1）"
  echo "caller:     $caller"
  echo "command:    cdkd deploy --all $*"
  echo "----------------------------------------"
} | sanitize >"$log_file"

start_s=$(date +%s)
raw=$(mktemp)
{
  npm run --silent build:web && npx cdkd deploy --all "$@"
} 2>&1 | tee "$raw"
status=${PIPESTATUS[0]}
duration=$(($(date +%s) - start_s))
sanitize <"$raw" >>"$log_file"
rm -f "$raw"

result=$([ "$status" -eq 0 ] && echo "成功" || echo "失敗（exit $status）")
{
  echo "----------------------------------------"
  echo "finished_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "duration:    ${duration}s"
  echo "result:      $result"
} | sanitize >>"$log_file"

history="$LOG_DIR/HISTORY.md"
if [ ! -f "$history" ]; then
  {
    echo "# デプロイ履歴"
    echo
    echo "\`npm run deploy\` を実行するたびに 1 行追記されます。詳細は各ログファイルを参照してください。"
    echo
    echo "| 日時（UTC） | コミット | リージョン | 結果 | 所要時間 | ログ |"
    echo "| --- | --- | --- | --- | --- | --- |"
  } >"$history"
fi
echo "| $started_at | \`$commit\`$dirty | $region | $result | ${duration}s | [$stamp.log]($stamp.log) |" >>"$history"

echo
echo "デプロイログ: $log_file（一覧: $history）"
exit "$status"
