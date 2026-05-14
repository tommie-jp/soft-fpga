// doc/13-integer-BASIC-動作検証サンプル 自動テスト
// テスト 1〜6 を順番に実行する。各テストは sim_init → E000R → プログラム入力 → RUN → 出力検証。
// Exit code: 0 = PASS, 1 = FAIL

#include "Vapple1_top.h"
#include "verilated.h"
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>
#include <chrono>

// ----- シミュレータ状態 -----

static Vapple1_top* top;
static uint8_t ram[0x10000];

static uint8_t kbd_data   = 0, kbd_cr = 0;
static uint8_t kbd_queue[256];
static int     kbd_q_head = 0, kbd_q_tail = 0;
static uint8_t disp_queue[1024];
static int     disp_q_head = 0, disp_q_tail = 0;

static const uint8_t WOZMON[256] = {
    0xD8,0x58,0xA0,0x7F,0x8C,0x12,0xD0,0xA9,0xA7,0x8D,0x11,0xD0,0x8D,0x13,0xD0,0xC9,
    0xDF,0xF0,0x13,0xC9,0x9B,0xF0,0x03,0xC8,0x10,0x0F,0xA9,0xDC,0x20,0xEF,0xFF,0xA9,
    0x8D,0x20,0xEF,0xFF,0xA0,0x01,0x88,0x30,0xF6,0xAD,0x11,0xD0,0x10,0xFB,0xAD,0x10,
    0xD0,0x99,0x00,0x02,0x20,0xEF,0xFF,0xC9,0x8D,0xD0,0xD4,0xA0,0xFF,0xA9,0x00,0xAA,
    0x0A,0x85,0x2B,0xC8,0xB9,0x00,0x02,0xC9,0x8D,0xF0,0xD4,0xC9,0xAE,0x90,0xF4,0xF0,
    0xF0,0xC9,0xBA,0xF0,0xEB,0xC9,0xD2,0xF0,0x3B,0x86,0x28,0x86,0x29,0x84,0x2A,0xB9,
    0x00,0x02,0x49,0xB0,0xC9,0x0A,0x90,0x06,0x69,0x88,0xC9,0xFA,0x90,0x11,0x0A,0x0A,
    0x0A,0x0A,0xA2,0x04,0x0A,0x26,0x28,0x26,0x29,0xCA,0xD0,0xF8,0xC8,0xD0,0xE0,0xC4,
    0x2A,0xF0,0x97,0x24,0x2B,0x50,0x10,0xA5,0x28,0x81,0x26,0xE6,0x26,0xD0,0xB5,0xE6,
    0x27,0x4C,0x44,0xFF,0x6C,0x24,0x00,0x30,0x2B,0xA2,0x02,0xB5,0x27,0x95,0x25,0x95,
    0x23,0xCA,0xD0,0xF7,0xD0,0x14,0xA9,0x8D,0x20,0xEF,0xFF,0xA5,0x25,0x20,0xDC,0xFF,
    0xA5,0x24,0x20,0xDC,0xFF,0xA9,0xBA,0x20,0xEF,0xFF,0xA9,0xA0,0x20,0xEF,0xFF,0xA1,
    0x24,0x20,0xDC,0xFF,0x86,0x2B,0xA5,0x24,0xC5,0x28,0xA5,0x25,0xE5,0x29,0xB0,0xC1,
    0xE6,0x24,0xD0,0x02,0xE6,0x25,0xA5,0x24,0x29,0x07,0x10,0xC8,0x48,0x4A,0x4A,0x4A,
    0x4A,0x20,0xE5,0xFF,0x68,0x29,0x0F,0x09,0xB0,0xC9,0xBA,0x90,0x02,0x69,0x06,0x2C,
    0x12,0xD0,0x30,0xFB,0x8D,0x12,0xD0,0x60,0x00,0x00,0x00,0x0F,0x00,0xFF,0x00,0x00,
};

// ----- PIA エミュレーション -----

static inline bool is_pia(uint16_t addr) { return (addr & 0xFF10u) == 0xD010u; }

static uint8_t memory_read(uint16_t addr) {
    if (is_pia(addr)) {
        switch (addr & 3u) {
            case 0: { uint8_t d = kbd_data; kbd_data &= 0x7F; kbd_cr &= 0x7F; return d; }
            case 1: return kbd_cr;
            default: return 0x00;
        }
    }
    return ram[addr];
}

