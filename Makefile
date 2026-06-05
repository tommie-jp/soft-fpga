# Makefile — soft-FPGA ビルド層（差分ビルド + 並列）
#
# 役割分担（ハイブリッド設計）:
#   - ビルド層（このファイル）: ソース→成果物の実ファイル依存。変更があった
#     example だけ再ビルドし、make -j で並列化する。
#   - 手順層（doDeployAll.sh / doTest.sh など）: デプロイ・確認・プロンプトといった
#     phony な手順は従来どおり bash が担当し、ビルドはこの Makefile に委譲する。
#
# よく使う:
#   make wasm           自己完結 example の WASM を差分ビルド（01–04, 09）
#   make wasm-09        09-pdp11 だけ差分ビルド
#   make host-09        PDP-11 ネイティブ sim
#   make deploy-build   GitHub Pages デプロイに必要な成果物（06 + 09）
#   make -j deploy-build  上記を並列ビルド
#   make help           ターゲット一覧
#
# 多出力の扱い:
#   build-wasm-*.sh は sim.js / sim.wasm / sim-test.mjs / web/js/ などを同時生成する。
#   Make の「1ターゲット=1ファイル」と相性が悪いので、各 example は .build/ 配下の
#   stamp ファイルで代表させ、ソース群が stamp より新しければ再ビルドする。

SHELL := /bin/bash
.DEFAULT_GOAL := help

STAMP := .build

