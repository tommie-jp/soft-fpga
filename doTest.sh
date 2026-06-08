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
  --timing-ss      [08] 8080 全命令タイミング図スクリーンショット (73 ケース)
  --pdp11          [09] PDP-11 basic tests (test0–17 + sdiag ROM test, 19 件)
                   [10] PDP-11 MAINDEC 診断
                   [12] PDP-11 WASM コマンド起動テスト (Unix V6 /bin・/usr/bin 全コマンド)
                   [13] PDP-11 Unix V6 シナリオテスト (ls/cat/grep/sort/wc/ed/dc/as/db 等)
  --v6 [scenario]  [13] Unix V6 シナリオテストのみ実行（--pdp11 の 09/10/12 はスキップ）
                   scenario を指定すると単一シナリオだけ実行（拡張子省略可）
                   例: doTest.sh --v6 08-as
  --timing-ss-pdp11 [11] PDP-11 全命令タイミング図スクリーンショット (55 ケース)
                [10] PDP-11 MAINDEC 診断 (FKAAC0/FKABD0/FKACA0/FKTHB0/FKTGC0)
                [14] PDP-11 Trigger 式テスト (Vitest, 純 JS・WASM 不要)

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
RUN_PDP11=false
RUN_TIMING_SS_PDP11=false
RUN_V6=false
V6_FILTER=""
ANY_FLAG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
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
    --pdp11)
      RUN_PDP11=true; ANY_FLAG=true ;;
    --timing-ss-pdp11)
      RUN_TIMING_SS_PDP11=true; ANY_FLAG=true ;;
    --v6)
      RUN_V6=true; ANY_FLAG=true
      # 次の引数がオプションでなければシナリオ名として受け取る
      if [[ $# -gt 1 && "${2:0:1}" != "-" ]]; then
        V6_FILTER="$2"; shift
      fi
      ;;
    *)
      echo "不明なオプション: $1" >&2
      usage >&2
      exit 1 ;;
  esac
  shift
done

# フラグ未指定 → 全グループ実行
if ! $ANY_FLAG; then
  RUN_COCOTB=true
  RUN_6502=true
  RUN_8080=true
  RUN_WEB=true
  RUN_SIM_API=true
  RUN_TIMING_SS=true
  RUN_PDP11=true
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
# ビルド要否は Makefile の依存解決に委譲する（手書き mtime 判定を廃止）。
#   make -q で stale 判定だけ行い（ターゲットは再ビルドしない）、
#   必要なときだけ run_step として実ビルドする。
#   - 06-8080 WASM: docker ビルド（再現性のため）
#   - 09-pdp11 sim: ネイティブビルド
# ---------------------------------------------------------------------------
WASM_06_TARGET="examples/06-8080/web/sim.wasm"
if ! make -q -C "${SCRIPT_DIR}" "$WASM_06_TARGET" 2>/dev/null; then
  echo -e "${YELLOW}⚠ 06-8080 WASM が stale（make 判定）。再ビルドします。${RESET}"
  echo ""
  run_step "B1" "06-8080 WASM ビルド (make: docker)" \
    make -C "${SCRIPT_DIR}" "$WASM_06_TARGET"
  echo ""
fi

if $RUN_PDP11; then
  PDP11_SIM_TARGET="examples/09-pdp11/build/pdp11_sim"
  if ! make -q -C "${SCRIPT_DIR}" "$PDP11_SIM_TARGET" 2>/dev/null; then
    echo -e "${YELLOW}⚠ pdp11_sim が不在/stale（make 判定）。ビルドします。${RESET}"
    echo ""
    run_step "B2" "09-pdp11 ネイティブビルド (make)" \
      make -C "${SCRIPT_DIR}" "$PDP11_SIM_TARGET"
    echo ""
  fi
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

if $RUN_TIMING_SS_PDP11; then
  run_step "11" "PDP-11 全命令タイミング図スクリーンショット (55 ケース)" \
    bash scripts/_doTimingSSPDP11.sh
fi

if $RUN_PDP11; then
  run_step "09" "PDP-11 basic tests (test0–17 + sdiag ROM test)" \
    bash scripts/test-pdp11-basic.sh

  run_step "10" "PDP-11 MAINDEC 診断 (FKAAC0/FKABD0/FKACA0/FKTHB0/FKTGC0)" \
    bash scripts/test-pdp11-diags.sh

  run_step "12" "PDP-11 WASM コマンド起動テスト (Unix V6 /bin・/usr/bin)" \
    bash -c 'cd examples/09-pdp11/tests && node test_commands_executable.mjs'
fi

if $RUN_PDP11; then
  run_step "14" "PDP-11 Trigger 式テスト (Vitest)" \
    bash -c 'cd examples/09-pdp11/tests && npx vitest run trigger'
fi

if $RUN_PDP11 || $RUN_V6; then
  if [[ -n "$V6_FILTER" ]]; then
    run_step "13" "PDP-11 Unix V6 シナリオテスト ($V6_FILTER)" \
      bash scripts/test-pdp11-v6.sh "$V6_FILTER"
  else
    run_step "13" "PDP-11 Unix V6 シナリオテスト (全シナリオ)" \
      bash scripts/test-pdp11-v6.sh
  fi
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
