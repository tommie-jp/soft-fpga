// harness.cpp — CP/M 8080 soft-FPGA ハーネス
//
// 04-6502/cxx/harness.cpp と同じ構造。
// vm80a RTL を Verilator 化した Vcpm_top を動かし、
// IN/OUT ポートコールバックで CP/M I/O を処理する。

#include "Vcpm_top.h"
#include "Vcpm_top_cpm_top.h"     // ram[], f1, f2 public アクセスに必要
#include "Vcpm_top_vm80a_core.h"  // cpu->acc 書き換え（ポート $A1h 戻り値）
#include "verilated.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#include <cstdio>
#include <cstring>
#include <stdint.h>
#include <string>

static Vcpm_top* top;

// ring buffer: 1 uint32_t per sample
// [15:0]=ADDR  [23:16]=DATA  [24]=WR  [25]=SYNC  [26]=IOM
static const int RING_SIZE = 4096;
static uint32_t  ring[RING_SIZE];
static uint32_t  ring_head = 0;

// 64KB フラット RAM (Verilator 側の ram[] と同期)
// C++ ハーネスが CP/M イメージをここに配置してからリセット解除する
static uint8_t   mem[0x10000];

// コンソール入出力キュー
static uint8_t   con_in_buf[256];
static int       con_in_head = 0;
static int       con_in_tail = 0;

static uint8_t   con_out_buf[1024];
static int       con_out_head = 0;
static int       con_out_tail = 0;

// ディスクイメージ (最大 2 MB — DSK ファイルをここに展開)
static uint8_t   disk_image[2 * 1024 * 1024];
static int       disk_size   = 0;

// ディスクアクセス状態
static int       disk_track  = 0;
static int       disk_sector = 0;
static uint16_t  disk_dma    = 0x0080;

// WBOOT 時に CCP を復元するための保存イメージ (0xDC00-0xE3FF = 2KB)
static uint8_t   saved_ccp[0x0800];

// 前回の io_req 値 (立ち上がり検出用)
static uint8_t   prev_io_req = 0;
// IN 命令の二重読み取りを防ぐため、前回の io_active && io_dbin 状態を保持
static bool      prev_io_in_active = false;

// ポート $A1h: ホストファイル転送状態（R.COM / W.COM 用）
static FILE*     host_file      = nullptr;
static uint8_t   last_a1_result = 0x00;

// --------------------------------------------------------------
// CP/M イメージを RAM に配置する
// bios_bin: BIOS バイナリ, bios_size: サイズ
// cpm_bin:  CCP+BDOS バイナリ, cpm_size: サイズ
// --------------------------------------------------------------
static void load_cpm_image(
    const uint8_t* bios_bin, int bios_size,
    const uint8_t* cpm_bin,  int cpm_size)
{
    memset(mem, 0, sizeof(mem));

    // CCP+BDOS を $DC00 に配置
    if (cpm_bin && cpm_size > 0)
        memcpy(mem + 0xDC00, cpm_bin, cpm_size);

    // WBOOT 用に CCP 部分 (0xDC00-0xE3FF) を保存
    memcpy(saved_ccp, mem + 0xDC00, sizeof(saved_ccp));

    // BIOS を $F200 に配置
    if (bios_bin && bios_size > 0)
        memcpy(mem + 0xF200, bios_bin, bios_size);

    // $0000: JMP $F200 (BIOS BOOT エントリ)
    // リセット後 CPU は $0000 から実行を開始するため、BIOS BOOT にジャンプさせる
    mem[0x0000] = 0xC3;   // JMP opcode
    mem[0x0001] = 0x00;   // $F200 low byte
    mem[0x0002] = 0xF2;   // $F200 high byte

    // RAM を Verilator 側にコピー
    for (int i = 0; i < 0x10000; i++)
        top->cpm_top->ram[i] = mem[i];
}

// FCB ($005C) からホストファイル名を生成する
// FCB レイアウト: [drive(1)][name(8)][ext(3)], スペースパディング・高ビットは 0x7F でマスク
static std::string fcb_to_filename() {
    char name[9] = {};
    char ext[4]  = {};
    for (int i = 0; i < 8; i++)
        name[i] = (char)(top->cpm_top->ram[0x005C + 1 + i] & 0x7F);
    for (int i = 0; i < 3; i++)
        ext[i]  = (char)(top->cpm_top->ram[0x005C + 9 + i] & 0x7F);
    for (int i = 7; i >= 0 && name[i] == ' '; i--) name[i] = '\0';
    for (int i = 2; i >= 0 && ext[i]  == ' '; i--) ext[i]  = '\0';
    std::string result(name);
    if (ext[0] != '\0') result += std::string(".") + ext;
    return result;
}

