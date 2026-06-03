// main_linux.cpp
// PDP-11 / Unix V6 ネイティブ Linux シミュレーションフロントエンド
// Verilator 5.x API を使用。Brad Parker test.cpp の v__DOT__ アクセスを置き換え。

#include "Vtest_top.h"
#include "Vtest_top___024root.h"
#include "verilated.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <csignal>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>

// シグナルアクセスマクロ（public_flat_rw で公開済み）
#define SIM_SYSCLK  (top->rootp->test_top__DOT__sysclk)
#define SIM_BUTTON  (top->rootp->test_top__DOT__button)

static Vtest_top* top;
static uint64_t   sim_time = 0;
static volatile int g_stop = 0;

// ── ターミナル raw モード ────────────────────────────────────────────────
static struct termios g_saved_tty;

static void tty_raw() {
    struct termios t;
    tcgetattr(STDIN_FILENO, &g_saved_tty);
    t = g_saved_tty;
    cfmakeraw(&t);
    tcsetattr(STDIN_FILENO, TCSANOW, &t);
}

static void tty_restore() {
    tcsetattr(STDIN_FILENO, TCSANOW, &g_saved_tty);
}

static void on_sigint(int) { g_stop = 1; }

// ── クロック 1 サイクル ──────────────────────────────────────────────────
static void tick() {
    SIM_SYSCLK = 1;
    top->eval();
    SIM_SYSCLK = 0;
    top->eval();
    sim_time++;
}

// ── リセットシーケンス ──────────────────────────────────────────────────
// reset_btn.v は button[3] の立ち上がりを検出してリセット信号を生成する。
// ここではボタン [3] を一定サイクルアサートしてリセットを掛ける。
static void do_reset() {
    SIM_BUTTON = 0;
    SIM_SYSCLK = 0;
    top->eval();

    // ボタン押下（reset アサート）
    SIM_BUTTON = (1 << 3);
    for (int i = 0; i < 64; i++) tick();

    // ボタン解放（reset 解除）
    SIM_BUTTON = 0;
    for (int i = 0; i < 64; i++) tick();

    fprintf(stderr, "[pdp11] reset complete at t=%llu\n", (unsigned long long)sim_time);
}

// ── メインループ ─────────────────────────────────────────────────────────
int main(int argc, char** argv) {
    setbuf(stdout, NULL);  // $display 出力を即 flush
    VerilatedContext* ctx = new VerilatedContext;
    ctx->commandArgs(argc, argv);

    // ディスクイメージは IDEIMAGE 環境変数で指定（ide.cpp 内の do_ide_setup 参照）
    // 例: IDEIMAGE=disk/unixv6.rk ./pdp11_sim
    if (!getenv("IDEIMAGE")) {
        // デフォルト: rk.dsk（ide.cpp のデフォルト名）
        // チェックだけして警告を出す
        if (access("rk.dsk", R_OK) != 0 && access("disk/unixv6.rk", R_OK) == 0)
            setenv("IDEIMAGE", "disk/unixv6.rk", 0);
    }
    if (getenv("IDEIMAGE"))
        fprintf(stderr, "[pdp11] disk image: %s\n", getenv("IDEIMAGE"));

    top = new Vtest_top(ctx);

    signal(SIGINT, on_sigint);
    tty_raw();
    atexit(tty_restore);

    // リセット
    do_reset();

    fprintf(stderr, "[pdp11] running... (Ctrl-C to quit)\n");

    // ノンブロッキング stdin
    int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
    fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);

    // PC 検出用の静的変数
    static bool reached_mem_printf_inner = false;
    static uint64_t bus_error_count_inner = 0;
    static uint64_t last_be_report = 0;

    // ── シミュレーションループ ─────────────────────────────────────────
    while (!g_stop && !ctx->gotFinish()) {
        // 1 バッチ = 500000 クロック進める（各クロックで PC を監視）
        for (int i = 0; i < 500000 && !g_stop; i++) {
            tick();
            uint16_t pc = top->rootp->test_top__DOT__top__DOT__pc;
            if (!reached_mem_printf_inner && pc == 004014) {
                reached_mem_printf_inner = true;
                fprintf(stderr, "[pdp11] *** REACHED printf(mem=) t=%llu ***\n",
                        (unsigned long long)sim_time);
            }
            if (pc == 0320) {
                bus_error_count_inner++;
                if (bus_error_count_inner - last_be_report >= 1000) {
                    fprintf(stderr, "[pdp11] bus_err_handler count=%llu t=%llu M\n",
                            (unsigned long long)bus_error_count_inner,
                            (unsigned long long)(sim_time/1000000ULL));
                    last_be_report = bus_error_count_inner;
                }
            }
            // RTT at 1866 (=0o3512), MMR0 write region (1852-1856), 0o170000 の到達検出
            static bool reached_rtt = false;
            static bool reached_170000 = false;
            static uint64_t visit_3512 = 0;
            // 1760-1870 の範囲の PC を全て記録（最初の 30M サイクル）= va 0o3340-0o3516
            if (sim_time < 30000000ULL && pc >= 1760 && pc <= 1870) {
                static uint16_t last_pc_range = 0;
                if (pc != last_pc_range) {
                    fprintf(stderr, "[pdp11] PC_RANGE t=%llu pc=0o%o\n",
                            (unsigned long long)sim_time, pc);
                    last_pc_range = pc;
                }
            }
            if (pc == 03512) { // RTT at 1866
                visit_3512++;
                if (!reached_rtt && visit_3512 == 1) {
                    reached_rtt = true;
                    fprintf(stderr, "[pdp11] *** REACHED RTT at va=0o3512(1866) t=%llu M ***\n",
                            (unsigned long long)(sim_time/1000000ULL));
                }
            }
            if (!reached_170000 && pc == 0170000) {
                reached_170000 = true;
                fprintf(stderr, "[pdp11] *** REACHED va=0o170000 at t=%llu M ***\n",
                        (unsigned long long)(sim_time/1000000ULL));
            }
        }

        // 進捗表示（10M クロックごと）
        if (sim_time % 10000000ULL < 500000) {
            uint16_t pc_val = top->rootp->test_top__DOT__top__DOT__pc;
            fprintf(stderr, "[pdp11] t=%llu M, PC=0%06o\n",
                    (unsigned long long)(sim_time / 1000000ULL), pc_val);
        }
        // va=0o4014 (printf "mem = ") と va=0o320 (bus error handler) への到達検出
        {
            static bool reached_mem_printf = false;
            static uint64_t bus_error_count = 0;
            static uint64_t last_bus_error_report = 0;
            uint16_t pc = top->rootp->test_top__DOT__top__DOT__pc;
            if (!reached_mem_printf && pc == 004014) {
                reached_mem_printf = true;
                fprintf(stderr, "[pdp11] *** REACHED printf(mem=) at PC=0%06o, t=%llu M cycles ***\n",
                        pc, (unsigned long long)(sim_time / 1000000ULL));
            }
            if (pc == 0320) {
                bus_error_count++;
                if (bus_error_count - last_bus_error_report >= 10000) {
                    fprintf(stderr, "[pdp11] bus error handler entered %llu times at t=%llu M\n",
                            (unsigned long long)bus_error_count,
                            (unsigned long long)(sim_time / 1000000ULL));
                    last_bus_error_report = bus_error_count;
                }
            }
        }
    }

    top->final();
    uint16_t final_pc = top->rootp->test_top__DOT__top__DOT__pc;
    fprintf(stderr, "[pdp11] done at t=%llu cycles, final PC=0%06o\n",
            (unsigned long long)sim_time, final_pc);
    delete top;
    delete ctx;
    return 0;
}
