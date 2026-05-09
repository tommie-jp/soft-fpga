#include "Vapple1_top.h"
#include "verilated.h"
#include <emscripten.h>
#include <stdint.h>
#include <string.h>

static Vapple1_top* top;

// ring buffer: 2 uint32_t per sample
// Word0: [15:0]=AB  [23:16]=DB  [24]=WE  [25]=SYNC  [26]=reset
// Word1: [7:0]=A  [15:8]=X  [23:16]=Y  [31:24]=SP
static const int RING_SIZE = 4096;  // power of 2
static uint32_t  ring[RING_SIZE * 2];
static uint32_t  head = 0;

// 64KB flat address space
static uint8_t   ram[0x10000];

// PIA emulation
static uint8_t   kbd_data    = 0;
static uint8_t   kbd_cr      = 0;
static uint8_t   kbd_queue[256];
static int       kbd_q_head  = 0;
static int       kbd_q_tail  = 0;

// Display output queue
static uint8_t   disp_queue[1024];
static int       disp_q_head = 0;
static int       disp_q_tail = 0;
static uint32_t  disp_count  = 0;

// Apple-1 Woz Monitor ROM ($FF00-$FFFF, 256 bytes)
// Source: emard/apple-one roms/wozmon.hex (verified: reset vector $FFFC-$FFFD = $00 $FF)
static const uint8_t WOZMON[256] = {
    0xD8,0x58,0xA0,0x7F,0x8C,0x12,0xD0,0xA9,0xA7,0x8D,0x11,0xD0,0x8D,0x13,0xD0,0xC9,  // $FF00
    0xDF,0xF0,0x13,0xC9,0x9B,0xF0,0x03,0xC8,0x10,0x0F,0xA9,0xDC,0x20,0xEF,0xFF,0xA9,  // $FF10
    0x8D,0x20,0xEF,0xFF,0xA0,0x01,0x88,0x30,0xF6,0xAD,0x11,0xD0,0x10,0xFB,0xAD,0x10,  // $FF20
    0xD0,0x99,0x00,0x02,0x20,0xEF,0xFF,0xC9,0x8D,0xD0,0xD4,0xA0,0xFF,0xA9,0x00,0xAA,  // $FF30
    0x0A,0x85,0x2B,0xC8,0xB9,0x00,0x02,0xC9,0x8D,0xF0,0xD4,0xC9,0xAE,0x90,0xF4,0xF0,  // $FF40
    0xF0,0xC9,0xBA,0xF0,0xEB,0xC9,0xD2,0xF0,0x3B,0x86,0x28,0x86,0x29,0x84,0x2A,0xB9,  // $FF50
    0x00,0x02,0x49,0xB0,0xC9,0x0A,0x90,0x06,0x69,0x88,0xC9,0xFA,0x90,0x11,0x0A,0x0A,  // $FF60
    0x0A,0x0A,0xA2,0x04,0x0A,0x26,0x28,0x26,0x29,0xCA,0xD0,0xF8,0xC8,0xD0,0xE0,0xC4,  // $FF70
    0x2A,0xF0,0x97,0x24,0x2B,0x50,0x10,0xA5,0x28,0x81,0x26,0xE6,0x26,0xD0,0xB5,0xE6,  // $FF80
    0x27,0x4C,0x44,0xFF,0x6C,0x24,0x00,0x30,0x2B,0xA2,0x02,0xB5,0x27,0x95,0x25,0x95,  // $FF90
    0x23,0xCA,0xD0,0xF7,0xD0,0x14,0xA9,0x8D,0x20,0xEF,0xFF,0xA5,0x25,0x20,0xDC,0xFF,  // $FFA0
    0xA5,0x24,0x20,0xDC,0xFF,0xA9,0xBA,0x20,0xEF,0xFF,0xA9,0xA0,0x20,0xEF,0xFF,0xA1,  // $FFB0
    0x24,0x20,0xDC,0xFF,0x86,0x2B,0xA5,0x24,0xC5,0x28,0xA5,0x25,0xE5,0x29,0xB0,0xC1,  // $FFC0
    0xE6,0x24,0xD0,0x02,0xE6,0x25,0xA5,0x24,0x29,0x07,0x10,0xC8,0x48,0x4A,0x4A,0x4A,  // $FFD0
    0x4A,0x20,0xE5,0xFF,0x68,0x29,0x0F,0x09,0xB0,0xC9,0xBA,0x90,0x02,0x69,0x06,0x2C,  // $FFE0
    0x12,0xD0,0x30,0xFB,0x8D,0x12,0xD0,0x60,0x00,0x00,0x00,0x0F,0x00,0xFF,0x00,0x00,  // $FFF0
};

static uint8_t memory_read(uint16_t addr) {
    if (addr == 0xD010) {
        uint8_t d = kbd_data;
        kbd_data &= 0x7F;  // clear strobe on read
        kbd_cr   &= 0x7F;
        return d;
    }
    if (addr == 0xD011) return kbd_cr;
    if (addr == 0xD012) return 0x00;  // DSP always ready
    if (addr == 0xD013) return 0x00;
    return ram[addr];
}

static void memory_write(uint16_t addr, uint8_t data) {
    if (addr == 0xD012) {
        uint8_t ch = data & 0x7F;
        if (ch == 0x0D) ch = 0x0A;  // CR → LF for xterm.js
        if (ch != 0x00) {
            int next = (disp_q_tail + 1) & 1023;
            if (next != disp_q_head) {
                disp_queue[disp_q_tail] = ch;
                disp_q_tail = next;
            }
            disp_count++;
        }
        return;
    }
    if (addr < 0xFF00) {  // protect ROM area
        ram[addr] = data;
    }
}

static void load_rom() {
    memcpy(&ram[0xFF00], WOZMON, 256);
}

