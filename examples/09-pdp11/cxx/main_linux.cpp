// main_linux.cpp — PDP-11 / Unix V6 インタラクティブ Linux フロントエンド
//
// test_top_wasm.v + wasm_uart.v（DPI）を使用する。
// dpi_tty_putc → g_tty_fd（元 stdout）へ出力
// dpi_tty_getc → 8M クロック後に "rkunix\r" 自動送信、その後 stdin ポーリング
// 終了: 行頭で ~. (ssh/tip/cu 方式)、または外部 SIGINT
//
// テストモード:
//   --run-test <file.mem>   .mem をロードして HALT まで実行（基本命令テスト）
//   --diag <name>           MAINDEC 診断プログラムを実行
//
#include "Vtest_top_wasm.h"
#include "Vtest_top_wasm___024root.h"
#include "verilated.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <csignal>
#include <cstdarg>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>

// ── シグナルアクセスマクロ ─────────────────────────────────────────────────
#define SIM_SYSCLK      (top->rootp->test_top_wasm__DOT__sysclk)
#define SIM_BUTTON      (top->rootp->test_top_wasm__DOT__button)
#define SIM_HALTED      (top->rootp->test_top_wasm__DOT__obs_halted)
#define SIM_PC          (top->rootp->test_top_wasm__DOT__obs_pc)
#define SIM_INITIAL_PC  (top->rootp->test_top_wasm__DOT__top__DOT__initial_pc)

static Vtest_top_wasm* top      = nullptr;
static uint64_t        sim_time = 0;
static volatile int    g_stop   = 0;
// Verilator の $display は printf()/stdout 経由。main() で stdout を stderr に
// リダイレクトし、TTY 出力専用の fd (g_tty_fd) を別途確保する。
static int             g_tty_fd = STDOUT_FILENO;

// ── ユーザー向けメッセージ（g_tty_fd = 元 stdout に書く） ────────────────
// stderr は 2>/dev/null で捨てられるため、表示したいメッセージはここを使う。
static void tty_msg(const char* fmt, ...) {
    char buf[256];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    if (n > 0) { ssize_t r = write(g_tty_fd, buf, (size_t)n); (void)r; }
}

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

// ── ~. エスケープ状態機械（ssh/tip/cu 方式） ─────────────────────────────
// 行頭（改行直後）で ~ → . と入力するとシミュレーターを終了する。
// ~~ → ~ を 1 文字送信（エスケープ doubling）。
// ~X（その他）→ ~ + X をそのまま送信。

enum TtyState { ST_NORMAL, ST_AFTER_NL, ST_AFTER_TILDE };
static TtyState tty_st      = ST_AFTER_NL;  // 起動直後は行頭扱い
static int      tty_pending = -1;           // 保留文字（~ の後を送るため）

// ── テストモード TTY キャプチャ ──────────────────────────────────────────
// --diag モードでは UART 出力を captute_buf に蓄積して FAIL 検出に使う
static bool  g_capture_mode = false;
static char  g_capture_buf[65536];
static int   g_capture_len = 0;

static void capture_putc(char c) {
    if (g_capture_len < (int)sizeof(g_capture_buf) - 1)
        g_capture_buf[g_capture_len++] = c;
}

// ── DPI 実装 ─────────────────────────────────────────────────────────────

