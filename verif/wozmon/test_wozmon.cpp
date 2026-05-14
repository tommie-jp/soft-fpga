// Woz Monitor インテグレーションテスト
// doc/08-wozmon-使い方.md のコマンド例を自動検証する。
//
// テスト項目:
//   1. 起動プロンプト '\' が表示される
//   2. FF00    → FF00: D8  (wozmon 先頭バイト読み出し)
//   3. FF00.FF0F → 16 バイト範囲ダンプ 2 行
//   4. 0300: A9 55 4C 00 03 書き込み後プロンプト復帰
//   5. 0300.0304 → 0300: A9 55 4C 00 03  (書き込み内容の読み戻し)
//   6. 0300: A9 55 85 00 A9 AA 85 01 00 書き込み  (実用例 3.1)
//   7. 0300.0308 → 2 行ダンプ確認 (8+1 バイト)       (実用例 3.1)
//   8. 0000.00FF → ゼロページ全ダンプ先頭・末尾確認   (実用例 3.2)
//   9. 0300R 実行 → $00=55, $01=AA (ZP 直接確認)   (実用例 3.1)
//
// Exit code: 0 = PASS, 1 = FAIL

#include "Vapple1_top.h"
#include "verilated.h"
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>

// ----- シミュレータ状態 -----

static Vapple1_top* top;
static uint8_t ram[0x10000];

// PIA エミュレーション（キーボード・ディスプレイ）
static uint8_t kbd_data    = 0, kbd_cr = 0;
static uint8_t kbd_queue[256];
static int     kbd_q_head  = 0, kbd_q_tail  = 0;
static uint8_t disp_queue[1024];
static int     disp_q_head = 0, disp_q_tail = 0;

// Woz Monitor ROM ($FF00–$FFFF, 256 bytes)
// Source: harness.cpp / emard/apple-one roms/wozmon.hex
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

// ----- ハードウェアエミュレーション -----

// Apple-1 PIA: CS0 = A4。$D010 番台のアドレスはすべて PIA にマップ。
static inline bool is_pia(uint16_t addr) {
    return (addr & 0xFF10u) == 0xD010u;
}

static uint8_t memory_read(uint16_t addr) {
    if (is_pia(addr)) {
        switch (addr & 3u) {
            case 0: { uint8_t d = kbd_data; kbd_data &= 0x7F; kbd_cr &= 0x7F; return d; }
            case 1: return kbd_cr;
            case 2: return 0x00;  // DSP 常に ready (bit7=0)
            case 3: return 0x00;
            default: return 0x00;
        }
    }
    return ram[addr];
}

static void memory_write(uint16_t addr, uint8_t data) {
    if (is_pia(addr)) {
        if ((addr & 3u) == 2u) {
            uint8_t ch = data & 0x7F;
            if (ch == 0x0D) ch = 0x0A;   // CR → LF
            if (ch >= 0x20 || ch == 0x0A) {
                int next = (disp_q_tail + 1) & 1023;
                if (next != disp_q_head) {
                    disp_queue[disp_q_tail] = ch;
                    disp_q_tail = next;
                }
            }
        }
        return;
    }
    if (addr < 0xE000) ram[addr] = data;
}

static void step() {
    if (kbd_q_head != kbd_q_tail && !(kbd_data & 0x80)) {
        kbd_data   = kbd_queue[kbd_q_head] | 0x80;
        kbd_cr     = 0x80;
        kbd_q_head = (kbd_q_head + 1) & 255;
    }
    uint16_t ab_pre = (uint16_t)top->o_ab;
    if (top->o_we) memory_write(ab_pre, top->o_do);
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->i_di = memory_read(ab_pre);
    top->eval();
}

static void send_key(uint8_t ch) {
    if (ch >= 'a' && ch <= 'z') ch -= 32;  // Apple-1 は大文字のみ
    int next = (kbd_q_tail + 1) & 255;
    if (next != kbd_q_head) { kbd_queue[kbd_q_tail] = ch; kbd_q_tail = next; }
}

