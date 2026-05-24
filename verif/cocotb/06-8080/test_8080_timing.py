"""test_8080_timing.py — cpm_top RTL レベル バスタイミング検証 (cocotb / Verilator)

【方法 1: RTL レベル シグナルタイミング】

ram は Verilator デフォルト (2ステート, 0 初期値) で全ビット 0 = NOP (0x00) ストリームになる。

検証項目:
  1. f1/f2 交互切替え — cpm_top 内の 2 フェーズクロック生成を確認
  2. SYNC は連続 2 posedge だけ HIGH — 4T NOP は 8 posedge で SYNC×2
  3. NOP 実行中は WR_N=1, MEMW=0 — メモリ書き込み不在
  4. NOP サイクル周期 = 8 posedge — SYNC の立ち上がり間隔
  5. MEMR は T1 後に HIGH — DBIN アクティブ期間 (T2-T3)

【cocotb / Verilator スケジューリング注意】
  RisingEdge(clk)   は posedge クロックエッジ「前」(pre-eval) に発火する。
  そのため RisingEdge(dut.clk) 直後に信号を読むと always @(posedge clk) 実行前の
  OLD 値になり、1 posedge のずれが生じる。
  ReadOnly() を併用することで NBA/always 完了後の安定値 (post-eval) を読む。
  全ての RisingEdge(dut.clk) の直後に await ReadOnly() を入れることでずれをなくす。
"""

from pathlib import Path
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, ReadOnly

# ---------------------------------------------------------------------------
# Verilog ソース (プロジェクトルートからの相対パス)
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parents[3]  # verif/cocotb/06-8080 → 3 階層上 = プロジェクトルート

VERILOG_SOURCES = [
    ROOT / "examples" / "06-8080" / "verilog" / "vm80a" / "org" / "rtl" / "vm80a.v",
    ROOT / "examples" / "06-8080" / "verilog" / "cpm_top.v",
]

# ---------------------------------------------------------------------------
# 共通ヘルパー
# ---------------------------------------------------------------------------

async def do_reset(dut, cycles: int = 10) -> None:
    """リセットをアサートして deasset する。RAM は 0 のままで NOP ストリーム。"""
    dut.reset.value = 1
    dut.io_din.value = 0  # I/O ポートデータ (メモリアクセスでは使われない)
    for _ in range(cycles):
        await RisingEdge(dut.clk)
    dut.reset.value = 0
    await RisingEdge(dut.clk)


async def wait_sync_rising(dut) -> None:
    """dbg_sync の立ち上がりを RisingEdge(clk) + ReadOnly() ポーリングで検出する。

    RisingEdge(dut.clk) は always @(posedge clk) 実行前 (pre-eval) に発火するため、
    直後に信号を読むと OLD 値になる。ReadOnly() を挟むことで NBA/always 完了後の
    安定値 (post-eval) を読み、1 posedge のずれをなくす。
    返却時: T1 f2-action posedge (post-eval) で dbg_sync=1 が確定した状態。
    """
    # まず LOW になるまで待つ (already LOW なら即抜ける)
    while True:
        await RisingEdge(dut.clk)
        await ReadOnly()
        if int(dut.dbg_sync.value) == 0:
            break
    # SYNC が HIGH になるまで待つ
    while True:
        await RisingEdge(dut.clk)
        await ReadOnly()
        if int(dut.dbg_sync.value) == 1:
            break


# ---------------------------------------------------------------------------
# テスト 1: f1/f2 交互切替え
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_f1_f2_alternation(dut):
    """f1/f2 は毎 posedge で交互に切り替わり、常に相補関係にある"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    # 初期の 2 posedge は f1=f2=0 から f1=1,f2=0 に落ち着くまでの整定
    await RisingEdge(dut.clk)
    await ReadOnly()
    await RisingEdge(dut.clk)
    await ReadOnly()

    prev_f1 = int(dut.f1.value)
    for i in range(16):
        await RisingEdge(dut.clk)
        await ReadOnly()
        cur_f1 = int(dut.f1.value)
        cur_f2 = int(dut.f2.value)

        assert cur_f1 != cur_f2, (
            f"posedge {i}: f1={cur_f1} と f2={cur_f2} が相補でない"
        )
        assert cur_f1 != prev_f1, (
            f"posedge {i}: f1 がフリップしていない (prev={prev_f1}, cur={cur_f1})"
        )
        prev_f1 = cur_f1


# ---------------------------------------------------------------------------
# テスト 2: SYNC は 2 posedge だけ HIGH
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_sync_high_exactly_two_cycles(dut):
    """SYNC (dbg_sync) は連続 2 posedge だけ HIGH、残り 6 posedge は LOW

    vm80a の SYNC はパイプライン 1 段遅延するため、T1 Φ2 と T2 Φ1 の期間に
    HIGH になる (Intel 8080A の T1 両フェーズと 1 posedge ずれる)。
    """
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    await wait_sync_rising(dut)

    # --- SYNC HIGH posedge 1: SYNC=1 ---
    assert dut.dbg_sync.value == 1, (
        f"SYNC posedge 1: SYNC=1 を期待, 実際={int(dut.dbg_sync.value)}"
    )

    # --- SYNC HIGH posedge 2: SYNC=1 ---
    await RisingEdge(dut.clk)
    await ReadOnly()
    assert dut.dbg_sync.value == 1, (
        f"SYNC posedge 2: SYNC=1 を期待, 実際={int(dut.dbg_sync.value)}"
    )

    # --- 残り 6 posedge: SYNC=0 ---
    for pos in range(1, 7):
        await RisingEdge(dut.clk)
        await ReadOnly()
        assert dut.dbg_sync.value == 0, (
            f"SYNC LOW posedge {pos + 2}: SYNC=0 を期待, 実際={int(dut.dbg_sync.value)}"
        )


# ---------------------------------------------------------------------------
# テスト 3: NOP 実行中は書き込みなし
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_nop_no_memory_write(dut):
    """NOP 実行中は WR_N=1, MEMW=0 が維持される (メモリ書き込みなし)"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    await wait_sync_rising(dut)

    # 3 NOP サイクル分 (= 24 posedge) 監視
    for i in range(3 * 8):
        await RisingEdge(dut.clk)
        await ReadOnly()
        assert dut.dbg_wr_n.value == 1, (
            f"posedge {i}: WR_N=0 を検出 (NOP 中に書き込みが起きている)"
        )
        assert dut.dbg_memw.value == 0, (
            f"posedge {i}: MEMW=1 を検出 (NOP 中にメモリライトストローブが立っている)"
        )


