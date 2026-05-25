#!/bin/bash
# doTest.sh — 全テストスイートを実行してサマリーを表示する

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

# ---------------------------------------------------------------------------
# ヘルプ
# ---------------------------------------------------------------------------
usage() {
  cat <<'EOF'
使い方: doTest.sh [オプション]

オプション:
  -h, --help    このヘルプを表示して終了

テストグループ (無指定時は全グループを実行):
  --cocotb      [01] cocotb RTL テスト
  --6502        [02] Woz Monitor / Integer BASIC 統合テスト
                [03] Dormann 6502 機能テスト
  --8080        [04] 8080 Vitest タイミングテスト
                [05] 8080 CP/M シミュレータ テスト (cmake ビルド＋全テスト)
  --web         [06] Web 統合テスト (Playwright / Apple-I & CP/M WASM)
  --sim-api     [07] sim API テスト (MVI A,$FF · Playwright / TestSimAPI)
  --timing-ss   [08] 8080 全命令タイミング図スクリーンショット (73 ケース)

複数グループの同時指定可:
  doTest.sh --8080 --web
  doTest.sh --6502 --cocotb
EOF
}

# ---------------------------------------------------------------------------
# 引数解析
# ---------------------------------------------------------------------------
RUN_COCOTB=false
RUN_6502=false
RUN_8080=false
RUN_WEB=false
RUN_SIM_API=false
RUN_TIMING_SS=false
ANY_FLAG=false

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage; exit 0 ;;
    --cocotb)
      RUN_COCOTB=true; ANY_FLAG=true ;;
    --6502)
      RUN_6502=true; ANY_FLAG=true ;;
    --8080)
      RUN_8080=true; ANY_FLAG=true ;;
    --web)
      RUN_WEB=true; ANY_FLAG=true ;;
    --sim-api)
      RUN_SIM_API=true; ANY_FLAG=true ;;
    --timing-ss)
      RUN_TIMING_SS=true; ANY_FLAG=true ;;
    *)
      echo "不明なオプション: $arg" >&2
      usage >&2
      exit 1 ;;
  esac
done

# フラグ未指定 → 全グループ実行
if ! $ANY_FLAG; then
  RUN_COCOTB=true
  RUN_6502=true
  RUN_8080=true
  RUN_WEB=true
  RUN_SIM_API=true
  RUN_TIMING_SS=true
fi

# ---------------------------------------------------------------------------
# ログ設定
# ---------------------------------------------------------------------------
mkdir -p logs
LOG="logs/doTest-$(date +%Y-%m-%d-%H%M).log"
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
  STEP_NAMES+=("[$num] $name")
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
# WASM ビルド要否チェック＆自動ビルド
# ---------------------------------------------------------------------------
# 判定: harness.cpp または build-wasm-06.sh が sim.wasm より新しければ再ビルド
WASM_06="${SCRIPT_DIR}/examples/06-8080/web/sim.wasm"
WASM_06_REBUILD=false

if [ ! -f "$WASM_06" ]; then
  echo -e "${YELLOW}⚠ sim.wasm が存在しない。ビルドを実行します。${RESET}"
  WASM_06_REBUILD=true
elif [ "${SCRIPT_DIR}/examples/06-8080/cxx/harness.cpp" -nt "$WASM_06" ]; then
  echo -e "${YELLOW}⚠ harness.cpp が sim.wasm より新しい。ビルドを実行します。${RESET}"
  WASM_06_REBUILD=true
elif [ "${SCRIPT_DIR}/scripts/build-wasm-06.sh" -nt "$WASM_06" ]; then
  echo -e "${YELLOW}⚠ build-wasm-06.sh が sim.wasm より新しい。ビルドを実行します。${RESET}"
  WASM_06_REBUILD=true
fi

if $WASM_06_REBUILD; then
  echo ""
  run_step "B1" "06-8080 WASM ビルド (harness.cpp 変更検出)" \
    bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
      docker compose -f docker/compose.yml run --rm build-wasm'
  echo ""
fi

# ---------------------------------------------------------------------------
# 各テストステップ
# ---------------------------------------------------------------------------

if $RUN_COCOTB; then
  run_step "01" "cocotb RTL テスト" \
    scripts/test-cocotb.sh
fi

if $RUN_6502; then
  run_step "02" "Woz Monitor / Integer BASIC 統合テスト" \
    bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
      docker compose -f docker/compose.yml run --rm wozmon'

  run_step "03" "Dormann 6502 機能テスト" \
    bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
      docker compose -f docker/compose.yml run --rm dormann'
fi

if $RUN_8080; then
  run_step "04" "8080 Vitest タイミングテスト" \
    bash -c 'cd examples/06-8080/tests && npm test'

  run_step "05" "8080 CP/M シミュレータ テスト (cmake ビルド＋全テスト)" \
    bash -c 'USER_UID="$(id -u)" USER_GID="$(id -g)" \
      docker compose -f docker/compose.yml run --rm test-8080-cpm'
fi

if $RUN_WEB; then
  run_step "06" "Web 統合テスト (Playwright / Apple-I & CP/M WASM)" \
    bash scripts/_doTestAll-web.sh
fi

if $RUN_SIM_API; then
  run_step "07" "sim API テスト (MVI A,\$FF · Playwright / TestSimAPI)" \
    bash scripts/_test-8080-sim-api.sh
fi

if $RUN_TIMING_SS; then
  run_step "08" "8080 全命令タイミング図スクリーンショット (73 ケース)" \
    bash scripts/_test-8080-timing-ss.sh
fi

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

  printf "  %-52s %b\n" "$name" "$marker"
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