// wasm_uart.v TX から呼ばれる: 文字を TTY 専用 fd へ出力
extern "C" void dpi_tty_putc(int ch) {
    char c = (char)(ch & 0x7F);
    { ssize_t r = write(g_tty_fd, &c, 1); (void)r; }
    if (g_capture_mode) capture_putc(c);
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

    // 保留文字を先に返す（~ の後の文字を 1 クロック遅れで送る）
    if (tty_pending >= 0) {
        int c = tty_pending;
        tty_pending = -1;
        return c;
    }

    // stdin ノンブロッキング読み取り
    char c;
    if (read(STDIN_FILENO, &c, 1) <= 0) return -1;
    unsigned char uc = (unsigned char)c;

    // ~. エスケープ状態機械
    switch (tty_st) {
    case ST_AFTER_NL:
        if (uc == '~') { tty_st = ST_AFTER_TILDE; return -1; }  // ~ を保留
        tty_st = (uc == '\r' || uc == '\n') ? ST_AFTER_NL : ST_NORMAL;
        return uc;

    case ST_AFTER_TILDE:
        if (uc == '.') { g_stop = 1; return -1; }              // ~. → 終了
        if (uc == '~') { tty_st = ST_AFTER_NL; return '~'; }  // ~~ → ~ を送る
        // ~X → ~ を送り、X を次クロックで返す
        tty_pending = uc;
        tty_st = (uc == '\r' || uc == '\n') ? ST_AFTER_NL : ST_NORMAL;
        return '~';

    default:  // ST_NORMAL
        if (uc == '\r' || uc == '\n') tty_st = ST_AFTER_NL;
        return uc;
    }
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

// ── RAM ロード ────────────────────────────────────────────────────────────
extern "C" void ram_clear(void);
extern "C" int  ram_load_mem(const char *filename);

// ── テストモード: --run-test ──────────────────────────────────────────────
// .mem ファイルをロードし、initial_pc=0500 でリセット後 HALT を待つ。
// HALT 検出で exit 0、タイムアウトで exit 1。
static int run_test(VerilatedContext* ctx, const char* mem_file) {
    tty_msg("[pdp11] run-test: %s\r\n", mem_file);
    ram_clear();
    int words = ram_load_mem(mem_file);
    if (words < 0) {
        tty_msg("[pdp11] ERROR: cannot load %s\r\n", mem_file);
        return 1;
    }
    tty_msg("[pdp11] loaded %d words\r\n", words);

    // PC=0500 (octal) = 0x140 でリセット
    SIM_INITIAL_PC = 0x140u;
    do_reset();

    const uint64_t TIMEOUT = 50000000ULL;
    for (uint64_t i = 0; i < TIMEOUT && !g_stop; i++) {
        tick();
        if (SIM_HALTED) {
            tty_msg("\r\n[pdp11] HALT at pc=%06o  t=%llu\r\n",
                    (unsigned)SIM_PC, (unsigned long long)sim_time);
            tty_msg("[pdp11] PASS\r\n");
            return 0;
        }
    }
    tty_msg("\r\n[pdp11] TIMEOUT after %llu cycles\r\n",
            (unsigned long long)sim_time);
    tty_msg("[pdp11] FAIL\r\n");
    return 1;
}

// ── テストモード: --diag ──────────────────────────────────────────────────
// MAINDEC 診断プログラムをロードし、initial_pc=0200 で実行する。
// UART 出力を表示し、HALT または タイムアウトで終了する。
static int run_diag(VerilatedContext* ctx, const char* diag_name) {
    // パス解決: vendor/tests/diags/<name>.mem
    char mem_path[512];
    // まず絶対パス・相対パスとして試す
    if (access(diag_name, R_OK) == 0) {
        snprintf(mem_path, sizeof(mem_path), "%s", diag_name);
    } else {
        // スクリプト実行ディレクトリからの相対パス
        snprintf(mem_path, sizeof(mem_path),
                 "vendor/cpus-pdp11/tests/diags/%s.mem", diag_name);
        if (access(mem_path, R_OK) != 0) {
            tty_msg("[pdp11] ERROR: cannot find diag '%s'\r\n"
                    "  tried: %s\r\n", diag_name, mem_path);
            return 1;
        }
    }

    tty_msg("[pdp11] diag: %s\r\n", mem_path);
    ram_clear();
    int words = ram_load_mem(mem_path);
    if (words < 0) {
        tty_msg("[pdp11] ERROR: cannot load %s\r\n", mem_path);
        return 1;
    }
    tty_msg("[pdp11] loaded %d words\r\n", words);

    // MAINDEC は PC=0200 (octal) = 0x80 から開始
    SIM_INITIAL_PC = 0x80u;
    g_capture_mode = true;
    g_capture_len  = 0;

    do_reset();
    tty_msg("[pdp11] running diag (~. to quit)...\r\n");

    // ディスクなし＆インタラクティブなしで実行
    // HALT でリスタートベクタ（addr 024 = 0x14）から再実行するループ
    const uint64_t TIMEOUT = 500000000ULL;  // 500M cycles
    int halt_count = 0;
    for (uint64_t i = 0; i < TIMEOUT && !g_stop; i++) {
        tick();
        if (SIM_HALTED && !ctx->gotFinish()) {
            halt_count++;
            tty_msg("\r\n[pdp11] HALT #%d at pc=%06o\r\n",
                    halt_count, (unsigned)SIM_PC);
            // 1回目の HALT で終了（診断完了）
            break;
        }
    }

    g_capture_buf[g_capture_len] = '\0';

    // FAIL 文字列の検出
    bool fail_found = (strstr(g_capture_buf, "FAIL") != nullptr ||
                       strstr(g_capture_buf, "fail") != nullptr ||
                       strstr(g_capture_buf, "ERR")  != nullptr);

    tty_msg("\r\n[pdp11] diag %s after %llu cycles\r\n",
            fail_found ? "FAIL" : "PASS",
            (unsigned long long)sim_time);
    return fail_found ? 1 : 0;
}

// ── main ─────────────────────────────────────────────────────────────────
int main(int argc, char** argv) {
    // Verilator の $display は printf() → stdout に出力される。
    // g_tty_fd に元の stdout を退避し、stdout を stderr にリダイレクトする。
    // これにより doPDP11-unix-v6.sh の 2>/dev/null で $display 出力が抑制できる。
    g_tty_fd = dup(STDOUT_FILENO);
    dup2(STDERR_FILENO, STDOUT_FILENO);  // stdout → stderr

    setbuf(stdout, NULL);

    // ── 引数解析 ─────────────────────────────────────────────────────────
    enum Mode { MODE_INTERACTIVE, MODE_RUN_TEST, MODE_DIAG } mode = MODE_INTERACTIVE;
    const char* mode_arg = nullptr;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--run-test") == 0 && i + 1 < argc) {
            mode = MODE_RUN_TEST;
            mode_arg = argv[++i];
        } else if (strcmp(argv[i], "--diag") == 0 && i + 1 < argc) {
            mode = MODE_DIAG;
            mode_arg = argv[++i];
        }
    }

    VerilatedContext* ctx = new VerilatedContext;
    ctx->commandArgs(argc, argv);

    // ディスクイメージ（テストモードでは不要）
    if (mode == MODE_INTERACTIVE) {
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
            tty_msg("[pdp11] ERROR: disk image not found.\n"
                    "  Set IDEIMAGE=<path> or run from repo root.\n");
            delete ctx;
            return 1;
        }
        tty_msg("[pdp11] disk: %s\r\n", disk);
    }

    top = new Vtest_top_wasm(ctx);

    signal(SIGINT, on_sigint);

    // テストモードは TTY raw 不要・stdin 不要
    if (mode != MODE_INTERACTIVE) {
        int ret = 0;
        if (mode == MODE_RUN_TEST)
            ret = run_test(ctx, mode_arg);
        else
            ret = run_diag(ctx, mode_arg);
        top->final();
        delete top;
        delete ctx;
        return ret;
    }

    // ── インタラクティブモード ────────────────────────────────────────────
    tty_raw();
    atexit(tty_restore);

    // stdin ノンブロッキング
    {
        int fl = fcntl(STDIN_FILENO, F_GETFL, 0);
        fcntl(STDIN_FILENO, F_SETFL, fl | O_NONBLOCK);
    }

    do_reset();
    tty_msg("[pdp11] running (~. to quit)...\r\n");

    while (!g_stop && !ctx->gotFinish()) {
        for (int i = 0; i < 500000 && !g_stop; i++) {
            tick();
            if (SIM_HALTED) {
                tty_msg("\r\n[pdp11] CPU halted at t=%llu\r\n",
                        (unsigned long long)sim_time);
                g_stop = 1;
                break;
            }
        }
    }

    top->final();
    tty_msg("\r\n[pdp11] done at t=%llu cycles\r\n",
            (unsigned long long)sim_time);
    delete top;
    delete ctx;
    return 0;
}
