#include "Vuart_top.h"
#include "verilated.h"
#include <emscripten.h>
#include <stdint.h>

static Vuart_top* top;

// ring buffer ビットレイアウト (1 サンプル = 1 uint32_t)
//   bit[ 0]      = txd
//   bit[ 1]      = rxd
//   bit[ 2]      = tx_valid
//   bit[ 3]      = tx_ready
//   bit[ 4]      = rx_valid
//   bit[ 5]      = rx_error
//   bits[ 7: 6]  = tx_state (2bit: IDLE/START/DATA/STOP)
//   bits[ 9: 8]  = rx_state (2bit: IDLE/START/DATA/STOP)
//   bits[12:10]  = tx_bit   (3bit)
//   bits[15:13]  = rx_bit   (3bit)
//   bits[23:16]  = tx_data  (8bit, 送信バッファ内容)
//   bits[31:24]  = rx_data  (8bit, 最後に受信したバイト)

static const int RING_SIZE = 4096;
static uint32_t  ring[RING_SIZE];
static uint32_t  head = 0;

// 送信キュー (8バイト)
static const int TX_QUEUE_SIZE = 8;
static uint8_t   tx_queue[TX_QUEUE_SIZE];
static int       tx_q_head = 0, tx_q_tail = 0;

static uint8_t   last_rx_data    = 0;
static uint32_t  rx_valid_count  = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    top = new Vuart_top();
    top->rst = 1; top->tx_valid = 0; top->tx_data = 0;
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    head          = 0;
    tx_q_head     = 0;
    tx_q_tail     = 0;
    last_rx_data  = 0;
    rx_valid_count = 0;
}

EMSCRIPTEN_KEEPALIVE void step() {
    // キューに積まれたバイトを TX が IDLE のときに送出
    if (top->tx_ready && tx_q_head != tx_q_tail) {
        top->tx_data  = tx_queue[tx_q_head];
        top->tx_valid = 1;
        tx_q_head     = (tx_q_head + 1) % TX_QUEUE_SIZE;
    } else {
        top->tx_valid = 0;
    }

    top->clk = 0; top->eval();
    top->clk = 1; top->eval();

    if (top->o_rx_valid) {
        last_rx_data = top->o_rx_data;
        rx_valid_count++;
    }

    uint32_t d = 0;
    d |= (uint32_t)(top->o_txd      & 0x1u);
    d |= (uint32_t)(top->o_rxd      & 0x1u) << 1;
    d |= (uint32_t)(top->tx_valid   & 0x1u) << 2;
    d |= (uint32_t)(top->tx_ready   & 0x1u) << 3;
    d |= (uint32_t)(top->o_rx_valid & 0x1u) << 4;
    d |= (uint32_t)(top->o_rx_error & 0x1u) << 5;
    d |= (uint32_t)(top->o_tx_state & 0x3u) << 6;
    d |= (uint32_t)(top->o_rx_state & 0x3u) << 8;
    d |= (uint32_t)(top->o_tx_bit   & 0x7u) << 10;
    d |= (uint32_t)(top->o_rx_bit   & 0x7u) << 13;
    d |= (uint32_t)(top->o_tx_data  & 0xFFu) << 16;
    d |= (uint32_t)(top->o_rx_data  & 0xFFu) << 24;
    ring[head & (RING_SIZE - 1)] = d;
    head++;
}

EMSCRIPTEN_KEEPALIVE void reset_sim() {
    top->rst = 1; top->tx_valid = 0; top->tx_data = 0;
    top->clk = 0; top->eval();
    top->clk = 1; top->eval();
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    head          = 0;
    tx_q_head     = 0;
    tx_q_tail     = 0;
    last_rx_data  = 0;
    rx_valid_count = 0;
}

EMSCRIPTEN_KEEPALIVE void send_byte(uint8_t b) {
    int next = (tx_q_tail + 1) % TX_QUEUE_SIZE;
    if (next != tx_q_head) {
        tx_queue[tx_q_tail] = b;
        tx_q_tail = next;
    }
}

EMSCRIPTEN_KEEPALIVE uint8_t get_rx_data() {
    return last_rx_data;
}

EMSCRIPTEN_KEEPALIVE uint32_t get_rx_valid_count() {
    return rx_valid_count;
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()  { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_head()       { return head; }
EMSCRIPTEN_KEEPALIVE int       get_ring_size()  { return RING_SIZE; }

} // extern "C"