// --------------------------------------------------------------
// I/O ポート処理
// vm80a が IN/OUT 命令を発行すると io_req=1 になる
// --------------------------------------------------------------
static void handle_io(uint8_t port, bool is_write, uint8_t data)
{
    if (is_write) {
        switch (port) {
        case 0x01: // CONOUT
            con_out_buf[con_out_tail & 1023] = data;
            con_out_tail++;
            break;
        case 0x20: // WBOOT: CCP を初期イメージから復元
            for (int i = 0; i < (int)sizeof(saved_ccp); i++)
                top->cpm_top->ram[0xDC00 + i] = saved_ccp[i];
            break;
        case 0x10: { // DCMD: ディスクコマンド
            // disk_sector は BIOS SECTRAN が返す物理セクタ番号 (0-indexed, 0-25)
            uint32_t offset = (disk_track * 26 + disk_sector) * 128;
            if (data == 0) { // READ: disk → RAM
                for (int j = 0; j < 128 && offset + j < (uint32_t)disk_size; j++)
                    top->cpm_top->ram[(disk_dma + j) & 0xFFFF] = disk_image[offset + j];
            } else { // WRITE: RAM → disk
                for (int j = 0; j < 128 && offset + j < (uint32_t)disk_size; j++)
                    disk_image[offset + j] = top->cpm_top->ram[(disk_dma + j) & 0xFFFF];
            }
            break;
        }
        case 0x11: disk_track  = data;          break;
        case 0x12: disk_sector = data;          break;
        case 0x13: disk_dma    = (disk_dma & 0xFF00) | data; break;
        case 0x14: disk_dma    = (disk_dma & 0x00FF) | (data << 8); break;
        case 0xA1: { // ホストファイル転送（R.COM / W.COM）
            // r.com / w.com は C レジスタに BDOS 関数番号をセットして ~C を OUT する
            uint8_t cmd = (uint8_t)(~data);
            switch (cmd) {
            case 0x1A: // SET_DMA: 常に $0080 を使用するため noop
                last_a1_result = 0x00;
                break;
            case 0x0F: { // OPEN: ホストファイルを読み込み用に開く（R.COM）
                if (host_file) { fclose(host_file); host_file = nullptr; }
                std::string fname = fcb_to_filename();
                if (fname.find('/') != std::string::npos ||
                    fname.find('\\') != std::string::npos) {
                    last_a1_result = 0xFF; break;
                }
                host_file = fopen(fname.c_str(), "rb");
                last_a1_result = host_file ? 0x00 : 0xFF;
                if (!host_file)
                    fprintf(stderr, "[R] open failed: %s\n", fname.c_str());
                break;
            }
            case 0x16: { // CREATE: ホストファイルを書き込み用に開く（W.COM）
                if (host_file) { fclose(host_file); host_file = nullptr; }
                std::string fname = fcb_to_filename();
                if (fname.find('/') != std::string::npos ||
                    fname.find('\\') != std::string::npos) {
                    last_a1_result = 0xFF; break;
                }
                host_file = fopen(fname.c_str(), "wb");
                last_a1_result = host_file ? 0x00 : 0xFF;
                if (!host_file)
                    fprintf(stderr, "[W] create failed: %s\n", fname.c_str());
                break;
            }
            case 0x14: { // READ: ホスト → CP/M RAM $0080（128 バイト）
                if (!host_file) { last_a1_result = 0xFF; break; }
                uint8_t buf[128] = {};
                size_t n = fread(buf, 1, 128, host_file);
                if (n == 0) { last_a1_result = 0xFF; break; } // EOF
                for (int i = 0; i < 128; i++)
                    top->cpm_top->ram[0x0080 + i] = buf[i];
                last_a1_result = 0x00;
                break;
            }
            case 0x15: { // WRITE: CP/M RAM $0080 → ホスト（128 バイト）
                if (!host_file) { last_a1_result = 0xFF; break; }
                uint8_t buf[128];
                for (int i = 0; i < 128; i++)
                    buf[i] = (uint8_t)top->cpm_top->ram[0x0080 + i];
                size_t n = fwrite(buf, 1, 128, host_file);
                last_a1_result = (n == 128) ? 0x00 : 0xFF;
                break;
            }
            case 0x10: // CLOSE
                if (host_file) { fclose(host_file); host_file = nullptr; }
                last_a1_result = 0x00;
                break;
            default:
                last_a1_result = 0xFF;
                break;
            }
            // OUT 命令の次命令で A レジスタを参照するため acc に結果を書き込む
            top->cpm_top->cpu->acc = last_a1_result;
            break;
        }
        }
    } else {
        // IN 命令: トップモジュールの io_din に値を設定
        // (eval() 前に設定する必要があるため別途処理)
    }
}

