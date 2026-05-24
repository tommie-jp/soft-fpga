#!/bin/bash
# doTestAll.sh — 全テストスイートを実行してサマリーを表示する

mkdir -p logs
LOG="logs/doTestAll-$(date +%Y-%m-%d-%H%M).log"
exec > >(tee "$LOG") 2>&1
echo "ログ出力先: $LOG"
echo ""

# ---------------------------------------------------------------------------
# カラー定義
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# 結果追跡
# ---------------------------------------------------------------------------
declare -a STEP_NAMES=()
declare -a STEP_STATUS=()   # "PASS" / "FAIL"
declare -a STEP_DETAIL=()   # 追加情報（失敗数など）
TOTAL_FAIL=0

# run_step <番号> <名前> <コマンド...>
# コマンドを実行し、終了コードを記録する
run_step() {
  local num="$1"; shift
  local name="$1"; shift

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BOLD}[${num}] ${name}${RESET}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  "$@"
  local exit_code=$?

  echo ""
  STEP_NAMES+=("$name")
  if [ $exit_code -eq 0 ]; then
    STEP_STATUS+=("PASS")
    STEP_DETAIL+=("")
  else
    STEP_STATUS+=("FAIL")
    STEP_DETAIL+=("exit=$exit_code")
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# 各テストステップ
# ---------------------------------------------------------------------------

run_step "01" "cocotb RTL テスト" \
  scripts/test-cocotb.sh

run_step "02" "Woz Monitor / Integer BASIC 統合テスト" \
  bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
    docker compose -f docker/compose.yml run --rm wozmon'

run_step "03" "Dormann 6502 機能テスト" \
  bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
    docker compose -f docker/compose.yml run --rm dormann'

run_step "04" "8080 Vitest タイミングテスト" \
  bash -c 'cd examples/06-8080/tests && npm test'

# ---------------------------------------------------------------------------
# サマリー表示
# ---------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BOLD}テスト結果サマリー${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=${#STEP_NAMES[@]}
TOTAL_PASS=$((TOTAL - TOTAL_FAIL))

for i in "${!STEP_NAMES[@]}"; do
  num=$((i + 1))
  name="${STEP_NAMES[$i]}"
  status="${STEP_STATUS[$i]}"
  detail="${STEP_DETAIL[$i]}"

  if [ "$status" = "PASS" ]; then
    marker="${GREEN}✅ PASS${RESET}"
  else
    marker="${RED}❌ FAIL${RESET}"
    if [ -n "$detail" ]; then
      marker="${marker} ${YELLOW}(${detail})${RESET}"
    fi
  fi

  printf "  %02d. %-48s %b\n" "$num" "$name" "$marker"
done

echo ""
echo -e "  合計: ${BOLD}${TOTAL} ステップ${RESET} / ${GREEN}${TOTAL_PASS} PASS${RESET} / ${RED}${TOTAL_FAIL} FAIL${RESET}"
echo ""

if [ $TOTAL_FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✅ 全テスト通過${RESET}"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}❌ ${TOTAL_FAIL} ステップが失敗しました。上記ログを確認してください。${RESET}"
  echo -e "  ログ: ${LOG}"
  echo ""
  exit 1
fi
