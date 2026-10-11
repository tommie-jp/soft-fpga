#!/bin/bash
# _build-wasm-common.sh — build-wasm*.sh 共通の部品（source して使う）
#
# 使い方（各 build-wasm*.sh の冒頭）:
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   ROOT="$SCRIPT_DIR/.."
#   OBJ_DIR="$ROOT/obj_dir_NN"
#   source "$SCRIPT_DIR/_build-wasm-common.sh"
#   wasm_sync_verilated_cpp if-missing   # または always
#   wasm_require_emsdk
#   ...
#   COMMON_FLAGS="-O2 -std=c++17 ... -I$OBJ_DIR"   # 例題ごとに異なるので呼び出し側で定義
#   wasm_compile_verilated_cpp
#
# 呼び出し側が事前に定義する変数: ROOT, OBJ_DIR
# この部品が定義する変数:         VERILATOR_ROOT, VERILATED_CPP, WASM_COMPAT

: "${ROOT:?ROOT must be set before sourcing _build-wasm-common.sh}"
: "${OBJ_DIR:?OBJ_DIR must be set before sourcing _build-wasm-common.sh}"

VERILATOR_ROOT="${VERILATOR_ROOT:-$(verilator --getenv VERILATOR_ROOT)}"
VERILATED_CPP="$ROOT/cxx/verilated.cpp"
WASM_COMPAT="$ROOT/cxx/wasm_compat.h"

# Verilator ランタイム verilated.cpp を cxx/ にコピーして使う（システムパスに直接依存しない）。
#   always     : 毎回上書きする。Verilator のバージョンと obj_dir の生成コードを必ず合わせたい例題向け。
#   if-missing : cxx/verilated.cpp が無いときだけコピーする。
wasm_sync_verilated_cpp() {
    local mode="${1:?usage: wasm_sync_verilated_cpp always|if-missing}"
    case "$mode" in
        always)
            cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
            ;;
        if-missing)
            if [ ! -f "$VERILATED_CPP" ]; then
                cp "$VERILATOR_ROOT/include/verilated.cpp" "$VERILATED_CPP"
            fi
            ;;
        *)
            echo "ERROR: wasm_sync_verilated_cpp: unknown mode '$mode'" >&2
            return 1
            ;;
    esac
}

# em++ が PATH に無ければ emsdk_env.sh を探して source する。見つからなければ異常終了する。
wasm_require_emsdk() {
    command -v em++ &>/dev/null && return 0

    local candidate emsdk_env=""
    for candidate in \
        "$HOME/emsdk/emsdk_env.sh" \
        "$HOME/emsdk/emsdk/emsdk_env.sh"; do
        if [ -f "$candidate" ]; then
            emsdk_env="$candidate"
            break
        fi
    done

    if [ -z "$emsdk_env" ]; then
        echo "ERROR: em++ not found. Install emsdk and source emsdk_env.sh" >&2
        return 1
    fi
    # shellcheck disable=SC1090
    source "$emsdk_env" 2>/dev/null
}

# verilated.cpp を wasm_compat.h を -include して別コンパイルする（COMMON_FLAGS を使う）。
# -I$ROOT/cxx を先頭に置くことで cxx/verilatedos_c.h が優先され、
# Linux 固有の pthread_getaffinity_np 呼び出しを回避する。
wasm_compile_verilated_cpp() {
    # shellcheck disable=SC2086
    em++ $COMMON_FLAGS \
        -I"$ROOT/cxx" \
        -include "$WASM_COMPAT" \
        -c "$VERILATED_CPP" \
        -o "$OBJ_DIR/verilated.wasm.o"
}
