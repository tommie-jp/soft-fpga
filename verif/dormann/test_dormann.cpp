// Klaus Dormann 6502/65C02 functional test — native Verilator harness
// Usage: test_dormann <rom.bin> [success_pc]
//   rom.bin    : 64KB flat binary loaded at $0000
//   success_pc : expected trap address (default $3469 for 6502_functional_test)
//
// Exit code: 0 = PASS, 1 = FAIL

#include "Vapple1_top.h"
#include "verilated.h"
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <cassert>

static uint8_t ram[0x10000];

static Vapple1_top* top;

static uint8_t memory_read(uint16_t addr) {
    return ram[addr];
}

static void memory_write(uint16_t addr, uint8_t data) {
    ram[addr] = data;
}

static void step() {
    uint16_t ab_pre = (uint16_t)top->o_ab;
    if (top->o_we) memory_write(ab_pre, top->o_do);

    top->clk = 1; top->eval();
    top->clk = 0; top->eval();

    top->i_di = memory_read(ab_pre);
    top->eval();
}

int main(int argc, char* argv[]) {
    const char* rom_path   = (argc > 1) ? argv[1] : "6502_functional_test.bin";
    uint16_t    success_pc = (argc > 2) ? (uint16_t)strtol(argv[2], nullptr, 0) : 0x3469;

    // load binary
    FILE* f = fopen(rom_path, "rb");
    if (!f) { fprintf(stderr, "ERROR: cannot open %s\n", rom_path); return 1; }
    size_t n = fread(ram, 1, sizeof(ram), f);
    fclose(f);
    if (n != sizeof(ram)) {
        fprintf(stderr, "ERROR: expected 65536 bytes, got %zu from %s\n", n, rom_path);
        return 1;
    }

    // 6502_functional_test.bin は $0400 スタート設計。
    // バイナリ内の reset vector ($37A3) はエラートラップのため、$0400 に上書きする。
    ram[0xFFFC] = 0x00;
    ram[0xFFFD] = 0x04;

    uint16_t reset_vec = (uint16_t)ram[0xFFFC] | ((uint16_t)ram[0xFFFD] << 8);
    fprintf(stderr, "ROM: %s\nReset vector (forced): $%04X  Success trap: $%04X\n",
            rom_path, reset_vec, success_pc);

    // init
    VerilatedContext ctx;
    top = new Vapple1_top(&ctx);

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

    // JMP * (infinite loop) の検出:
    // AB が SYNC=1 で同じアドレスを 2 回連続フェッチしたら trap。
    // PC ではなく AB で追跡することでリセットシーケンス中の誤検出を回避する。
    const uint64_t MAX_CYCLES = 200'000'000ULL;
    uint64_t cycles      = 0;
    uint64_t report      = 1'000'000;
    uint16_t last_sync_ab = 0xFFFF;

    while (cycles < MAX_CYCLES) {
        step();
        cycles++;

        if (cycles >= report) {
            fprintf(stderr, "\r  cycles=%llu  PC=$%04X  A=$%02X  X=$%02X  Y=$%02X",
                    (unsigned long long)cycles,
                    (unsigned)top->o_pc, (unsigned)top->o_a,
                    (unsigned)top->o_x, (unsigned)top->o_y);
            fflush(stderr);
            report += 1'000'000;
        }

        // SYNC=1 のサイクルが命令フェッチの先頭。
        // 同じアドレスを 2 回連続でフェッチ = JMP * トラップ。
        if (top->o_sync) {
            // SYNC=1 時: o_pc はオペコードフェッチ後に +1 されている。
            // 実際のオペコードアドレス = o_pc - 1。
            uint16_t pc = (uint16_t)top->o_pc - 1u;
            if (pc == last_sync_ab) {
                fprintf(stderr, "\n");
                if (pc == success_pc) {
                    fprintf(stdout, "PASS: trapped at $%04X after %llu cycles\n",
                            pc, (unsigned long long)cycles);
                    delete top;
                    return 0;
                } else {
                    fprintf(stdout, "FAIL: trapped at $%04X (expected $%04X) after %llu cycles\n",
                            pc, success_pc, (unsigned long long)cycles);
                    delete top;
                    return 1;
                }
            }
            last_sync_ab = pc;
        }
    }

    fprintf(stderr, "\n");
    fprintf(stdout, "TIMEOUT: %llu cycles elapsed, PC=$%04X\n",
            (unsigned long long)MAX_CYCLES, (unsigned)top->o_pc);
    delete top;
    return 1;
}
