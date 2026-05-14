"""traffic_fsm.v のユニットテスト

タイミングパラメータを小さく設定してシミュレーションを高速化する。
"""
from pathlib import Path
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, ClockCycles

VERILOG_SOURCES = [
    Path(__file__).parents[3] / "examples" / "02-traffic-fsm" / "verilog" / "traffic_fsm.v"
]

# テスト用に短縮したタイミング
GREEN_TIME  = 8
YELLOW_TIME = 4
RED_TIME    = 6
WALK_TIME   = 5

S_GREEN  = 0
S_YELLOW = 1
S_RED    = 2
S_WALK   = 3


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def do_reset(dut, cycles: int = 2) -> None:
    dut.btn.value = 0
    dut.rst.value = 1
    await ClockCycles(dut.clk, cycles)
    dut.rst.value = 0
    await RisingEdge(dut.clk)


async def wait_state(dut, target_state: int, timeout: int = 200) -> None:
    for _ in range(timeout):
        await RisingEdge(dut.clk)
        if dut.o_state.value == target_state:
            return
    raise AssertionError(f"state {target_state} にタイムアウト ({timeout} clk)")


# ---------------------------------------------------------------------------
# cocotb tests
# ---------------------------------------------------------------------------

@cocotb.test()
async def test_reset_state(dut):
    """リセット直後は GREEN ステート"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    assert dut.o_state.value == S_GREEN
    assert dut.green.value == 1
    assert dut.red.value   == 0


@cocotb.test()
async def test_green_to_yellow(dut):
    """GREEN_TIME クロック後に YELLOW へ遷移する"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    # GREEN_TIME クロック待つ（タイマーが 0 になるクロックを含む）
    await ClockCycles(dut.clk, GREEN_TIME)
    assert dut.o_state.value == S_YELLOW, \
        f"YELLOW 遷移失敗: state={dut.o_state.value}"
    assert dut.yellow.value == 1


@cocotb.test()
async def test_yellow_to_red_without_button(dut):
    """ボタン未押下なら YELLOW → RED"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    await wait_state(dut, S_YELLOW)
    await ClockCycles(dut.clk, YELLOW_TIME)
    assert dut.o_state.value == S_RED, \
        f"RED 遷移失敗: state={dut.o_state.value}"
    assert dut.red.value == 1


@cocotb.test()
async def test_walk_on_button(dut):
    """GREEN 中にボタンを押すと YELLOW 後に WALK へ遷移する"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    # GREEN 中にボタン押下
    await ClockCycles(dut.clk, 2)
    dut.btn.value = 1
    await RisingEdge(dut.clk)
    dut.btn.value = 0

    await wait_state(dut, S_YELLOW)
    await ClockCycles(dut.clk, YELLOW_TIME)
    assert dut.o_state.value == S_WALK, \
        f"WALK 遷移失敗: state={dut.o_state.value}"
    assert dut.walk.value == 1
    assert dut.red.value  == 1


@cocotb.test()
async def test_full_cycle(dut):
    """GREEN → YELLOW → RED → GREEN の 1 周回"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)

    await wait_state(dut, S_YELLOW)
    await wait_state(dut, S_RED)
    await wait_state(dut, S_GREEN)
    assert dut.green.value == 1


@cocotb.test()
async def test_reset_from_mid_state(dut):
    """YELLOW ステート中にリセットすると GREEN に戻る"""
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())
    await do_reset(dut)
    await wait_state(dut, S_YELLOW)

    dut.rst.value = 1
    await RisingEdge(dut.clk)
    dut.rst.value = 0
    await RisingEdge(dut.clk)
    assert dut.o_state.value == S_GREEN


# ---------------------------------------------------------------------------
# pytest entry point
# ---------------------------------------------------------------------------

def test_runner():
    from cocotb_tools.runner import get_runner

    runner = get_runner("verilator")
    runner.build(
        sources=VERILOG_SOURCES,
        hdl_toplevel="traffic_fsm",
        parameters={
            "GREEN_TIME":  GREEN_TIME,
            "YELLOW_TIME": YELLOW_TIME,
            "RED_TIME":    RED_TIME,
            "WALK_TIME":   WALK_TIME,
        },
        build_args=["--timing", "--assert", "-Wall", "--Wno-UNUSED"],
        always=True,
    )
    runner.test(
        hdl_toplevel="traffic_fsm",
        test_module="test_traffic_fsm",
    )
