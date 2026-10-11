#include "Vuart_top.h"
#include "verilated.h"
#include "../../../cxx/rtlscope_ring.h"

static Vuart_top* top;

// ring buffer ビットレイアウト（1 サンプル = 2 word）
//   word0:
//     bit[ 0]      = txd
//     bit[ 1]      = rxd
//     bit[ 2]      = tx_valid
//     bit[ 3]      = tx_ready
//     bit[ 4]      = rx_valid
//     bit[ 5]      = rx_error
//     bits[ 7: 6]  = tx_state (2bit: IDLE/START/DATA/STOP)
//     bits[ 9: 8]  = rx_state (2bit: IDLE/START/DATA/STOP)
//     bits[12:10]  = tx_bit   (3bit)
//     bits[15:13]  = rx_bit   (3bit)
//     bits[23:16]  = tx_data  (8bit, 送信バッファ内容)
//     bits[31:24]  = rx_data  (8bit, 最後に受信したバイト)
//   word1:
//     bit[ 0]      = rst
//
// 記録・Freeze・トリガーは cxx/rtlscope_ring.h が担当する。
static rtlscope::Ring<4096, 2> ring;

// 送信キュー (8バイト)
// 送信欄 (maxlength=32) の字が全部入る大きさ。8 だと 7 字までしか積めなかった。
static const int TX_QUEUE_SIZE = 64;
static uint8_t   tx_queue[TX_QUEUE_SIZE];
static int       tx_q_head = 0, tx_q_tail = 0;

static uint8_t   last_rx_data    = 0;
static uint32_t  rx_valid_count  = 0;
// 受信した字の記録。1 回の描画の間に何字届いても、画面が全部を読めるようにする。
static const uint32_t RX_LOG_SIZE = 64;   // 2 のべき乗
static uint8_t   rx_log[RX_LOG_SIZE];

static void record_sample() {
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
    const uint32_t w[2] = { d, (uint32_t)(top->rst & 0x1u) };
    ring.record(w);
}

// rst を 2 サイクル保持してリセットする。リセット区間も波形に残す。
static void apply_reset() {
    top->rst = 1; top->tx_valid = 0; top->tx_data = 0;
    for (int i = 0; i < 2; i++) {
        top->clk = 0; top->eval();
        top->clk = 1; top->eval();
        record_sample();
    }
    top->clk = 0; top->eval();
    top->rst = 0; top->eval();
    tx_q_head      = 0;
    tx_q_tail      = 0;
    last_rx_data   = 0;
    rx_valid_count = 0;
}

RTLSCOPE_EXPORT_RING(ring)

extern "C" {

EMSCRIPTEN_KEEPALIVE void sim_init() {
    if (!top) top = new Vuart_top();
    top->rst = 0; top->tx_valid = 0; top->tx_data = 0;
    top->clk = 0; top->eval();
    ring.start_session();
    apply_reset();
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
        rx_log[rx_valid_count & (RX_LOG_SIZE - 1)] = top->o_rx_data;
        rx_valid_count++;
    }

    record_sample();
}

// リセットする。波形の履歴は残し、Freeze とトリガー発火状態だけ解除する。
EMSCRIPTEN_KEEPALIVE void reset_sim() {
    ring.thaw();
    apply_reset();
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

// n 番目 (0 始まり) に受信した字。古すぎて記録から落ちた字は 0。
EMSCRIPTEN_KEEPALIVE uint8_t get_rx_byte(uint32_t n) {
    if (rx_valid_count - n > RX_LOG_SIZE) return 0;
    return rx_log[n & (RX_LOG_SIZE - 1)];
}

// n クロック進める。トリガーで Freeze したらその場で打ち切る。
EMSCRIPTEN_KEEPALIVE void sim_run_n(int n) {
    for (int i = 0; i < n && !ring.hit(); i++) step();
}

} // extern "C"