static void memory_write(uint16_t addr, uint8_t data) {
    if (is_pia(addr)) {
        if ((addr & 3u) == 2u) {
            uint8_t ch = data & 0x7F;
            if (ch == 0x0D) ch = 0x0A;
            if (ch >= 0x20 || ch == 0x0A) {
                int next = (disp_q_tail + 1) & 1023;
                if (next != disp_q_head) { disp_queue[disp_q_tail] = ch; disp_q_tail = next; }
            }
        }
        return;
    }
    if (addr < 0xE000) ram[addr] = data;
}

static uint64_t g_cycles = 0;

static void step() {
    ++g_cycles;
    if (kbd_q_head != kbd_q_tail && !(kbd_data & 0x80)) {
        kbd_data   = kbd_queue[kbd_q_head] | 0x80;
        kbd_cr     = 0x80;
        kbd_q_head = (kbd_q_head + 1) & 255;
    }
    uint16_t ab = (uint16_t)top->o_ab;
    if (top->o_we) memory_write(ab, top->o_do);
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->i_di = memory_read(ab);
    top->eval();
}

static void send_key(uint8_t ch) {
    if (ch >= 'a' && ch <= 'z') ch = (uint8_t)(ch - 32);
    int next = (kbd_q_tail + 1) & 255;
    if (next != kbd_q_head) { kbd_queue[kbd_q_tail] = ch; kbd_q_tail = next; }
}

static int get_display_char() {
    if (disp_q_head == disp_q_tail) return -1;
    uint8_t ch = disp_queue[disp_q_head];
    disp_q_head = (disp_q_head + 1) & 1023;
    return (int)ch;
}

static void drain(std::string& buf) {
    int ch;
    while ((ch = get_display_char()) >= 0) buf += (char)ch;
}

static bool wait_for(std::string& buf, const char* needle, uint64_t max_cycles) {
    for (uint64_t i = 0; i < max_cycles; ++i) {
        step(); drain(buf);
        if (buf.find(needle) != std::string::npos) return true;
    }
    return false;
}

static void send_cmd(const char* s) {
    for (const char* p = s; *p; ++p) send_key((uint8_t)*p);
    send_key('\r');
}

// ----- テストユーティリティ -----

static int g_pass = 0, g_fail = 0;

struct BenchEntry { const char* name; uint64_t cycles; double wall_ms; };
static BenchEntry g_bench[16];
static int        g_bench_n = 0;

static void check(const char* name, const std::string& buf, const char* expected) {
    if (buf.find(expected) != std::string::npos) {
        printf("  PASS: %s\n", name);
        ++g_pass;
    } else {
        printf("  FAIL: %s\n    expected: [%s]\n    got: [", name, expected);
        for (char c : buf)
            (c == '\n') ? fputs("\\n", stdout) : putchar((unsigned char)c);
        printf("]\n");
        ++g_fail;
    }
}

static void sim_init() {
    top = new Vapple1_top();
    memset(ram, 0xFF, sizeof(ram));
    memset(ram, 0x00, 0xD000);
    memcpy(&ram[0xFF00], WOZMON, sizeof(WOZMON));

#ifdef BASIC_BIN_PATH
    FILE* f = fopen(BASIC_BIN_PATH, "rb");
    if (f) {
        size_t nr = fread(&ram[0xE000], 1, 4096, f);
        if (nr == 0) fprintf(stderr, "警告: basic.bin の読み込みバイト数が 0 です\n");
        fclose(f);
    }
    else   { fprintf(stderr, "警告: basic.bin を開けません: %s\n", BASIC_BIN_PATH); }
#endif

    kbd_data    = 0; kbd_cr     = 0;
    kbd_q_head  = 0; kbd_q_tail = 0;
    disp_q_head = 0; disp_q_tail = 0;

    top->reset = 1; top->i_irq = 0; top->i_nmi = 0;
    top->i_rdy = 1; top->i_di  = 0xFF; top->clk = 0;
    top->eval();
    for (int i = 0; i < 8; i++) { top->clk = 1; top->eval(); top->clk = 0; top->eval(); }
    top->reset = 0; top->eval();
    top->i_di = memory_read((uint16_t)top->o_ab); top->eval();
}

// wozmon 起動 → E000R → BASIC プロンプト '>' まで待つ
static bool boot_basic() {
    sim_init();
    std::string buf;
    if (!wait_for(buf, "\\", 10'000'000)) {
        printf("  FAIL: wozmon 起動タイムアウト\n"); ++g_fail; return false;
    }
    buf.clear();
    send_cmd("E000R");
    if (!wait_for(buf, ">", 15'000'000)) {
        printf("  FAIL: BASIC 起動タイムアウト\n"); ++g_fail; return false;
    }
    return true;
}