# ---------------------------------------------------------------------------
# テスト 4: NOP サイクル周期 = 8 posedge
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_nop_sync_period_8_clks(dut):
    """NOP サイクルの SYNC 周期は 8 posedge (4T × 2フェーズ)"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    await wait_sync_rising(dut)

    # 5 サイクル分の周期を計測
    CYCLES_TO_CHECK = 5
    for cycle_num in range(CYCLES_TO_CHECK):
        count = 0
        prev_sync = int(dut.dbg_sync.value)  # 最初は SYNC=1 (立ち上がり直後)

        # 次の SYNC 立ち上がりエッジまで posedge をカウント
        while True:
            await RisingEdge(dut.clk)
            await ReadOnly()
            count += 1
            cur_sync = int(dut.dbg_sync.value)
            if cur_sync == 1 and prev_sync == 0:
                break   # 立ち上がりエッジ検出
            prev_sync = cur_sync

        assert count == 8, (
            f"NOP サイクル {cycle_num + 1}: 期待 8 posedge, 実際 {count} posedge"
        )


# ---------------------------------------------------------------------------
# テスト 5: MEMR タイミング
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_memr_asserts_after_t1(dut):
    """MEMR は T1 中は LOW, T2-T3 の間に HIGH になる (DBIN アクティブ)"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    await wait_sync_rising(dut)

    # SYNC HIGH posedge 1: DBIN まだ立っていない
    assert dut.dbg_memr.value == 0, (
        f"SYNC HIGH 1発目: MEMR=0 を期待 (DBIN は T2 以降), 実際={int(dut.dbg_memr.value)}"
    )

    # 各 posedge の MEMR を収集
    samples = {"T1f1": None, "T2f2": None, "T2f1": None,
               "T3f2": None, "T3f1": None, "T4f2": None, "T4f1": None}
    for key in samples:
        await RisingEdge(dut.clk)
        await ReadOnly()
        samples[key] = int(dut.dbg_memr.value)

    # T2-T3 のどこかで MEMR=1 になること
    t2_t3_memr = [samples["T2f2"], samples["T2f1"], samples["T3f2"], samples["T3f1"]]
    assert any(v == 1 for v in t2_t3_memr), (
        f"T2-T3 の間に MEMR=1 が一度もない: {t2_t3_memr}"
    )

    # T4 では MEMR が降りていること (データは T3 でラッチ済み)
    t4_memr = [samples["T4f2"], samples["T4f1"]]
    assert any(v == 0 for v in t4_memr), (
        f"T4 中に MEMR=0 が一度もない: {t4_memr}"
    )


# ---------------------------------------------------------------------------
# pytest エントリポイント
# ---------------------------------------------------------------------------

def test_runner():
    from cocotb_tools.runner import get_runner

    runner = get_runner("verilator")
    runner.build(
        sources=VERILOG_SOURCES,
        hdl_toplevel="cpm_top",
        build_args=[
            "--timing",
            "--assert",
            "-Wall",
            "--Wno-UNUSED",
            "--Wno-UNDRIVEN",
            "--Wno-STMTDLY",
            "--Wno-WIDTHEXPAND",
            "--Wno-WIDTHTRUNC",
            # vm80a.v 固有の警告を抑制（サードパーティ RTL のため修正不可）
            "--Wno-DECLFILENAME",   # ファイル名とモジュール名の不一致 (vm80a_core)
            "--Wno-PINCONNECTEMPTY",# 空ピン接続 (pin_aena, pin_dena)
            "--Wno-VARHIDDEN",      # 上位スコープの変数を隠す宣言 (i, c)
            "--Wno-SYMRSVDWORD",    # C++ キーワードと競合するシグナル名 (goto)
            "--Wno-SYNCASYNCNET",   # 同期/非同期の両方で使われる信号 (reset)
            "--Wno-UNOPTFLAT",      # 循環組み合わせ論理 (c)
            "--public",             # /* verilator public */ シグナルへのアクセスを有効化
            "--x-assign", "0",      # 未初期化値を 0 に設定 → RAM = 0x00 (NOP ストリーム)
        ],
        always=True,
    )
    runner.test(
        hdl_toplevel="cpm_top",
        test_module="test_8080_timing",
    )
