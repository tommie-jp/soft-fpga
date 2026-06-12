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
//   --v6-script <file>      Unix V6 を起動しスクリプト（wait/send/expect）を流す
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
#include <vector>
#include <string>
#include <cctype>

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

// ── --v6-script 用の状態 ──────────────────────────────────────────────────
// wait/expect でマッチ対象とするキャプチャバッファ内オフセット。
static int   g_sc_mark = 0;

static void capture_putc(char c) {
    // バッファが満杯に近づいたら後半を残してコンパクト化（長いブート/コンパイル出力対策）。
    if (g_capture_len >= (int)sizeof(g_capture_buf) - 2) {
        int keep  = (int)sizeof(g_capture_buf) / 2;
        int shift = g_capture_len - keep;
        memmove(g_capture_buf, g_capture_buf + shift, keep);
        g_capture_len = keep;
        g_sc_mark = (g_sc_mark > shift) ? (g_sc_mark - shift) : 0;
    }
    g_capture_buf[g_capture_len++] = c;
}

// ── --v6-script: スクリプト駆動の V6 自動テスト ──────────────────────────
// 1 行 1 ディレクティブ:
//   wait <文字列>     その文字列が出力に現れるまで待つ（タイムアウトで FAIL せず進む）
//   expect <文字列>   その文字列が現れるまで待つ。タイムアウトしたら FAIL
//   send <文字列>     文字列をコンソールへ送る（\r \n \t \\ \e \NNN(8進) \xHH 対応）
//   timeout <cycles>  以降の wait/expect のタイムアウト（クロック数）を変更
//   # ...             コメント / 空行は無視
enum ScType { SC_WAIT, SC_EXPECT, SC_SEND, SC_TIMEOUT };
struct ScCmd { ScType type; std::string arg; };

static std::vector<ScCmd> g_script;
static bool     g_v6_script   = false;
static size_t   g_sc_idx      = 0;        // 現在のコマンド
static size_t   g_sc_send_pos = 0;        // SEND の送信位置
static uint64_t g_sc_char_next= 0;        // SEND のペーシング
static uint64_t g_sc_deadline = 0;        // wait/expect のタイムアウト時刻
static uint64_t g_sc_settle   = 0;        // マッチ後に送信を始めるまでの待ち時刻
static uint64_t g_sc_timeout  = 80000000; // wait/expect 既定タイムアウト（クロック）
static int      g_sc_failed   = 0;
static const uint64_t SC_CHAR_GAP = 9000;    // 送信 1 文字あたりの間隔（UART RX 余裕）
static const uint64_t SC_SETTLE   = 400000;  // プロンプト検出後、送信開始までの落ち着き

// エスケープ展開（send / wait / expect の引数）
static std::string sc_unescape(const char* s) {
    std::string out;
    for (const char* p = s; *p; p++) {
        if (*p != '\\') { out.push_back(*p); continue; }
        p++;
        switch (*p) {
            case 'r': out.push_back('\r'); break;
            case 'n': out.push_back('\n'); break;
            case 't': out.push_back('\t'); break;
            case 'e': out.push_back('\033'); break;
            case '\\': out.push_back('\\'); break;
            case '0': case '1': case '2': case '3':
            case '4': case '5': case '6': case '7': {
                int v = 0, k = 0;
                while (k < 3 && *p >= '0' && *p <= '7') { v = v*8 + (*p - '0'); p++; k++; }
                p--; out.push_back((char)v); break;
            }
            case 'x': {
                p++; int v = 0, k = 0;
                while (k < 2 && isxdigit((unsigned char)*p)) {
                    char c = *p; int d = (c<='9')?c-'0':(tolower(c)-'a'+10);
                    v = v*16 + d; p++; k++;
                }
                p--; out.push_back((char)v); break;
            }
            case '\0': p--; break;   // 行末の \ はそのまま終了
            default: out.push_back(*p); break;
        }
    }
    return out;
}

// スクリプトファイルを読み込んで g_script に積む。成功なら true。
static bool sc_parse(const char* file);

// wasm_uart.v TX から呼ばれる: 文字を TTY 専用 fd へ出力
// ── DPI 実装 ─────────────────────────────────────────────────────────────

extern "C" void dpi_tty_putc(int ch) {
    char c = (char)(ch & 0x7F);
    { ssize_t r = write(g_tty_fd, &c, 1); (void)r; }
    if (g_capture_mode) capture_putc(c);
}