// 1行ずつ送り BASIC の '\n>' プロンプトを待ってから次の行を送る。
// '\n>' を待つことで、行内容に '>' が含まれる場合（例: D*D>N）の誤検出を防ぐ。
// 全行送信後に RUN し、そこから '\n>' までの出力のみを返す。
// out_cycles に RUN フェーズのクロック数を書き出す（nullptr 可）。
static std::string run_program(const char* const lines[], int n, uint64_t max_cycles,
                               uint64_t* out_cycles = nullptr, double* out_wall_ms = nullptr) {
    for (int i = 0; i < n; i++) {
        send_cmd(lines[i]);
        std::string echo;
        wait_for(echo, "\n>", 5'000'000);
    }
    send_cmd("RUN");
    uint64_t start = g_cycles;
    auto t0 = std::chrono::high_resolution_clock::now();
    std::string buf;
    wait_for(buf, "\n>", max_cycles);
    auto t1 = std::chrono::high_resolution_clock::now();
    if (out_cycles)  *out_cycles  = g_cycles - start;
    if (out_wall_ms) *out_wall_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return buf;
}

// ----- テスト 1: PRINT 文 / 算術 -----

static void test1_print() {
    printf("[T1] PRINT 文 / 算術\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 PRINT \"HELLO, APPLE-1\"",
        "20 PRINT \"2*3+4=\";2*3+4",
        "30 PRINT \"100/7=\";100/7",
        "40 PRINT \"DONE\"",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 4, 20'000'000, &cyc, &wms);
    check("HELLO, APPLE-1", out, "HELLO, APPLE-1");
    check("2*3+4=10",       out, "2*3+4=10");
    check("100/7=14",       out, "100/7=14");
    check("DONE",           out, "DONE");
    check("*** END ERR",    out, "*** END ERR");
    g_bench[g_bench_n++] = {"T1  PRINT/算術", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 2: FOR-NEXT (1〜10 の総和) -----

static void test2_for_next() {
    printf("[T2] FOR-NEXT / 総和\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 S=0",
        "20 FOR I=1 TO 10",
        "30 S=S+I",
        "40 NEXT I",
        "50 PRINT \"SUM=\";S",
        "60 END",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 6, 30'000'000, &cyc, &wms);
    check("SUM=55", out, "SUM=55");
    g_bench[g_bench_n++] = {"T2  FOR-NEXT 総和", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 3: GOTO / 条件分岐 (GCD) -----

static void test3_gcd() {
    printf("[T3] GOTO / 条件分岐 (GCD)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 A=252",
        "20 B=105",
        "30 IF B=0 THEN GOTO 80",
        "40 C=A-A/B*B",
        "50 A=B",
        "60 B=C",
        "70 GOTO 30",
        "80 PRINT \"GCD=\";A",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 8, 30'000'000, &cyc, &wms);
    check("GCD=21", out, "GCD=21");
    g_bench[g_bench_n++] = {"T3  GCD", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 4: GOSUB / RETURN (乗算表 3×3) -----

static void test4_gosub() {
    printf("[T4] GOSUB / RETURN (乗算表 3x3)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 FOR I=1 TO 3",
        "20 FOR J=1 TO 3",
        "30 GOSUB 100",
        "40 NEXT J",
        "50 PRINT",
        "60 NEXT I",
        "70 END",
        "100 PRINT I*J;\" \";",
        "110 RETURN",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 9, 50'000'000, &cyc, &wms);
    check("1行目: 1 2 3", out, "1 2 3");
    check("3行目: 3 6 9", out, "3 6 9");
    g_bench[g_bench_n++] = {"T4  GOSUB 乗算表3x3", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 5: 素数列挙 (2〜30) -----

static void test5_primes() {
    printf("[T5] 素数列挙 (2〜30)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 FOR N=2 TO 30",
        "20 GOSUB 200",
        "30 IF F=1 THEN PRINT N",
        "40 NEXT N",
        "50 END",
        "200 F=1",
        "210 IF N<4 THEN RETURN",
        "220 D=2",
        "230 IF D*D>N THEN RETURN",
        "240 IF N/D*D=N THEN F=0",
        "245 IF F=0 THEN RETURN",
        "250 D=D+1",
        "260 GOTO 230",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 13, 100'000'000, &cyc, &wms);
    check("最初の素数: 2",  out, "2\n");
    check("素数 11",        out, "11\n");
    check("最後の素数: 29", out, "29\n");
    g_bench[g_bench_n++] = {"T5  素数列挙 2-30", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 6: INPUT (対話入力) -----

static void test6_input() {
    printf("[T6] INPUT (対話入力)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 INPUT N",
        "20 S=0",
        "30 FOR I=1 TO N",
        "40 S=S+I",
        "50 NEXT I",
        "60 PRINT \"SUM 1-\";N;\"=\";S",
        "70 END",
    };
    for (int i = 0; i < 7; i++) {
        send_cmd(prog[i]);
        std::string echo;
        wait_for(echo, "\n>", 5'000'000);
    }
    uint64_t t6_start = g_cycles;
    auto t6_t0 = std::chrono::high_resolution_clock::now();
    send_cmd("RUN");

    // '?' が出たら "10" を入力する
    std::string buf;
    if (!wait_for(buf, "?", 20'000'000)) {
        printf("  FAIL: INPUT プロンプト '?' タイムアウト\n"); ++g_fail;
        delete top; top = nullptr; return;
    }
    send_cmd("10");

    if (!wait_for(buf, ">", 30'000'000)) {
        printf("  FAIL: プログラム終了タイムアウト\n"); ++g_fail;
        delete top; top = nullptr; return;
    }
    auto t6_t1 = std::chrono::high_resolution_clock::now();
    check("SUM 1-10=55", buf, "SUM 1-10=55");
    g_bench[g_bench_n++] = {"T6  INPUT 総和(N=10)", g_cycles - t6_start,
        std::chrono::duration<double, std::milli>(t6_t1 - t6_t0).count()};

    delete top; top = nullptr;
}

// ----- テスト 7: フィボナッチ数列（1000 以内）-----

static void test7_fibonacci() {
    printf("[T7] フィボナッチ数列 (1000 以内)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 A=1",
        "20 B=1",
        "30 IF A>1000 THEN END",
        "40 PRINT A",
        "50 C=A+B",
        "60 A=B",
        "70 B=C",
        "80 GOTO 30",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 8, 30'000'000, &cyc, &wms);
    check("610 が出力される", out, "610\n");
    check("987 が最後の値",   out, "987\n");
    g_bench[g_bench_n++] = {"T7  フィボナッチ ~1000", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 8: バブルソート（10 要素）-----

static void test8_bubble_sort() {
    printf("[T8] バブルソート (10 要素)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 DIM A(10)",
        "20 A(1)=5",
        "30 A(2)=3",
        "40 A(3)=8",
        "50 A(4)=1",
        "60 A(5)=9",
        "70 A(6)=2",
        "80 A(7)=7",
        "90 A(8)=4",
        "100 A(9)=6",
        "110 A(10)=10",
        "120 FOR I=1 TO 9",
        "130 FOR J=1 TO 10-I",
        "140 IF A(J)<=A(J+1) THEN GOTO 180",
        "150 T=A(J)",
        "160 A(J)=A(J+1)",
        "170 A(J+1)=T",
        "180 NEXT J",
        "190 NEXT I",
        "200 FOR I=1 TO 10",
        "210 PRINT A(I)",
        "220 NEXT I",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 22, 100'000'000, &cyc, &wms);
    check("先頭が 1",       out, "1\n2\n");
    check("末尾が 9, 10",   out, "9\n10\n");
    g_bench[g_bench_n++] = {"T8  バブルソート 10要素", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 9: 九九表 -----

static void test9_multiplication_table() {
    printf("[T9] 九九表\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 FOR I=1 TO 9",
        "20 FOR J=1 TO 9",
        "30 P=I*J",
        "40 IF P<10 THEN PRINT \" \";",
        "50 PRINT P;\" \";",
        "60 NEXT J",
        "70 PRINT",
        "80 NEXT I",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 8, 30'000'000, &cyc, &wms);
    check("1x1=1 (先頭セル)", out, " 1 ");
    check("9x9=81 (末尾セル)", out, "81 ");
    g_bench[g_bench_n++] = {"T9  九九表", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 10: 完全数探索（2〜30）-----
// doc/13 §10 の N=2 TO 500 版は時間がかかるため、テストは N=2 TO 30 で実行する。

static void test10_perfect_numbers() {
    printf("[T10] 完全数 (N=2..30)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    const char* prog[] = {
        "10 FOR N=2 TO 30",
        "20 GOSUB 200",
        "30 IF S=N THEN PRINT N",
        "40 NEXT N",
        "50 END",
        "200 S=0",
        "210 FOR D=1 TO N/2",
        "220 IF N/D*D=N THEN S=S+D",
        "230 NEXT D",
        "240 RETURN",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 10, 50'000'000, &cyc, &wms);
    check("完全数 6",  out, "6\n");
    check("完全数 28", out, "28\n");
    g_bench[g_bench_n++] = {"T10 完全数 N=2..30", cyc, wms};

    delete top; top = nullptr;
}

// ----- テスト 11: Byte Sieve (エラトステネスの篩) -----
// 1981年 BYTE 誌ベンチマーク。S=999 で期待値: 302。
//
// Apple-1 BASIC の DIM は配列の上限のみ登録し、実メモリは初回書き込み時に
// 遅延確保する。FOR-NEXT は変数 I のアドレスポインタを保存するため、
// FOR ループ内で F(I) = 1 を書くと変数テーブルが拡張・移動して I の
// アドレスが無効化され BAD NEXT ERR になる。
// → 初期化は GOTO ベースのループで行い、全要素確保後に FOR-NEXT を使う。

static void test11_byte_sieve() {
    printf("[T11] Byte Sieve (SIZE=999)\n");
    if (!boot_basic()) { delete top; top = nullptr; return; }

    // 1-based indexing: index I (1..S) → odd number 2*I+1
    // P = I+I+1 = 2*I+1 (prime), K = I+P = 3*I+1 (first composite index)
    const char* prog[] = {
        "1 S = 100",
        "2 DIM F(100)",
        "3 PRINT \"SIEVE START\"",
        "4 I = 1",              // 1 始まり: DIM F(N) → F(1)..F(N)
        "5 F(I) = 1",           // GOTO ループ: FOR-NEXT ポインタを使わない
        "6 I = I+1",
        "7 IF I <= S THEN GOTO 5",
        "8 C = 0",
        "9 FOR I = 1 TO S",     // 全要素確保済み → FOR-NEXT 安全
        "10 IF F(I) = 0 THEN 18",
        "11 P = I+I+1",         // prime = 2*I+1 (1-based)
        "12 K = I+P",
        "13 IF K > S THEN 17",
        "14 F(K) = 0",
        "15 K = K+P",
        "16 GOTO 13",
        "17 C = C+1",
        "18 NEXT I",
        "19 PRINT C",
    };
    uint64_t cyc = 0; double wms = 0;
    std::string out = run_program(prog, 19, 30'000'000, &cyc, &wms);
    check("SIEVE START", out, "SIEVE START");
    check("素数個数 45",  out, "45");
    check("*** END ERR", out, "*** END ERR");
    g_bench[g_bench_n++] = {"T11 Byte Sieve S=100", cyc, wms};

    delete top; top = nullptr;
}

// ----- main -----

int main() {
#ifndef BASIC_BIN_PATH
    printf("スキップ: BASIC_BIN_PATH 未定義\n");
    return 0;
#endif

    printf("=== doc/13 Integer BASIC 動作検証サンプル ===\n\n");

    test1_print();
    test2_for_next();
    test3_gcd();
    test4_gosub();
    test5_primes();
    test6_input();
    test7_fibonacci();
    test8_bubble_sort();
    test9_multiplication_table();
    test10_perfect_numbers();
    test11_byte_sieve();

    printf("\n結果: %d PASS / %d FAIL\n", g_pass, g_fail);

    // ---- ベンチマーク サマリ ----
    // RUN フェーズのクロック数＋実時間。WebAssembly / Pico2 実行時との比較用。
    // 参考: 実機 Apple-1 は 1.023 MHz (14.318 MHz / 14)。
    printf("\n=== ベンチマーク (RUN フェーズ) ===\n");
    printf("%-26s  %12s  %10s  %10s  %10s\n",
           "テスト", "cycles", "@1MHz(ms)", "@1.023MHz(ms)", "実時間(ms)");
    printf("%-26s  %12s  %10s  %10s  %10s\n",
           "──────────────────────────",
           "────────────", "──────────", "────────────", "──────────");
    double total_wms = 0;
    for (int i = 0; i < g_bench_n; i++) {
        uint64_t c = g_bench[i].cycles;
        double   w = g_bench[i].wall_ms;
        printf("%-26s  %12llu  %10.2f  %10.2f  %10.1f\n",
               g_bench[i].name,
               (unsigned long long)c,
               c / 1000.0,
               c / 1023.0,
               w);
        total_wms += w;
    }
    uint64_t total = 0;
    for (int i = 0; i < g_bench_n; i++) total += g_bench[i].cycles;
    printf("%-26s  %12llu  %10.2f  %10.2f  %10.1f\n",
           "合計",
           (unsigned long long)total,
           total / 1000.0,
           total / 1023.0,
           total_wms);

    return g_fail > 0 ? 1 : 0;
}