# 全 example 共通の依存（libRTLScope ハーネス・Verilator ラッパ・wasm_compat.h）
SHARED_CXX := $(wildcard cxx/*)

# ソース列挙ヘルパー: 存在するディレクトリのファイルだけを再帰列挙する
# （05-dormann は verilog/ を持たない等の差異を吸収）
find_src = $(shell find $(1) -type f 2>/dev/null)

$(STAMP):
	@mkdir -p $(STAMP)

# ─────────────────────────────────────────────────────────────────────────────
# 自己完結 example の WASM（差分ビルド）
#   各 stamp は「example の verilog/ + cxx/ + 共有 cxx/ + ビルドスクリプト」に依存
# ─────────────────────────────────────────────────────────────────────────────
$(STAMP)/wasm-01.stamp: scripts/build-wasm.sh $(SHARED_CXX) \
		$(call find_src,examples/01-counter/verilog examples/01-counter/cxx) | $(STAMP)
	bash scripts/build-wasm.sh
	@touch $@

$(STAMP)/wasm-02.stamp: scripts/build-wasm-02.sh $(SHARED_CXX) \
		$(call find_src,examples/02-traffic-fsm/verilog examples/02-traffic-fsm/cxx) | $(STAMP)
	bash scripts/build-wasm-02.sh
	@touch $@

$(STAMP)/wasm-03.stamp: scripts/build-wasm-03.sh $(SHARED_CXX) \
		$(call find_src,examples/03-uart/verilog examples/03-uart/cxx) | $(STAMP)
	bash scripts/build-wasm-03.sh
	@touch $@

$(STAMP)/wasm-04.stamp: scripts/build-wasm-04.sh $(SHARED_CXX) \
		$(call find_src,examples/04-6502/verilog examples/04-6502/cxx) | $(STAMP)
	bash scripts/build-wasm-04.sh
	@touch $@

$(STAMP)/wasm-05.stamp: scripts/build-wasm-05.sh $(SHARED_CXX) \
		$(call find_src,examples/05-dormann/cxx) | $(STAMP)
	bash scripts/build-wasm-05.sh
	@touch $@

# 09 は vendor/cpus-pdp11/rtl も依存に含める（RTL 修正で確実に再ビルドさせる）
$(STAMP)/wasm-09.stamp: scripts/build-wasm-09.sh $(SHARED_CXX) \
		$(call find_src,examples/09-pdp11/verilog examples/09-pdp11/cxx vendor/cpus-pdp11/rtl) | $(STAMP)
	bash scripts/build-wasm-09.sh
	@touch $@

# 親しみやすい phony 別名（make wasm-09 で呼べる）
.PHONY: wasm-01 wasm-02 wasm-03 wasm-04 wasm-05 wasm-09
wasm-01: $(STAMP)/wasm-01.stamp
wasm-02: $(STAMP)/wasm-02.stamp
wasm-03: $(STAMP)/wasm-03.stamp
wasm-04: $(STAMP)/wasm-04.stamp
wasm-05: $(STAMP)/wasm-05.stamp
wasm-09: $(STAMP)/wasm-09.stamp

# doBuildWasm.sh 相当の集合（01–04, 09）。05-dormann はテスト変種なので含めない
.PHONY: wasm
wasm: wasm-01 wasm-02 wasm-03 wasm-04 wasm-09

# ─────────────────────────────────────────────────────────────────────────────
# PDP-11 ネイティブ sim（単一出力なので実バイナリをターゲットにする）
# ─────────────────────────────────────────────────────────────────────────────
PDP11_SIM := examples/09-pdp11/build/pdp11_sim
$(PDP11_SIM): scripts/build-host-09.sh \
		$(call find_src,examples/09-pdp11/cxx examples/09-pdp11/verilog vendor/cpus-pdp11/rtl)
	bash scripts/build-host-09.sh

.PHONY: host-09
host-09: $(PDP11_SIM)

# ─────────────────────────────────────────────────────────────────────────────
# 06-8080 CP/M：BIOS アセンブルの状態（linux⇄wasm）を持つステートフルな多段ビルド。
# 差分化は危険なので doBuildAll.sh を phony でそのまま呼ぶ。
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: cpm-06
cpm-06:
	bash doBuildAll.sh

# ─────────────────────────────────────────────────────────────────────────────
# 06-8080 WASM（docker ビルド）: doTest.sh 用。
# 手書き mtime 判定（harness.cpp -nt sim.wasm）の代わりに、Make の依存解決で
# stale 時のみ再ビルドさせる。テストのビルド再現性のため native ではなく
# docker compose の build-wasm サービス（= scripts/build-wasm-06.sh）を使う。
# ─────────────────────────────────────────────────────────────────────────────
WASM_06 := examples/06-8080/web/sim.wasm
$(WASM_06): examples/06-8080/cxx/harness.cpp scripts/build-wasm-06.sh \
		$(call find_src,examples/06-8080/verilog)
	USER_UID="$$(id -u)" USER_GID="$$(id -g)" \
	  docker compose -f docker/compose.yml run --rm build-wasm

.PHONY: wasm-06-docker
wasm-06-docker: $(WASM_06)

# ─────────────────────────────────────────────────────────────────────────────
# GitHub Pages デプロイに必要な成果物（doDeployAll.sh step1 が委譲する集合）
#   06（フルビルド）+ 09（差分 WASM）。make -j で並列化可能。
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: deploy-build
deploy-build: cpm-06 wasm-09

# ─────────────────────────────────────────────────────────────────────────────
# 後始末: stamp を消して次回フルリビルドさせる（成果物自体は残す。
#         完全クリーンは doClean.sh を使う）
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: clean-stamps
clean-stamps:
	rm -rf $(STAMP)

.PHONY: help
help:
	@echo "soft-FPGA ビルド層 (Makefile)"
	@echo ""
	@echo "  make wasm           自己完結 example の WASM を差分ビルド (01-04, 09)"
	@echo "  make wasm-NN        個別ビルド (wasm-01/02/03/04/05/09)"
	@echo "  make host-09        PDP-11 ネイティブ sim"
	@echo "  make cpm-06         06-8080 フルビルド (doBuildAll.sh)"
	@echo "  make deploy-build   デプロイ成果物 (06 + 09)。make -j で並列化可"
	@echo "  make clean-stamps   stamp 削除（次回フルリビルド）"
	@echo ""
	@echo "  手順層: デプロイ/テストは doDeployAll.sh / doTest.sh が担当"
