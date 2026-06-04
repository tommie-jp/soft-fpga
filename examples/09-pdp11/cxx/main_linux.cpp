// main_linux.cpp — PDP-11 / Unix V6 インタラクティブ Linux フロントエンド
//
// test_top_wasm.v + wasm_uart.v（DPI）を使用する。
// dpi_tty_putc → stdout 直接書き込み
// dpi_tty_getc → 8M クロック後に "rkunix\r" 自動送信、その後 stdin ポーリング
// Ctrl-C で終了（SIGINT）。
//
#include "Vtest_top_wasm.h"
#include "Vtest_top_wasm___024root.h"
#include "verilated.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <csignal>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>

// ── シグナルアクセスマクロ ─────────────────────────────────────────────────
#define SIM_SYSCLK  (top->rootp->test_top_wasm__DOT__sysclk)
#define SIM_BUTTON  (top->rootp->test_top_wasm__DOT__button)
#define SIM_HALTED  (top->rootp->test_top_wasm__DOT__obs_halted)

static Vtest_top_wasm* top      = nullptr;
static uint64_t        sim_time = 0;
static volatile int    g_stop   = 0;
// Verilator の $display は printf()/stdout 経由。main() で stdout を stderr に
// リダイレクトし、TTY 出力専用の fd (g_tty_fd) を別途確保する。
static int             g_tty_fd = STDOUT_FILENO;

// ── ターミナル raw モード ─────────────────────────────────────────────────
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

// ── 起動シーケンス（fake_uart.v の fake_v6_unix と同等） ─────────────────
// 8M クロック後に "rkunix\r" を 3000 クロック間隔で 1 文字ずつ送信する
static const char  BOOT_CMD[]    = "rkunix\r";
static const int   BOOT_LEN      = 7;
static uint64_t    boot_delay    = 8000000;
static int         boot_idx      = 0;
static uint64_t    boot_char_next = 0;

// ── DPI 実装 ─────────────────────────────────────────────────────────────

// wasm_uart.v TX から呼ばれる: 文字を TTY 専用 fd へ出力
extern "C" void dpi_tty_putc(int ch) {
    char c = (char)(ch & 0x7F);
    (void)write(g_tty_fd, &c, 1);
}

// wasm_uart.v RX から毎クロック呼ばれる: 入力文字を返す（なければ -1）
extern "C" int dpi_tty_getc() {
    // 起動遅延: bootrom の @ プロンプトが出るまで待つ
    if (boot_delay > 0) { boot_delay--; return -1; }

    // 起動コマンドを 3000 クロック間隔で 1 文字ずつ送信
    if (boot_idx < BOOT_LEN) {
        if (sim_time < boot_char_next) return -1;
        boot_char_next = sim_time + 3000;
        return (unsigned char)BOOT_CMD[boot_idx++];
    }

    // インタラクティブ入力（ノンブロッキング）
    char c;
    int n = read(STDIN_FILENO, &c, 1);
    return (n > 0) ? (unsigned char)c : -1;
}

// ── クロック / リセット ───────────────────────────────────────────────────
static inline void tick() {
    SIM_SYSCLK = 1; top->eval();
    SIM_SYSCLK = 0; top->eval();
    sim_time++;
}

static void do_reset() {
    SIM_BUTTON = 0; SIM_SYSCLK = 0; top->eval();
    SIM_BUTTON = (1 << 3);
    for (int i = 0; i < 64; i++) tick();
    SIM_BUTTON = 0;
    for (int i = 0; i < 64; i++) tick();
}

// ── main ─────────────────────────────────────────────────────────────────
int main(int argc, char** argv) {
    // Verilator の $display は printf() → stdout に出力される。
    // g_tty_fd に元の stdout を退避し、stdout を stderr にリダイレクトする。
    // これにより doPDP11-unix-v6.sh の 2>/dev/null で $display 出力が抑制できる。
    g_tty_fd = dup(STDOUT_FILENO);
    dup2(STDERR_FILENO, STDOUT_FILENO);  // stdout → stderr

    setbuf(stdout, NULL);

    VerilatedContext* ctx = new VerilatedContext;
    ctx->commandArgs(argc, argv);

    // ディスクイメージ探索
    if (!getenv("IDEIMAGE")) {
        const char* candidates[] = {
            "examples/09-pdp11/disk/unix_v6_rk05.dsk",
            "disk/unix_v6_rk05.dsk",
            "rk.dsk",
            nullptr
        };
        for (int i = 0; candidates[i]; i++) {
            if (access(candidates[i], R_OK) == 0) {
                setenv("IDEIMAGE", candidates[i], 0);
                break;
            }
        }
    }

    const char* disk = getenv("IDEIMAGE");
    if (!disk || access(disk, R_OK) != 0) {
        fprintf(stderr,
            "[pdp11] ERROR: disk image not found.\n"
            "  Set IDEIMAGE=<path> or run from repo root.\n");
        delete ctx;
        return 1;
    }
    fprintf(stderr, "[pdp11] disk: %s\n", disk);

    top = new Vtest_top_wasm(ctx);

    signal(SIGINT, on_sigint);
    tty_raw();
    atexit(tty_restore);

    // stdin ノンブロッキング
    {
        int fl = fcntl(STDIN_FILENO, F_GETFL, 0);
        fcntl(STDIN_FILENO, F_SETFL, fl | O_NONBLOCK);
    }

    do_reset();
    fprintf(stderr, "[pdp11] running (Ctrl-C to quit)...\r\n");

    while (!g_stop && !ctx->gotFinish()) {
        for (int i = 0; i < 500000 && !g_stop; i++) {
            tick();
            if (SIM_HALTED) {
                fprintf(stderr, "\r\n[pdp11] CPU halted at t=%llu\r\n",
                        (unsigned long long)sim_time);
                g_stop = 1;
                break;
            }
        }
    }

    top->final();
    fprintf(stderr, "\r\n[pdp11] done at t=%llu cycles\r\n",
            (unsigned long long)sim_time);
    delete top;
    delete ctx;
    return 0;
}
