"""counter.v のユニットテスト

pytest から test_runner() を呼ぶと cocotb が @cocotb.test() を全実行する。
"""
from pathlib import Path
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge

VERILOG_SOURCES = [
    Path(__file__).parents[3] / "examples" / "01-counter" / "verilog" / "counter.v"
]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def do_reset(dut, cycles: int = 2) -> None:
    dut.rst.value = 1
    for _ in range(cycles):
        await RisingEdge(dut.clk)
    dut.rst.value = 0
    await RisingEdge(dut.clk)


# ---------------------------------------------------------------------------
# cocotb tests
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_count_up(dut):
    """リセット後、1 クロックごとに +1 される"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    for expected in range(1, 16):
        await RisingEdge(dut.clk)
        assert dut.count.value == expected, \
            f"clk {expected}: expected {expected}, got {dut.count.value}"


@cocotb.test()
async def test_wrap_around(dut):
    """255 → 0 の wrap-around"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    for _ in range(255):
        await RisingEdge(dut.clk)
    assert dut.count.value == 255

    await RisingEdge(dut.clk)
    assert dut.count.value == 0, f"wrap-around 失敗: {dut.count.value}"


@cocotb.test()
async def test_reset_clears_count(dut):
    """カウント中にリセットすると 0 に戻り、その後 1 からカウントする"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    # 10 クロック進める
    for _ in range(10):
        await RisingEdge(dut.clk)

    # リセットをアサート
    dut.rst.value = 1
    await RisingEdge(dut.clk)
    await RisingEdge(dut.clk)  # 非同期リセット後の値を安定させる
    assert dut.count.value == 0, f"リセット後 count が 0 でない: {dut.count.value}"

    # リセット解除後、2 クロック目に count == 1
    # (do_reset パターンと同様、rst=0 直後の 1 クロック目はカウントされない)
    dut.rst.value = 0
    await RisingEdge(dut.clk)
    await RisingEdge(dut.clk)
    assert dut.count.value == 1, f"リセット解除後 count が 1 でない: {dut.count.value}"


# ---------------------------------------------------------------------------
# pytest entry point
# ---------------------------------------------------------------------------

def test_runner():
    from cocotb_tools.runner import get_runner

    runner = get_runner("verilator")
    runner.build(
        sources=VERILOG_SOURCES,
        hdl_toplevel="counter",
        build_args=["--timing", "--assert", "-Wall", "--Wno-UNUSED"],
        always=True,
    )
    runner.test(
        hdl_toplevel="counter",
        test_module="test_counter",
    )
