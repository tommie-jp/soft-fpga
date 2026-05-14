// doc/09 §3.1 動作確認プログラム自動テスト + §3.2 Integer BASIC スモークテスト
//
// 方針:
//   - §3.1: IRQ ベクタを $FF00 (wozmon 再起動) に向け、BRK 終端版プログラムを実行。
//           BRK 後に wozmon が '\' を再出力するのを待ち、RAM の副作用を検証する。
//   - §3.2: BASIC_BIN_PATH の basic.bin を $E000 にロードし、E000R → PRINT 2+2 を実行。
//
// Exit code: 0 = PASS, 1 = FAIL

#include "Vapple1_top.h"
#include "verilated.h"
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <string>

// ----- シミュレータ状態 -----

static Vapple1_top* top;
static uint8_t ram[0x10000];

static uint8_t kbd_data    = 0, kbd_cr = 0;
static uint8_t kbd_queue[256];
static int     kbd_q_head  = 0, kbd_q_tail  = 0;
static uint8_t disp_queue[1024];
static int     disp_q_head = 0, disp_q_tail = 0;

// Woz Monitor ROM ($FF00-$FFFF)
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

static inline bool is_pia(uint16_t addr) {
    return (addr & 0xFF10u) == 0xD010u;
}

static uint8_t memory_read(uint16_t addr) {
    if (is_pia(addr)) {
        switch (addr & 3u) {
            case 0: { uint8_t d = kbd_data; kbd_data &= 0x7F; kbd_cr &= 0x7F; return d; }
            case 1: return kbd_cr;
            case 2: return 0x00;
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
            if (ch == 0x0D) ch = 0x0A;
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
    if (ch >= 'a' && ch <= 'z') ch -= 32;
    int next = (kbd_q_tail + 1) & 255;
    if (next != kbd_q_head) { kbd_queue[kbd_q_tail] = ch; kbd_q_tail = next; }
}

static int get_display_char() {
    if (disp_q_head == disp_q_tail) return -1;
    uint8_t ch = disp_queue[disp_q_head];
    disp_q_head = (disp_q_head + 1) & 1023;
    return (int)ch;
}

// sim_init: basic_path が非 NULL の場合 BASIC ROM を $E000 に読み込む。
// IRQ ベクタ ($FFFE/$FFFF) を $FF00 (wozmon 再起動) に向ける。
static void sim_init(const char* basic_path = nullptr) {
    top = new Vapple1_top();

    memset(ram, 0xFF, sizeof(ram));
    memset(ram, 0x00, 0xD000);
    memcpy(&ram[0xFF00], WOZMON, sizeof(WOZMON));

    // BRK/IRQ ベクタを wozmon 先頭 ($FF00) に向ける → BRK 後に wozmon が再起動する
    ram[0xFFFE] = 0x00;
    ram[0xFFFF] = 0xFF;

    if (basic_path) {
        FILE* f = fopen(basic_path, "rb");
        if (f) {
            (void)fread(&ram[0xE000], 1, 4096, f);
            fclose(f);
        } else {
            fprintf(stderr, "警告: basic.bin を開けません: %s\n", basic_path);
        }
    }

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

static bool wait_for(std::string& buf, const char* needle, uint64_t max_cycles) {
    for (uint64_t i = 0; i < max_cycles; ++i) {
        step();
        drain(buf);
        if (buf.find(needle) != std::string::npos) return true;
    }
    return false;
}

static void run_cycles(uint64_t n) {
    std::string discard;
    for (uint64_t i = 0; i < n; ++i) { step(); drain(discard); }
}

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

static void check_ram(const char* name, uint16_t addr, uint8_t expected) {
    if (ram[addr] == expected) {
        printf("  PASS: %s (ram[$%04X] = $%02X)\n", name, addr, expected);
        ++g_pass;
    } else {
        printf("  FAIL: %s  expected ram[$%04X]=$%02X  got $%02X\n",
               name, addr, expected, ram[addr]);
        ++g_fail;
    }
}

// 書き込みコマンドを送信してエコーを待つ。失敗は fatal。
static bool write_and_wait(std::string& buf, const char* cmd, uint64_t cycles = 2'000'000) {
    buf.clear();
    send_cmd(cmd);
    if (!wait_for(buf, cmd, cycles)) {
        printf("  FAIL: write timeout [%s]\n", cmd);
        ++g_fail;
        return false;
    }
    run_cycles(500'000);  // RAM 書き込み・GETCHAR 復帰まで待つ
    return true;
}

// BRK 後に wozmon が '\' を再出力するのを待つ。失敗は fatal。
static bool wait_for_wozmon_restart(const char* test_name) {
    std::string buf;
    if (!wait_for(buf, "\\", 8'000'000)) {
        printf("  FAIL: [%s] BRK 後 wozmon が再起動しなかった\n", test_name);
        ++g_fail;
        return false;
    }
    return true;
}

// ----- §3.1 テスト -----

static bool run_section3_1() {
    std::string buf;

    // 起動プロンプト
    if (!wait_for(buf, "\\", 10'000'000)) {
        printf("FAIL: 起動タイムアウト\n"); ++g_fail; return false;
    }

    // ─────────────────────────────────────────────────────────
    // T1: §3.1.1 LDA #$55, BRK
    //   プログラム: A9 55 00
    //   確認: BRK 後 wozmon が再起動する
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.1] LDA ループ (LDA #$55 BRK)\n");
    if (!write_and_wait(buf, "0300: A9 55 00")) return false;
    check("書き込みエコー", buf, "0300: A9 55 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.1")) return false;

    // ─────────────────────────────────────────────────────────
    // T2: §3.1.2 メモリ Read/Write
    //   プログラム: LDA #$AA, STA $10, LDA $10, BRK
    //   確認: ram[$0010] == $AA
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.2] メモリ Read/Write (STA $10)\n");
    if (!write_and_wait(buf, "0300: A9 AA 85 10 A5 10 00")) return false;
    check("書き込みエコー", buf, "0300: A9 AA 85 10 A5 10 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.2")) return false;
    check_ram("$0010 == $AA", 0x0010, 0xAA);

    // ─────────────────────────────────────────────────────────
    // T3: §3.1.3 スタック Push/Pop
    //   プログラム: LDA #$11, PHA, LDA #$22, PHA, PLA, PLA, BRK
    //   確認: ram[$01FF]==$11, ram[$01FE]==$22
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.3] スタック Push/Pop\n");
    // LDX #$FF; TXS で SP=$FF に初期化してから PHA × 2。
    // PLA はしない (PLA で SP を戻すと BRK が $01FF/$01FE を上書きする)。
    if (!write_and_wait(buf, "0300: A2 FF 9A A9 11 48 A9 22 48 00")) return false;
    check("書き込みエコー", buf, "0300: A2 FF 9A A9 11 48 A9 22 48 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.3")) return false;
    check_ram("$01FF == $11 (1st PHA)", 0x01FF, 0x11);
    check_ram("$01FE == $22 (2nd PHA)", 0x01FE, 0x22);

    // ─────────────────────────────────────────────────────────
    // T4: §3.1.4 フラグ・分岐 (BCS)
    //   プログラム: LDA #$FF, ADC #$01 → C=1, BCS → BRK (success path)
    //             分岐失敗なら LDA #$FF, STA $50, BRK → ram[$50]==$FF
    //   確認: ram[$0050] == $00 (分岐成功 = STA $50 が実行されていない)
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.4] フラグ・分岐 (ADC+BCS)\n");
    // $0300: A9 FF 69 01 B0 05 A9 FF 85 50 00 00
    //         LDA#FF ADC#01 BCS+5 LDA#FF STA$50 BRK [success BRK]
    if (!write_and_wait(buf, "0300: A9 FF 69 01 B0 05 A9 FF 85 50 00 00")) return false;
    check("書き込みエコー", buf, "0300: A9 FF 69 01 B0 05 A9 FF 85 50 00 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.4")) return false;
    check_ram("$0050 == $00 (BCS 成功 = 失敗パス未通過)", 0x0050, 0x00);

    // ─────────────────────────────────────────────────────────
    // T5: §3.1.5 インデックスアドレッシング (abs,X)
    //   データ: $0320: 11 22 33 44 55
    //   プログラム: LDX #$00; loop: LDA $0320,X; STA $50; INX; CPX #$05; BNE loop; BRK
    //   確認: ram[$0050] == $55 (最後に読んだ値)
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.5] インデックスアドレッシング (LDA abs,X)\n");
    if (!write_and_wait(buf, "0320: 11 22 33 44 55")) return false;
    check("データ書き込みエコー", buf, "0320: 11 22 33 44 55");
    // STA $50 を追加したため BNE オフセットを D0 F6 (-10 → $0302) に修正
    // A2 00 BD 20 03 85 50 E8 E0 05 D0 F6 00
    if (!write_and_wait(buf, "0300: A2 00 BD 20 03 85 50 E8 E0 05 D0 F6 00")) return false;
    check("書き込みエコー", buf, "0300: A2 00 BD 20 03 85 50 E8 E0 05 D0 F6 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.5")) return false;
    check_ram("$0050 == $55 (最後の abs,X 読み出し)", 0x0050, 0x55);

    // ─────────────────────────────────────────────────────────
    // T6: §3.1.6 JSR / RTS
    //   プログラム: LDX #$00; JSR sub×3; STX $51; BRK; sub: INX; RTS
    //   確認: ram[$0051] == $03 (サブルーチン 3 回呼び出し)
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.6] JSR / RTS\n");
    // $0300: A2 00 (LDX#00)
    // $0302: 20 10 03 (JSR $0310)
    // $0305: 20 10 03 (JSR $0310)
    // $0308: 20 10 03 (JSR $0310)
    // $030B: 86 51 (STX $51)
    // $030D: 00 (BRK)
    // $030E-$030F: FF FF (padding)
    // $0310: E8 (INX)
    // $0311: 60 (RTS)
    if (!write_and_wait(buf, "0300: A2 00 20 10 03 20 10 03 20 10 03 86 51 00")) return false;
    check("書き込みエコー", buf, "0300: A2 00 20 10 03 20 10 03 20 10 03 86 51 00");
    if (!write_and_wait(buf, "0310: E8 60")) return false;
    check("サブルーチン書き込みエコー", buf, "0310: E8 60");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.6")) return false;
    check_ram("$0051 == $03 (JSR 3 回 → X=$03)", 0x0051, 0x03);

    // ─────────────────────────────────────────────────────────
    // T7: §3.1.7 論理演算 (AND / ORA / EOR)
    //   プログラム: LDA #$FF, AND #$0F, ORA #$F0, EOR #$AA, STA $50, BRK
    //   計算: $FF&$0F=$0F, $0F|$F0=$FF, $FF^$AA=$55
    //   確認: ram[$0050] == $55
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.7] 論理演算 (AND/ORA/EOR)\n");
    if (!write_and_wait(buf, "0300: A9 FF 29 0F 09 F0 49 AA 85 50 00")) return false;
    check("書き込みエコー", buf, "0300: A9 FF 29 0F 09 F0 49 AA 85 50 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.7")) return false;
    check_ram("$0050 == $55 ($FF AND $0F OR $F0 EOR $AA)", 0x0050, 0x55);

    // ─────────────────────────────────────────────────────────
    // T8: §3.1.8 シフト・ローテート (ASL/LSR/ROL/ROR)
    //   プログラム: LDA #$01, ASL×3, LSR, SEC, ROL, ROR, STA $50, BRK
    //   計算: $01→$02→$04→$08→$04(C=0), SEC(C=1), ROL=$09(C=0), ROR=$04(C=1)
    //   確認: ram[$0050] == $04
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.8] シフト・ローテート (ASL/LSR/ROL/ROR)\n");
    if (!write_and_wait(buf, "0300: A9 01 0A 0A 0A 4A 38 2A 6A 85 50 00")) return false;
    check("書き込みエコー", buf, "0300: A9 01 0A 0A 0A 4A 38 2A 6A 85 50 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.8")) return false;
    check_ram("$0050 == $04 (シフト・ローテート結果)", 0x0050, 0x04);

    // ─────────────────────────────────────────────────────────
    // T9: §3.1.9 ページクロス・ペナルティサイクル (LDA abs,X / abs,Y)
    //   データ: $0200: 11
    //   プログラム: LDX #$01; LDA $01FF,X ($0200, ページクロス); STA $50
    //              LDY #$01; LDA $01FF,Y ($0200, ページクロス); STA $51; BRK
    //   確認: ram[$0050]==$11, ram[$0051]==$11 (ページクロスしても正しいアドレスを読む)
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.9] ページクロス (LDA abs,X / abs,Y)\n");
    // $0200-$02FF は wozmon のラインバッファ → データは $0600 に置く
    // LDA $05FF,X (X=1) → $0600 (ページクロス: $FF+1 → carry)
    if (!write_and_wait(buf, "0600: 11")) return false;
    check("データ書き込みエコー", buf, "0600: 11");
    // A2 01 BD FF 05 85 50 A0 01 B9 FF 05 85 51 00
    if (!write_and_wait(buf, "0300: A2 01 BD FF 05 85 50 A0 01 B9 FF 05 85 51 00")) return false;
    check("書き込みエコー", buf, "0300: A2 01 BD FF 05 85 50 A0 01 B9 FF 05 85 51 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.9")) return false;
    check_ram("$0050 == $11 (abs,X ページクロス読み出し)", 0x0050, 0x11);
    check_ram("$0051 == $11 (abs,Y ページクロス読み出し)", 0x0051, 0x11);

    // ─────────────────────────────────────────────────────────
    // T10: §3.1.10 RMW 命令 (INC/DEC メモリ)
    //   プログラム: LDA #$00, STA $20, INC $20, INC $20, DEC $20, LDA $20, STA $50, BRK
    //   計算: $20: $00→$01→$02→$01
    //   確認: ram[$0020]==$01, ram[$0050]==$01
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.10] RMW (INC/DEC メモリ)\n");
    if (!write_and_wait(buf, "0300: A9 00 85 20 E6 20 E6 20 C6 20 A5 20 85 50 00")) return false;
    check("書き込みエコー", buf, "0300: A9 00 85 20 E6 20 E6 20 C6 20 A5 20 85 50 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.10")) return false;
    check_ram("$0020 == $01 (STA→INC→INC→DEC)", 0x0020, 0x01);
    check_ram("$0050 == $01 (LDA $20 の結果を保存)", 0x0050, 0x01);

    // ─────────────────────────────────────────────────────────
    // T11: §3.1.11 ゼロページ X インデックス (LDA zp,X)
    //   データ: $0050: 11 22 33 44  (wozmon で書き込み後に $50 が上書きされるため $0060 に退避)
    //   プログラム: LDX #$00; LDA $50,X; STA $60,X; INX; CPX #$04; BNE loop; BRK
    //   確認: ram[$0060]==$11, ram[$0063]==$44
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.11] ZP,X インデックス\n");
    // $0050 には前テスト結果 $01 が残っているので別データを書き直す
    if (!write_and_wait(buf, "0050: 11 22 33 44")) return false;
    check("データ書き込みエコー", buf, "0050: 11 22 33 44");
    // B5 50 = LDA $50,X; 95 60 = STA $60,X
    // BNE オフセット D0 F7 (-9 → $0302, STA の前に LDA へ戻る)
    if (!write_and_wait(buf, "0300: A2 00 B5 50 95 60 E8 E0 04 D0 F7 00")) return false;
    check("書き込みエコー", buf, "0300: A2 00 B5 50 95 60 E8 E0 04 D0 F7 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.11")) return false;
    check_ram("$0060 == $11 (ZP,X 先頭)", 0x0060, 0x11);
    check_ram("$0063 == $44 (ZP,X 末尾)", 0x0063, 0x44);

    // ─────────────────────────────────────────────────────────
    // T12: §3.1.12 間接インデックス ((zp),Y)
    //   設定: $0020/$0021 = $00/$04 (ポインタ → $0400)
    //   プログラム: LDY #$00; LDA #$AA; STA ($20),Y; INY; CPY #$04; BNE loop; BRK
    //   確認: ram[$0400-$0403] == $AA (書き込み確認)
    // ─────────────────────────────────────────────────────────
    printf("[§3.1.12] (zp),Y 間接インデックス\n");
    if (!write_and_wait(buf, "0020: 00 04")) return false;
    check("ポインタ書き込みエコー", buf, "0020: 00 04");
    // A0 00 A9 AA 91 20 C8 C0 04 D0 F9 00
    if (!write_and_wait(buf, "0300: A0 00 A9 AA 91 20 C8 C0 04 D0 F9 00")) return false;
    check("書き込みエコー", buf, "0300: A0 00 A9 AA 91 20 C8 C0 04 D0 F9 00");
    send_cmd("0300R");
    if (!wait_for_wozmon_restart("3.1.12")) return false;
    check_ram("$0400 == $AA ((zp),Y 書き込み先頭)", 0x0400, 0xAA);
    check_ram("$0403 == $AA ((zp),Y 書き込み末尾)", 0x0403, 0xAA);

    delete top;
    top = nullptr;
    return true;
}