static void write_ring() {
    uint32_t idx = (head & (RING_SIZE - 1)) << 1;
    uint8_t  db  = top->o_we ? top->o_do : top->i_di;
    ring[idx]     = (uint32_t)(top->o_ab)
                  | ((uint32_t)db              << 16)
                  | ((uint32_t)(top->o_we    & 1u) << 24)
                  | ((uint32_t)(top->o_sync  & 1u) << 25)
                  | ((uint32_t)(top->reset   & 1u) << 26);
    ring[idx + 1] = (uint32_t)(top->o_a)
                  | ((uint32_t)(top->o_x)  << 8)
                  | ((uint32_t)(top->o_y)  << 16)
                  | ((uint32_t)(top->o_sp) << 24);
    head++;
}

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    top = new Vapple1_top();
    memset(ram, 0xFF, sizeof(ram));  // uninitialized ROM areas = $FF (NOP-ish)
    memset(ram, 0x00, 0xD000);       // RAM area = 0
    load_rom();

    kbd_data    = 0; kbd_cr = 0;
    kbd_q_head  = 0; kbd_q_tail = 0;
    disp_q_head = 0; disp_q_tail = 0;
    disp_count  = 0;
    head        = 0;

    top->reset = 1;
    top->i_irq = 0;  // hoglet IRQ is active-HIGH; 0 = deasserted
    top->i_nmi = 0;  // NMI edge-triggered; keep low = no NMI
    top->i_rdy = 1;
    top->i_di  = 0xFF;
    top->clk   = 0;
    top->eval();

    // several reset cycles
    for (int i = 0; i < 8; i++) {
        top->clk = 1; top->eval();
        top->clk = 0; top->eval();
    }
    top->reset = 0;
    top->eval();
    // prime DI with reset vector area
    top->i_di = memory_read(top->o_ab);
    top->eval();
}

EMSCRIPTEN_KEEPALIVE void step() {
    if (kbd_q_head != kbd_q_tail && !(kbd_data & 0x80)) {
        kbd_data = kbd_queue[kbd_q_head] | 0x80;
        kbd_cr   = 0x80;
        kbd_q_head = (kbd_q_head + 1) & 255;
    }

    // AB/WE/DO are combinatorial from current (pre-posedge) state
    uint16_t ab_pre = (uint16_t)top->o_ab;
    if (top->o_we) memory_write(ab_pre, top->o_do);

    top->clk = 1; top->eval();  // posedge: state advances; registers sample current inputs
    top->clk = 0; top->eval();  // negedge: new state's combinatorial settles

    // Synchronous BRAM model: DI valid on the cycle AFTER the address.
    // Use ab_pre (old AB, valid during the cycle that just ended) so the
    // CPU samples memory[ab_pre] at the NEXT posedge.
    top->i_di = memory_read(ab_pre);
    top->eval();  // propagate new DI → combinatorial AB (e.g. JMP1: AB={DIMUX,ADD})

    write_ring();
}

EMSCRIPTEN_KEEPALIVE void step_instruction() {
    // run until SYNC=1 (CPU entering DECODE of next instruction)
    int guard = 0;
    do { step(); } while (!top->o_sync && ++guard < 20);
}

EMSCRIPTEN_KEEPALIVE void reset_sim() {
    memset(ram, 0xFF, sizeof(ram));
    memset(ram, 0x00, 0xD000);
    load_rom();

    kbd_data    = 0; kbd_cr = 0;
    kbd_q_head  = 0; kbd_q_tail = 0;
    disp_q_head = 0; disp_q_tail = 0;
    disp_count  = 0;
    head        = 0;

    top->reset = 1;
    top->i_irq = 0;
    top->i_nmi = 0;
    top->eval();
    for (int i = 0; i < 8; i++) {
        top->clk = 1; top->eval();
        top->clk = 0; top->eval();
    }
    top->reset = 0;
    top->eval();
    top->i_di = memory_read(top->o_ab);
    top->eval();
}

EMSCRIPTEN_KEEPALIVE void send_key(uint8_t ch) {
    if (ch >= 'a' && ch <= 'z') ch -= 32;  // Apple-1: uppercase only
    int next = (kbd_q_tail + 1) & 255;
    if (next != kbd_q_head) {
        kbd_queue[kbd_q_tail] = ch;
        kbd_q_tail = next;
    }
}

EMSCRIPTEN_KEEPALIVE int     get_display_char()  {
    if (disp_q_head == disp_q_tail) return -1;
    uint8_t ch = disp_queue[disp_q_head];
    disp_q_head = (disp_q_head + 1) & 1023;
    return (int)ch;
}
EMSCRIPTEN_KEEPALIVE uint32_t get_display_count() { return disp_count; }

EMSCRIPTEN_KEEPALIVE uint16_t get_pc()    { return (uint16_t)top->o_pc;    }
EMSCRIPTEN_KEEPALIVE uint8_t  get_a()     { return (uint8_t) top->o_a;     }
EMSCRIPTEN_KEEPALIVE uint8_t  get_x()     { return (uint8_t) top->o_x;     }
EMSCRIPTEN_KEEPALIVE uint8_t  get_y()     { return (uint8_t) top->o_y;     }
EMSCRIPTEN_KEEPALIVE uint8_t  get_sp()    { return (uint8_t) top->o_sp;    }
EMSCRIPTEN_KEEPALIVE uint8_t  get_p()     { return (uint8_t) top->o_p;     }
EMSCRIPTEN_KEEPALIVE uint8_t  get_state() { return (uint8_t) top->o_state; }

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()  { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_head()       { return head; }
EMSCRIPTEN_KEEPALIVE int       get_ring_size()  { return RING_SIZE; }

} // extern "C"