// wasm_uart.v RX から毎クロック呼ばれる: 入力文字を返す（なければ -1）
extern "C" int dpi_tty_getc() {
    // ── --v6-script モード: スクリプトに従って入力を生成する ──
    if (g_v6_script) {
        if (g_sc_idx >= g_script.size()) return -1;   // 完了（main 側でループ終了）
        ScCmd& c = g_script[g_sc_idx];

        if (c.type == SC_TIMEOUT) {
            g_sc_timeout = strtoull(c.arg.c_str(), nullptr, 10);
            g_sc_idx++; return -1;
        }
        if (c.type == SC_SEND) {
            if (g_sc_send_pos >= c.arg.size()) {       // 送信完了 → 次へ
                g_sc_idx++; g_sc_send_pos = 0; g_sc_mark = g_capture_len;
                g_sc_deadline = 0;
                return -1;
            }
            if (sim_time < g_sc_char_next) return -1;  // ペーシング（UART RX ガード合わせ）
            g_sc_char_next = sim_time + SC_CHAR_GAP;
            return (unsigned char)c.arg[g_sc_send_pos++];
        }
        // SC_WAIT / SC_EXPECT
        if (g_sc_deadline == 0) g_sc_deadline = sim_time + g_sc_timeout;
        g_capture_buf[g_capture_len] = '\0';
        // NUL バイトを含む出力でも 'Z' 等を見つけられるよう memmem を使う
        if (memmem(g_capture_buf + g_sc_mark, g_capture_len - g_sc_mark,
                   c.arg.c_str(), c.arg.size())) {   // マッチ
            // V6 のプロンプト印字直後は getty/sh が入力待ちに入る前なので少し待つ
            if (g_sc_settle == 0) g_sc_settle = sim_time + SC_SETTLE;
            if (sim_time < g_sc_settle) return -1;
            g_sc_settle = 0;
            g_sc_idx++; g_sc_send_pos = 0; g_sc_mark = g_capture_len; g_sc_deadline = 0;
            return -1;
        }
        if (sim_time >= g_sc_deadline) {               // タイムアウト
            tty_msg("\r\n[v6-script] TIMEOUT (#%zu) %s: %s\r\n",
                    g_sc_idx + 1, (c.type == SC_EXPECT) ? "expect" : "wait", c.arg.c_str());
            if (c.type == SC_EXPECT) g_sc_failed = 1;
            g_stop = 1;
        }
        return -1;
    }

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

// ── テストモード: --rom-test ──────────────────────────────────────────────
// ROM テスト: 任意の開始 PC でコードを実行し、UART 出力に期待文字列が現れたら PASS。
// HALT（RAM テスト失敗）またはタイムアウトで FAIL。
// 使い方: pdp11_sim --rom-test <mem_file> <start_pc_octal>
static int run_rom_test(VerilatedContext* ctx, const char* mem_file, uint32_t start_pc) {
    tty_msg("[pdp11] rom-test: %s  pc=%06o\r\n", mem_file, start_pc);
    ram_clear();
    int words = ram_load_mem(mem_file);
    if (words < 0) {
        tty_msg("[pdp11] ERROR: cannot load %s\r\n", mem_file);
        return 1;
    }
    tty_msg("[pdp11] loaded %d words\r\n", words);

    SIM_INITIAL_PC   = start_pc;
    g_capture_mode   = true;
    g_capture_len    = 0;
    do_reset();

    const uint64_t TIMEOUT    = 100000000ULL;
    const char*    EXPECT_STR = "Hello world!";
    for (uint64_t i = 0; i < TIMEOUT && !g_stop; i++) {
        tick();
        g_capture_buf[g_capture_len] = '\0';
        if (strstr(g_capture_buf, EXPECT_STR)) {
            tty_msg("\r\n[pdp11] found \"%s\"  t=%llu\r\n",
                    EXPECT_STR, (unsigned long long)sim_time);
            tty_msg("[pdp11] PASS\r\n");
            return 0;
        }
        if (SIM_HALTED) {
            tty_msg("\r\n[pdp11] HALT at pc=%06o  t=%llu\r\n",
                    (unsigned)SIM_PC, (unsigned long long)sim_time);
            tty_msg("[pdp11] FAIL\r\n");
            return 1;
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

// ── テストモード: --v6-script ─────────────────────────────────────────────
static bool sc_parse(const char* file) {
    FILE* f = fopen(file, "r");
    if (!f) { tty_msg("[v6-script] cannot open %s\r\n", file); return false; }
    char line[2048];
    int lineno = 0;
    while (fgets(line, sizeof(line), f)) {
        lineno++;
        size_t n = strlen(line);
        while (n && (line[n-1] == '\n' || line[n-1] == '\r')) line[--n] = 0;
        char* p = line;
        while (*p == ' ' || *p == '\t') p++;
        if (*p == 0 || *p == '#') continue;
        if      (strncmp(p, "wait ",    5) == 0) g_script.push_back({SC_WAIT,   sc_unescape(p + 5)});
        else if (strncmp(p, "expect ",  7) == 0) g_script.push_back({SC_EXPECT, sc_unescape(p + 7)});
        else if (strncmp(p, "send ",    5) == 0) g_script.push_back({SC_SEND,   sc_unescape(p + 5)});
        else if (strncmp(p, "timeout ", 8) == 0) g_script.push_back({SC_TIMEOUT, std::string(p + 8)});
        else { tty_msg("[v6-script] %s:%d unknown directive: %s\r\n", file, lineno, p); fclose(f); return false; }
    }
    fclose(f);
    if (g_script.empty()) { tty_msg("[v6-script] empty script: %s\r\n", file); return false; }
    return true;
}

// Unix V6 をブートし、スクリプトのシナリオを流して PASS/FAIL を返す。
static int run_v6_script(VerilatedContext* ctx, const char* script_file) {
    if (!sc_parse(script_file)) return 2;
    g_v6_script    = true;
    g_capture_mode = true;
    g_capture_len  = 0;
    g_sc_mark      = 0;
    do_reset();
    tty_msg("[v6-script] %s — %zu directives\r\n", script_file, g_script.size());

    const uint64_t LIMIT = 4000000000ULL;   // 全体の安全上限（約 4B クロック）
    for (uint64_t i = 0; i < LIMIT && !g_stop && !ctx->gotFinish(); i++) {
        tick();
        if (g_sc_idx >= g_script.size()) break;   // 全ディレクティブ消化
    }

    bool all_done = (g_sc_idx >= g_script.size());
    if (g_sc_failed || !all_done) {
        tty_msg("\r\n[v6-script] FAIL (%zu/%zu directives, t=%llu)\r\n",
                g_sc_idx, g_script.size(), (unsigned long long)sim_time);
        return 1;
    }
    tty_msg("\r\n[v6-script] PASS (%zu directives, t=%llu)\r\n",
            g_script.size(), (unsigned long long)sim_time);
    return 0;
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
    enum Mode { MODE_INTERACTIVE, MODE_RUN_TEST, MODE_DIAG, MODE_ROM_TEST,
                MODE_V6_SCRIPT } mode = MODE_INTERACTIVE;
    const char* mode_arg  = nullptr;
    const char* mode_arg2 = nullptr;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--run-test") == 0 && i + 1 < argc) {
            mode = MODE_RUN_TEST;
            mode_arg = argv[++i];
        } else if (strcmp(argv[i], "--diag") == 0 && i + 1 < argc) {
            mode = MODE_DIAG;
            mode_arg = argv[++i];
        } else if (strcmp(argv[i], "--rom-test") == 0 && i + 2 < argc) {
            mode     = MODE_ROM_TEST;
            mode_arg  = argv[++i];
            mode_arg2 = argv[++i];
        } else if (strcmp(argv[i], "--v6-script") == 0 && i + 1 < argc) {
            mode = MODE_V6_SCRIPT;
            mode_arg = argv[++i];
        }
    }

    VerilatedContext* ctx = new VerilatedContext;
    ctx->commandArgs(argc, argv);

    // ディスクイメージ（V6 を起動するモードで必要; .mem/diag テストでは不要）
    if (mode == MODE_INTERACTIVE || mode == MODE_V6_SCRIPT) {
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
        else if (mode == MODE_ROM_TEST)
            ret = run_rom_test(ctx, mode_arg,
                               (uint32_t)strtol(mode_arg2, nullptr, 8));
        else if (mode == MODE_V6_SCRIPT)
            ret = run_v6_script(ctx, mode_arg);
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