static int get_display_char() {
    if (disp_q_head == disp_q_tail) return -1;
    uint8_t ch = disp_queue[disp_q_head];
    disp_q_head = (disp_q_head + 1) & 1023;
    return (int)ch;
}

static void sim_init() {
    top = new Vapple1_top();

    memset(ram, 0xFF, sizeof(ram));   // 未実装 ROM 領域 = $FF (NOP-ish)
    memset(ram, 0x00, 0xD000);        // RAM 領域 = 0
    memcpy(&ram[0xFF00], WOZMON, sizeof(WOZMON));

    kbd_data    = 0; kbd_cr     = 0;
    kbd_q_head  = 0; kbd_q_tail = 0;
    disp_q_head = 0; disp_q_tail = 0;

    top->reset = 1;
    top->i_irq = 0;
    top->i_nmi = 0;
    top->i_rdy = 1;
    top->i_di  = 0xFF;
    top->clk   = 0;
    top->eval();

    for (int i = 0; i < 8; i++) {
        top->clk = 1; top->eval();
        top->clk = 0; top->eval();
    }
    top->reset = 0;
    top->eval();
    top->i_di = memory_read((uint16_t)top->o_ab);
    top->eval();
}

// ----- テストユーティリティ -----

static void drain(std::string& buf) {
    int ch;
    while ((ch = get_display_char()) >= 0) buf += (char)ch;
}

// buf に needle が現れるまで最大 max_cycles サイクル実行する。
static bool wait_for(std::string& buf, const char* needle, uint64_t max_cycles) {
    for (uint64_t i = 0; i < max_cycles; ++i) {
        step();
        drain(buf);
        if (buf.find(needle) != std::string::npos) return true;
    }
    return false;
}

// 表示出力を捨てながら n サイクル実行する（書き込みコマンド後の待機用）。
static void run_cycles(uint64_t n) {
    std::string discard;
    for (uint64_t i = 0; i < n; ++i) { step(); drain(discard); }
}

// Apple-1 形式で文字列を送信し末尾に CR を付ける。
static void send_cmd(const char* s) {
    for (const char* p = s; *p; ++p) send_key((uint8_t)*p);
    send_key('\r');
}

// ----- テストランナー -----

static int g_pass = 0, g_fail = 0;

static void check(const char* name, const std::string& buf, const char* expected) {
    if (buf.find(expected) != std::string::npos) {
        printf("  PASS: %s\n", name);
        ++g_pass;
    } else {
        printf("  FAIL: %s\n    expected: [%s]\n    got:      [", name, expected);
        for (char c : buf) {
            if      (c == '\n') fputs("\\n", stdout);
            else if (c == '\\') fputs("\\\\", stdout);
            else                putchar((unsigned char)c);
        }
        puts("]");
        ++g_fail;
    }
}

