#!/bin/bash
# cocotb + pytest による RTL 単体回帰テスト (コンテナ内実行スクリプト)
# docker compose run test-cocotb から呼び出される。
set -euo pipefail

cd /work

# cocotb が生成するビルド成果物をプロジェクト外に出す
export SIM_BUILD=/tmp/cocotb-build

pytest verif/cocotb/ -v --tb=short "$@"