static uint8_t read_io(uint8_t port)
{
    switch (port) {
    case 0x00: // CONIN
        if (con_in_head != con_in_tail) {
            uint8_t c = con_in_buf[con_in_head & 255];
            con_in_head++;
            return c;
        }
        return 0;
    case 0x02: // CONST
        return (con_in_head != con_in_tail) ? 1 : 0;
    case 0x10: // DSTS: 常に OK
        return 0;
    case 0xA1: // ホストファイル転送結果（R.COM / W.COM）
        return last_a1_result;
    }
    return 0xFF;
}

// --------------------------------------------------------------
// 公開 API (main_linux.cpp / Emscripten から呼ぶ)
// --------------------------------------------------------------
extern "C" {

// bios_path: bios.bin のパス
// cpm_path:  CCP+BDOS バイナリ（$DC00 に配置）のパス（NULL = 省略）
// dsk_path:  DSK イメージのパス（NULL = 省略）
EMSCRIPTEN_KEEPALIVE
int sim_init(const char* bios_path, const char* cpm_path, const char* dsk_path)
{
    // BIOS
    uint8_t bios_bin[3584] = {};
    int bios_size = 0;
    if (bios_path) {
        FILE* f = fopen(bios_path, "rb");
        if (!f) { fprintf(stderr, "cannot open BIOS: %s\n", bios_path); return -1; }
        bios_size = (int)fread(bios_bin, 1, sizeof(bios_bin), f);
        fclose(f);
    }

    // CCP+BDOS
    uint8_t cpm_bin[5632] = {};
    int cpm_size = 0;
    if (cpm_path) {
        FILE* f = fopen(cpm_path, "rb");
        if (!f) { fprintf(stderr, "cannot open CCP+BDOS: %s\n", cpm_path); return -1; }
        cpm_size = (int)fread(cpm_bin, 1, sizeof(cpm_bin), f);
        fclose(f);
    }

    // DSK
    if (dsk_path) {
        FILE* f = fopen(dsk_path, "rb");
        if (!f) { fprintf(stderr, "cannot open DSK: %s\n", dsk_path); return -1; }
        disk_size = (int)fread(disk_image, 1, sizeof(disk_image), f);
        fclose(f);
    }

    top = new Vcpm_top;

    // リセット前に RAM を配置
    load_cpm_image(bios_bin, bios_size, cpm_bin, cpm_size);

    // リセットパルス
    top->reset = 1;
    top->clk   = 0; top->eval();
    top->clk   = 1; top->eval();
    top->clk   = 0; top->eval();
    top->clk   = 1; top->eval();
    top->reset = 0;
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void step()
{
    // IN 命令: io_active && io_dbin の立ち上がりエッジでのみ read_io を呼ぶ。
    // io_dbin が複数ステップ連続して Hi になる場合に二重消費を防ぐ。
    bool cur_io_in = (top->io_active && top->io_dbin);
    if (cur_io_in && !prev_io_in_active)
        top->io_din = read_io(top->io_port);
    prev_io_in_active = cur_io_in;

    top->clk = 0; top->eval();
    top->clk = 1; top->eval();

    // IO 要求の立ち上がりで OUT 処理
    if (top->io_req && top->io_wr)
        handle_io(top->io_addr, true, top->io_dout);

    // ring buffer サンプリング
    ring[ring_head & (RING_SIZE - 1)] =
        ((uint32_t)top->io_addr        ) |
        ((uint32_t)top->io_dout  << 16 ) |
        ((uint32_t)top->io_req   << 24 ) |
        ((uint32_t)top->io_wr    << 25 );
    ring_head++;
}

EMSCRIPTEN_KEEPALIVE
void send_key(uint8_t ch)
{
    con_in_buf[con_in_tail & 255] = ch;
    con_in_tail++;
}

EMSCRIPTEN_KEEPALIVE
int get_display_char()
{
    if (con_out_head == con_out_tail) return -1;
    uint8_t c = con_out_buf[con_out_head & 1023];
    con_out_head++;
    return c;
}

EMSCRIPTEN_KEEPALIVE
uint16_t get_pc()
{
    return top ? (uint16_t)top->dbg_pc : 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t sim_read_byte(uint16_t addr)
{
    return top ? (uint8_t)top->cpm_top->ram[addr] : 0;
}

EMSCRIPTEN_KEEPALIVE
void load_disk(const uint8_t* data, int size)
{
    if (size > (int)sizeof(disk_image)) size = sizeof(disk_image);
    memcpy(disk_image, data, size);
    disk_size = size;
}

// ------------------------------------------------------------------
// sim_run_bin — 任意のバイナリを $0000 に配置して実行する
// prog: プログラムバイト列, prog_size: バイト数
// max_cycles: 最大クロック数（HLT 後はアイドル継続）
// 戻り値: CONOUT に出力したバイト数（con_out_buf に格納）
// ------------------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
int sim_run_bin(const uint8_t* prog, int prog_size, int max_cycles)
{
    con_out_head = con_out_tail = 0;
    con_in_head  = con_in_tail  = 0;

    top = new Vcpm_top;
    memset(top->cpm_top->ram.m_storage, 0, sizeof(top->cpm_top->ram.m_storage));
    for (int i = 0; i < prog_size && i < 0x10000; i++)
        top->cpm_top->ram[i] = prog[i];

    top->io_din = 0;
    top->reset  = 1;
    top->clk    = 0; top->eval();
    top->clk    = 1; top->eval();
    top->clk    = 0; top->eval();
    top->clk    = 1; top->eval();
    top->reset  = 0;

    int last_out_cycle = -1;
    bool prev_in = false;
    for (int c = 0; c < max_cycles; c++) {
        bool cur_in = (top->io_active && top->io_dbin);
        if (cur_in && !prev_in)
            top->io_din = read_io(top->io_port);
        prev_in = cur_in;

        top->clk = 0; top->eval();
        top->clk = 1; top->eval();

        int prev_tail = con_out_tail;
        if (top->io_req && top->io_wr)
            handle_io(top->io_addr, true, top->io_dout);
        if (con_out_tail != prev_tail)
            last_out_cycle = c;

        // 出力が 1 文字以上あり、最後の出力から 50000 サイクル無変化 → 打ち切り
        if (last_out_cycle >= 0 && (c - last_out_cycle) > 50000) break;
    }

    delete top;
    top = nullptr;
    return con_out_tail;
}

// ------------------------------------------------------------------
// sim_test — vm80a 単体スモークテスト
// MVI A,'H'; OUT $01; MVI A,'i'; OUT $01; HLT を実行し
// 出力バイト数を返す。戻り値 >= 2 で PASS。
// ------------------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
int sim_test(int max_cycles)
{
    static const uint8_t prog[] = {
        0x3E, 'H',  0xD3, 0x01,   // MVI A,'H' / OUT $01
        0x3E, 'i',  0xD3, 0x01,   // MVI A,'i' / OUT $01
        0x76,                      // HLT
    };

    int n = sim_run_bin(prog, (int)sizeof(prog), max_cycles);

    fprintf(stderr, "[test] sim_test: %d bytes out (", n);
    for (int i = 0; i < n; i++)
        fprintf(stderr, "%c", (char)(con_out_buf[i & 1023] & 0x7F));
    fprintf(stderr, ")\n");

    return n;
}

// ------------------------------------------------------------------
// sim_run_bare — ベアメタル実行（アイドルタイムアウト設定可）
// prog を 0x0000 に配置してリセット後に実行。
// idle_timeout_cycles: 最後の出力から無変化で打ち切るサイクル数
// 戻り値: CONOUT 出力バイト数
// ------------------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
int sim_run_bare(const uint8_t* prog, int prog_size,
                 long long max_cycles, int idle_timeout_cycles)
{
    con_out_head = con_out_tail = 0;
    con_in_head  = con_in_tail  = 0;

    top = new Vcpm_top;
    memset(top->cpm_top->ram.m_storage, 0, sizeof(top->cpm_top->ram.m_storage));
    for (int i = 0; i < prog_size && i < 0x10000; i++)
        top->cpm_top->ram[i] = prog[i];

    top->io_din = 0;
    top->reset  = 1;
    top->clk    = 0; top->eval();
    top->clk    = 1; top->eval();
    top->clk    = 0; top->eval();
    top->clk    = 1; top->eval();
    top->reset  = 0;

    long long last_out_cycle = -1;
    bool prev_in = false;
    for (long long c = 0; c < max_cycles; c++) {
        bool cur_in = (top->io_active && top->io_dbin);
        if (cur_in && !prev_in)
            top->io_din = read_io(top->io_port);
        prev_in = cur_in;

        top->clk = 0; top->eval();
        top->clk = 1; top->eval();

        int prev_tail = con_out_tail;
        if (top->io_req && top->io_wr)
            handle_io(top->io_addr, true, top->io_dout);
        if (con_out_tail != prev_tail)
            last_out_cycle = c;

        if (last_out_cycle >= 0 && (c - last_out_cycle) > idle_timeout_cycles) break;
    }

    delete top;
    top = nullptr;
    return con_out_tail;
}

EMSCRIPTEN_KEEPALIVE uint32_t* get_ring_ptr()  { return ring; }
EMSCRIPTEN_KEEPALIVE uint32_t  get_head()       { return ring_head; }
EMSCRIPTEN_KEEPALIVE int       get_ring_size()  { return RING_SIZE; }

// WASM 用ラッパー: JS から const char* を直接渡せないため埋め込みパスを使用
EMSCRIPTEN_KEEPALIVE
int sim_init_wasm() {
    return sim_init("/bios.bin", nullptr, "/cpm22.dsk");
}

} // extern "C"