static bool run_tests() {
    std::string buf;

    // 1. 起動プロンプト
    // wozmon は起動時のみ '\' + CR を出力する
    printf("[1] 起動プロンプト\n");
    if (!wait_for(buf, "\\", 10'000'000)) {
        printf("  FAIL: 起動タイムアウト\n"); ++g_fail; return false;
    }
    check("'\\' が表示される", buf, "\\");

    // 2. 単アドレス読み出し FF00
    // wozmon はコマンド後に '\' を再出力しないため、結果文字列で待機する
    printf("[2] FF00 単アドレス読み出し\n");
    buf.clear();
    send_cmd("FF00");
    if (!wait_for(buf, "FF00: D8", 3'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("FF00: D8", buf, "FF00: D8");

    // 3. 範囲ダンプ FF00.FF0F
    printf("[3] FF00.FF0F 範囲ダンプ\n");
    buf.clear();
    send_cmd("FF00.FF0F");
    if (!wait_for(buf, "FF08: A7 8D 11 D0 8D 13 D0 C9", 5'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("先頭行 FF00: D8 58 A0 7F 8C 12 D0 A9", buf, "FF00: D8 58 A0 7F 8C 12 D0 A9");
    check("次行   FF08: A7 8D 11 D0 8D 13 D0 C9", buf, "FF08: A7 8D 11 D0 8D 13 D0 C9");

    // 4. メモリ書き込み
    // 書き込みコマンドは出力なし（エコーのみ）。エコー確認後、書き込み完了まで待機する。
    printf("[4] 0300: A9 55 4C 00 03 書き込み\n");
    buf.clear();
    send_cmd("0300: A9 55 4C 00 03");
    if (!wait_for(buf, "0300: A9 55 4C 00 03", 2'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("書き込みコマンドのエコー確認", buf, "0300: A9 55 4C 00 03");
    // CR 処理・RAM 書き込み・GETCHAR 復帰まで余裕を持って待つ
    run_cycles(2'000'000);

    // 5. 書き込み内容の読み戻し
    printf("[5] 0300.0304 読み戻し\n");
    buf.clear();
    send_cmd("0300.0304");
    if (!wait_for(buf, "0300: A9 55 4C 00 03", 3'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("0300: A9 55 4C 00 03", buf, "0300: A9 55 4C 00 03");

    // 6. プログラム書き込み (実用例 3.1)
    printf("[6] 0300: A9 55 85 00 A9 AA 85 01 00 書き込み\n");
    buf.clear();
    send_cmd("0300: A9 55 85 00 A9 AA 85 01 00");
    if (!wait_for(buf, "0300: A9 55 85 00 A9 AA 85 01 00", 2'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("書き込みエコー", buf, "0300: A9 55 85 00 A9 AA 85 01 00");
    run_cycles(2'000'000);

    // 7. 書き込み内容の確認ダンプ (実用例 3.1)
    // wozmon は 8 バイト/行で折り返すため 0300.0308 は 2 行になる。
    printf("[7] 0300.0308 ダンプ確認\n");
    buf.clear();
    send_cmd("0300.0308");
    if (!wait_for(buf, "0308: 00", 3'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("0300 行: A9 55 85 00 A9 AA 85 01", buf, "0300: A9 55 85 00 A9 AA 85 01");
    check("0308 行: 00",                       buf, "0308: 00");

    // 8. ゼロページ全ダンプ (実用例 3.2)
    // プログラム実行前の状態: $0000-$0023 および $002C-$00FF は 0x00 が保証される。
    // wozmon 内部変数 ($24-$2B) は解析済み値が残るため検査から除外する。
    printf("[8] 0000.00FF ゼロページ全ダンプ\n");
    buf.clear();
    send_cmd("0000.00FF");
    if (!wait_for(buf, "00F8: 00 00 00 00 00 00 00 00", 8'000'000)) {
        printf("  FAIL: タイムアウト\n"); ++g_fail; return false;
    }
    check("先頭行 0000: 00 00 00 00 00 00 00 00", buf, "0000: 00 00 00 00 00 00 00 00");
    check("末尾行 00F8: 00 00 00 00 00 00 00 00", buf, "00F8: 00 00 00 00 00 00 00 00");

    // 9. プログラム実行 → ゼロページ書き込み確認 (実用例 3.1)
    // BRK 後は IRQ ベクタ ($FFFE/$FFFF = $0000) へジャンプし wozmon に戻らない。
    // RAM を直接参照して書き込み結果を確認する。
    printf("[9] 0300R 実行 → $00=55, $01=AA\n");
    send_cmd("0300R");
    run_cycles(3'000'000);
    if (ram[0x0000] == 0x55) {
        printf("  PASS: $00 = 55\n"); ++g_pass;
    } else {
        printf("  FAIL: $00: expected 55, got %02X\n", ram[0x0000]); ++g_fail;
    }
    if (ram[0x0001] == 0xAA) {
        printf("  PASS: $01 = AA\n"); ++g_pass;
    } else {
        printf("  FAIL: $01: expected AA, got %02X\n", ram[0x0001]); ++g_fail;
    }

    return g_fail == 0;
}

int main() {
    printf("=== Woz Monitor テスト ===\n");
    sim_init();
    run_tests();
    printf("\n結果: %d PASS / %d FAIL\n", g_pass, g_fail);
    delete top;
    return g_fail > 0 ? 1 : 0;
}