// ----- §3.2 Integer BASIC スモークテスト -----

static bool run_section3_2() {
#ifndef BASIC_BIN_PATH
    printf("[§3.2] スキップ: BASIC_BIN_PATH 未定義\n");
    return true;
#else
    printf("[§3.2] Integer BASIC スモークテスト\n");

    sim_init(BASIC_BIN_PATH);

    std::string buf;
    if (!wait_for(buf, "\\", 10'000'000)) {
        printf("  FAIL: 起動タイムアウト\n"); ++g_fail;
        delete top; top = nullptr;
        return false;
    }

    // E000R → BASIC 起動
    buf.clear();
    send_cmd("E000R");
    // BASIC は起動プロンプトを表示しないため一定サイクル待ってから入力する
    run_cycles(3'000'000);

    // PRINT 2+2 を送信し、出力に "4" が含まれることを確認
    buf.clear();
    send_cmd("PRINT 2+2");
    if (!wait_for(buf, "4", 15'000'000)) {
        printf("  FAIL: PRINT 2+2 タイムアウト (got: [");
        for (char c : buf) {
            if (c == '\n') fputs("\\n", stdout); else putchar((unsigned char)c);
        }
        printf("])\n");
        ++g_fail;
        delete top; top = nullptr;
        return false;
    }
    check("PRINT 2+2 → 4 が出力される", buf, "4");

    delete top; top = nullptr;
    return true;
#endif
}

int main() {
    printf("=== §3.1 動作確認プログラム自動テスト ===\n");
    sim_init();
    run_section3_1();

    printf("\n=== §3.2 Integer BASIC スモークテスト ===\n");
    run_section3_2();

    printf("\n結果: %d PASS / %d FAIL\n", g_pass, g_fail);
    return g_fail > 0 ? 1 : 0;
}
