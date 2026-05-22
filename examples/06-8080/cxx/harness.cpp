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
#include <chrono>

static Vcpm_top* top;

// ring buffer: 2 uint32_t per sample (Word0 + Word1)
// Word 0:
// [ 7: 0] = io_addr (I/O ポート番号)
// [    8] = DBIN    (データバス入力イネーブル)
// [    9] = SYNC    (マシンサイクル開始パルス)
// [   10] = WR_N    (ライトストローブ、アクティブ Low)
// [   11] = HLDA    (ホールドアクノリッジ)
// [   12] = WAIT    (ウェイトステート中)
// [   13] = INTE    (割り込みイネーブル)
// [   14] = MEMR    (メモリリード = !cycle_io && DBIN)
// [   15] = MEMW    (メモリライト = !cycle_io && !WR_N)
// [23:16] = io_dout (データバス値)
// [   24] = io_req  (I/O リクエストパルス)
// [   25] = io_wr   (1=OUT, 0=IN)
// [31:26] = t_state (T ステート番号: SYNC=1 で 1 にリセット、以降毎クロック加算)
// Word 4:
// [ 7: 0] = status_byte (SYNC でラッチした 8080 ステータスバイト)
// [15: 8] = ir          (命令レジスタ — M1 フェッチ後に確定するオペコード)
// [31:16] = (予約)
// Word 1:
// [15: 0] = cpu_addr (16 ビットアドレスバス)
// [23:16] = io_din   (I/O 読みデータ — IN 命令でCPUが受け取る値)
// [31:24] = dbg_a    (アキュムレータ A)
// Word 2:
// [ 7: 0] = dbg_f    (フラグレジスタ F)
// [15: 8] = B        (レジスタ B)
// [23:16] = C        (レジスタ C)
// [31:24] = D        (レジスタ D)
// Word 3:
// [ 7: 0] = E        (レジスタ E)
// [15: 8] = H        (レジスタ H)
// [23:16] = L        (レジスタ L)
// [31:24] = dbus     (CPU データバス: MEMR=RAMデータ, MEMW/IOOUT=io_dout, IOIN=io_din)
static const int RING_SIZE = 4096;
static uint32_t  ring[RING_SIZE * 6];  // 6 ワード/サンプル
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

// マルチドライブディスクイメージ (IBM 3740 SSSD: 77×26×128 = 256,256 bytes/ドライブ)
static const int N_DRIVES   = 4;
static const int DISK_BYTES = 77 * 26 * 128;

static uint8_t   disk_image[N_DRIVES][DISK_BYTES];
static int       disk_size[N_DRIVES];
static int       cur_drive   = 0;
static bool      disk_dirty[N_DRIVES];     // WRITE が発生したドライブを記録
static bool      disk_readonly[N_DRIVES];  // 読み取り専用フラグ (--ro)

// ディスクアクセス状態
static int       disk_track  = 0;
static int       disk_sector = 0;
static uint16_t  disk_dma    = 0x0080;

// WBOOT 時に CCP+BDOS を復元するための保存イメージ (0xDC00-0xF1FF = 5.5KB)
// BDS C 起動コードは SP=BDOS+6=$E406 にセットするため、CALL スタックが
// $E400-$E405 (BDOS 先頭) を上書きする。実機 CP/M は WBOOT で CCP+BDOS を
// ディスクから再読み込みするため、ここでも同じ範囲を復元する。
static uint8_t   saved_ccp[0x1600];

// ── デバッグ機能 ─────────────────────────────────────────────────
// レジスタスナップショット: [A, F, B, C, D, E, H, L, SPH, SPL, PCH, PCL]
static uint8_t  reg_snap[12];

// リングバッファフリーズ (true = 新規書き込み停止)
static bool     ring_frozen = false;
// Logic Analyzer 有効フラグ (false = ring 書き込みをスキップして速度向上)
static bool     la_enabled  = true;

// トリガー機構
// trig_type: 0=off, 1=io_req(ポートフィルタ), 2=call(ターゲットフィルタ), 3=ret(ターゲットフィルタ)
//            4=edge(word/bit/dir), 6=value(word/mask/cmp)
static int      trig_type = 0;
static uint8_t  trig_port = 0xFF;   // type=1: 0xFF = 任意ポート
static uint16_t trig_pc   = 0;      // type=2,3: 0 = 任意アドレス
static bool     trig_hit  = false;

// コールトレースログ (リング、64エントリ)
// buf[i*2+0] = from_pc (bits 15:0) | is_ret (bit 16)
// buf[i*2+1] = to_addr (bits 15:0)
static const int CALL_LOG_SIZE = 64;
static uint32_t call_log_buf[CALL_LOG_SIZE * 2];
static uint32_t call_log_head = 0;

// SYNC 立ち上がり検出用
static bool     prev_dbg_sync = false;

// T ステートカウンタ
// SYNC=1 のクロックを T1 として 1 にリセット、以降毎クロック加算（最大 63）
static uint8_t  t_state_cnt = 0;
// 現在のマシンサイクルタイプ（SYNC=1 のクロックで cpu_dout = ステータスバイトをラッチ）
static uint8_t  current_status = 0;

// エッジトリガー追加パラメータ (trig_type=4 時に使用)
static int      trig_edge_word = 0;    // Word インデックス (0-4)
static int      trig_edge_bit  = 24;   // ビット番号
static int      trig_edge_dir  = 0;    // 0=立ち上がり, 1=立ち下がり
static uint32_t prev_edge_val  = 0;    // 前回のビット値

// 値トリガー追加パラメータ (trig_type=6 時に使用)
static int      trig_val_word = 1;          // Word インデックス (0-5)
static uint32_t trig_val_mask = 0x0000FFFF; // ビットマスク
static uint32_t trig_val_cmp  = 0;          // 比較値（mask 済み）

// 命令トリガー追加パラメータ (trig_type=5 時に使用)
// 0xFFFF=任意 PC, 0xFF=任意オペコード

// レジスタ値トリガー追加パラメータ (trig_type=7 時に使用)
// reg_id: 0=A 1=F 2=B 3=C 4=D 5=E 6=H 7=L 8=SP 9=PC 10=BC 11=DE 12=HL
static int      trig_reg_id  = 0;
static uint32_t trig_reg_val = 0;
// 0xFFFF=任意 PC, 0xFF=任意オペコード
static uint16_t trig_instr_pc  = 0xFFFF;
static uint8_t  trig_instr_opc = 0xFF;

// ポストトリガー: 発火後も trig_post_delay クロック分だけ ring 書き込みを継続する
static uint32_t trig_post_delay = 0;     // 発火後に記録するクロック数（0 = 即座に Freeze）
static bool     trig_fired      = false; // 発火済みフラグ（Freeze 前の中間状態）
static uint32_t trig_fire_head  = 0;     // 発火時の ring_head 値（赤縦線の位置）

// 前回の io_req 値 (立ち上がり検出用)
static uint8_t   prev_io_req = 0;
// IN 命令の二重読み取りを防ぐため、前回の io_active && io_dbin 状態を保持
static bool      prev_io_in_active = false;


// サイクルカウンタ (T ステート)
// OUT 30h でリセット。IN 30h でラッチ＆bits 0-7 取得。IN 31h-33h で残バイト取得。
static uint32_t  cycle_count = 0;
static uint32_t  cycle_latch = 0;

// 等価クロック周波数計測 (Hz 精度)
// OUT 34h: タイマー開始  OUT 38h: 計算＆ラッチ
// IN 34h/35h: 総 MHz  IN 36h: kHz 端数 0-999  IN 37h: Hz 端数 0-999
static std::chrono::steady_clock::time_point freq_start_tp;
static uint32_t  freq_start_cyc = 0;
static uint64_t  freq_latch_hz  = 0;

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

    // WBOOT 用に CCP+BDOS (0xDC00-0xF1FF) を保存
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
        case 0x20: // WBOOT: CCP+BDOS を初期イメージから復元
            for (int i = 0; i < (int)sizeof(saved_ccp); i++)
                top->cpm_top->ram[0xDC00 + i] = saved_ccp[i];
            break;
        case 0x10: { // DCMD: ディスクコマンド
            // disk_sector は BIOS SECTRAN が返す物理セクタ番号 (0-indexed, 0-25)
            uint32_t offset = (uint32_t)(disk_track * 26 + disk_sector) * 128;
            if (data == 0) { // READ: disk → RAM
                for (int j = 0; j < 128 && offset + j < (uint32_t)disk_size[cur_drive]; j++)
                    top->cpm_top->ram[(disk_dma + j) & 0xFFFF] = disk_image[cur_drive][offset + j];
            } else { // WRITE: RAM → disk
                if (!disk_readonly[cur_drive]) {
                    for (int j = 0; j < 128 && offset + j < (uint32_t)disk_size[cur_drive]; j++)
                        disk_image[cur_drive][offset + j] = top->cpm_top->ram[(disk_dma + j) & 0xFFFF];
                    disk_dirty[cur_drive] = true;
                }
            }
            break;
        }
        case 0x11: disk_track  = data;          break;
        case 0x12: disk_sector = data;          break;
        case 0x15: // DDRV: ドライブ選択 (BIOS SELDSK から通知)
            cur_drive = (data < N_DRIVES) ? (int)data : 0;
            break;
        case 0x13: disk_dma    = (disk_dma & 0xFF00) | data; break;
        case 0x14: disk_dma    = (disk_dma & 0x00FF) | (data << 8); break;
        case 0x30: cycle_count = 0; cycle_latch = 0; break;  // reset counter
        case 0x34:  // freq_start: ウォールクロック + サイクルカウンタを記録
            freq_start_tp  = std::chrono::steady_clock::now();
            freq_start_cyc = cycle_count;
            break;
        case 0x38: {  // freq_latch: 経過時間を計算して Hz を確定
            auto now = std::chrono::steady_clock::now();
            auto ns  = std::chrono::duration_cast<std::chrono::nanoseconds>(
                           now - freq_start_tp).count();
            uint64_t dc = (uint64_t)(cycle_count - freq_start_cyc);
            freq_latch_hz = (ns > 0) ? (dc * 1000000000ULL / (uint64_t)ns) : 0;
            break;
        }
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
    case 0x30: cycle_latch = cycle_count; return (uint8_t)(cycle_latch        & 0xFF);
    case 0x31:                            return (uint8_t)((cycle_latch >>  8) & 0xFF);
    case 0x32:                            return (uint8_t)((cycle_latch >> 16) & 0xFF);
    case 0x33:                            return (uint8_t)((cycle_latch >> 24) & 0xFF);
    case 0x34: return (uint8_t)( (freq_latch_hz / 1000000)          & 0xFF);  // MHz lo
    case 0x35: return (uint8_t)(((freq_latch_hz / 1000000) >>  8)  & 0xFF);  // MHz hi
    case 0x36: return (uint8_t)(((freq_latch_hz % 1000000) / 1000) & 0xFF);  // kHz 端数 0-999
    case 0x37: return (uint8_t)( (freq_latch_hz % 1000)            & 0xFF);  // Hz 端数 0-999
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

    // ディスク — 全ドライブをブランク (IBM 3740 初期値: 0xE5) で初期化
    memset(disk_image, 0xE5, sizeof(disk_image));
    for (int i = 0; i < N_DRIVES; i++)
        disk_size[i] = DISK_BYTES;

    // ドライブ A にディスクイメージをロード
    if (dsk_path) {
        FILE* f = fopen(dsk_path, "rb");
        if (!f) { fprintf(stderr, "cannot open DSK: %s\n", dsk_path); return -1; }
        if (fread(disk_image[0], 1, DISK_BYTES, f) == 0)
            fprintf(stderr, "warning: DSK read 0 bytes: %s\n", dsk_path);
        fclose(f);
    }

    // I/O バッファ・ディスクアクセス状態をリセット
    con_in_head  = con_in_tail  = 0;
    con_out_head = con_out_tail = 0;
    ring_head = 0;
    cur_drive = 0;
    memset(disk_dirty,    0, sizeof(disk_dirty));
    memset(disk_readonly, 0, sizeof(disk_readonly));
    disk_track = 0; disk_sector = 0; disk_dma = 0x0080;
    prev_io_req      = 0;
    prev_io_in_active = false;
    if (host_file) { fclose(host_file); host_file = nullptr; }
    last_a1_result = 0x00;
    cycle_count = 0; cycle_latch = 0;
    freq_start_tp  = std::chrono::steady_clock::now();
    freq_start_cyc = 0; freq_latch_hz  = 0;
    // デバッグ状態をリセット
    ring_frozen      = false;
    trig_type        = 0;
    trig_port        = 0xFF;
    trig_pc          = 0;
    trig_hit         = false;
    trig_fired       = false;
    trig_fire_head   = 0;
    trig_post_delay  = 0;
    call_log_head    = 0;
    memset(call_log_buf, 0, sizeof(call_log_buf));
    memset(reg_snap,     0, sizeof(reg_snap));
    prev_dbg_sync = false;
    t_state_cnt   = 0;
    current_status = 0;
    trig_edge_word = 0;
    trig_edge_bit  = 24;
    trig_edge_dir  = 0;
    prev_edge_val  = 0;

    if (top) { top->final(); delete top; }
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
    cycle_count++;

    // T ステートカウンタ更新: SYNC=1 は新マシンサイクルの T1
    if (top->dbg_sync)
        t_state_cnt = 1;
    else if (t_state_cnt < 63)
        t_state_cnt++;

    // マシンサイクルタイプを SYNC でラッチ（SYNC 中は cpu_dout = ステータスバイト）
    if (top->dbg_sync)
        current_status = (uint8_t)top->dbg_a;

    // IO 要求の立ち上がりで OUT 処理
    if (top->io_req && top->io_wr)
        handle_io(top->io_addr, true, top->io_dout);

    // ring buffer サンプリング (フリーズ中・LA無効時は書き込まない)
    if (!ring_frozen) {
        if (la_enabled) {
        uint32_t ridx = (ring_head & (RING_SIZE - 1)) * 6;
        // IO サイクル中はレジスタ保持値の代わりに組み合わせ信号を使う。
        // io_addr / io_dout は wr_n 立ち上がり時のみ更新されるため、
        // M5 サイクル中は前の OUT の値を保持し続けてしまう。
        //   port: io_active=1 なら cpu_addr[7:0] (io_port) を使用
        //   data: IO OUT サイクル (status[4]=1) なら cpu_dout (= xr = 出力データ) を使用
        uint8_t samp_port = top->io_active
                            ? (uint8_t)top->io_port   // 組み合わせ: 現在のポート番号
                            : (uint8_t)top->io_addr;  // 保持値
        // SYNC=1 のクロックでは cpu_dout = ステータスバイトのため除外し、
        // SYNC 後 T2 以降（cpu_dout = xr = アキュムレータ）を使う
        uint8_t samp_data = (top->io_active && (current_status & 0x10u) && !top->dbg_sync)
                            ? (uint8_t)top->dbg_a     // IO OUT T2+: cpu_dout = xr = 出力データ
                            : (uint8_t)top->io_dout;  // 保持値 (SYNC クロック含む)
        ring[ridx] =
            ((uint32_t)samp_port      ) |          // [ 7: 0] I/O ポート
            ((uint32_t)top->io_dbin   <<  8) |     // [    8] DBIN
            ((uint32_t)top->dbg_sync  <<  9) |     // [    9] SYNC
            ((uint32_t)top->dbg_wr_n  << 10) |     // [   10] WR_N
            ((uint32_t)top->dbg_hlda  << 11) |     // [   11] HLDA
            ((uint32_t)top->dbg_wait  << 12) |     // [   12] WAIT
            ((uint32_t)top->dbg_inte  << 13) |     // [   13] INTE
            ((uint32_t)top->dbg_memr  << 14) |     // [   14] MEMR
            ((uint32_t)top->dbg_memw  << 15) |     // [   15] MEMW
            ((uint32_t)samp_data      << 16) |     // [23:16] データ
            ((uint32_t)top->io_req    << 24) |     // [   24] io_req
            ((uint32_t)top->io_wr     << 25) |     // [   25] io_wr
            ((uint32_t)t_state_cnt    << 26);      // [31:26] T ステート番号
        ring[ridx + 1] =
            ((uint32_t)(top->dbg_pc & 0xFFFF)) |  // [15: 0] アドレスバス
            ((uint32_t)top->io_din  << 16)       | // [23:16] I/O 読みデータ
            // acc は vm80a 内部レジスタ直接参照（dbg_a=cpu_dout はステータスバイト混在のため不可）
            ((uint32_t)top->cpm_top->cpu->acc << 24); // [31:24] アキュムレータ A
        {
            // Word 2: 全レジスタ F, B, C, D
            auto* cpu  = top->cpm_top->cpu;
            // F フラグを PSW 個別ビットから再構成
            // dbg_f = {7'b0, cpu_wr_n} で実 F レジスタとは無関係のため直接アクセス
            uint8_t f_byte =
                ((cpu->__PVT__psw_s  ? 1u : 0u) << 7) |
                ((cpu->__PVT__psw_z  ? 1u : 0u) << 6) |
                ((cpu->__PVT__psw_ac ? 1u : 0u) << 4) |
                ((cpu->__PVT__psw_p  ? 1u : 0u) << 2) |
                (1u << 1) |
                ((cpu->__PVT__psw_c  ? 1u : 0u) << 0);
            uint16_t bc = (uint16_t)cpu->__PVT__r16_bc;
            // xchg_dh フラグで物理 r16_hl/r16_de の論理マッピングが入れ替わる。
            // RESET後 xchg_dh=0: 論理HL=物理r16_de、論理DE=物理r16_hl
            // XCHG後  xchg_dh=1: 論理HL=物理r16_hl、論理DE=物理r16_de  (通常マッピング)
            bool xchg = (bool)cpu->__PVT__xchg_dh;
            uint16_t logical_de = xchg ? (uint16_t)cpu->__PVT__r16_de : (uint16_t)cpu->__PVT__r16_hl;
            uint16_t logical_hl = xchg ? (uint16_t)cpu->__PVT__r16_hl : (uint16_t)cpu->__PVT__r16_de;
            ring[ridx + 2] =
                ((uint32_t)f_byte             ) |  // [ 7: 0] F フラグ (PSW 個別ビットから再構成)
                ((uint32_t)((bc >> 8) & 0xFF) <<  8) | // [15: 8] B
                ((uint32_t)(bc        & 0xFF) << 16) | // [23:16] C
                ((uint32_t)((logical_de >> 8) & 0xFF) << 24);  // [31:24] D (論理DEの上位バイト)
            // Word 3: E, H, L, CPU データバス
            // dbus: MEMR=RAMデータ, IO OUT T2+=cpu_dout, IO IN=io_din, その他=io_dout保持
            // SYNC=1 クロックは cpu_dout=ステータスバイトのため除外
            // NOTE: ram[dbg_pc] ではなく cpu_din 組み合わせ論理を直接使う。
            //   cpu_dbin と cpu_addr の T ステートずれを回避するため。
            uint8_t dbus;
            if (top->dbg_memr) {
                // cpu_din は always@(*) で ram[cpu_addr] に直結 → タイミング一致保証
                dbus = (uint8_t)top->cpm_top->__PVT__cpu_din;
            } else if (top->io_active && (current_status & 0x10u) && !top->dbg_sync) {
                dbus = (uint8_t)top->dbg_a;  // IO OUT T2+: cpu_dout = xr = 出力データ
            } else if (top->io_req && !top->io_wr) {
                dbus = (uint8_t)top->io_din; // IO IN: ポートが返したデータ
            } else {
                dbus = (uint8_t)top->io_dout; // 保持値
            }
            ring[ridx + 3] =
                ((uint32_t)(logical_de        & 0xFF)      ) |  // [ 7: 0] E (論理DEの下位バイト)
                ((uint32_t)((logical_hl >> 8) & 0xFF) <<  8) | // [15: 8] H (論理HLの上位バイト)
                ((uint32_t)(logical_hl        & 0xFF) << 16) | // [23:16] L (論理HLの下位バイト)
                ((uint32_t)dbus               << 24);  // [31:24] CPU データバス
        }
        ring[ridx + 4] =
            (uint32_t)current_status |                         // [ 7: 0] ステータスバイト
            ((uint32_t)top->cpm_top->cpu->__PVT__i << 8);     // [15: 8] 命令レジスタ (IR)
        {
            // Word 5: PC レジスタ + SP レジスタ（vm80a 内部レジスタから直接取得）
            auto* cpu5 = top->cpm_top->cpu;
            ring[ridx + 5] =
                ((uint32_t)(uint16_t)cpu5->__PVT__r16_pc      ) |  // [15: 0] PC
                ((uint32_t)(uint16_t)cpu5->__PVT__r16_sp << 16);   // [31:16] SP
        }
        } // end if (la_enabled)
        ring_head++;
    }

    // ── コールトレース & トリガー ──
    bool cur_sync = (bool)top->dbg_sync;
    if (cur_sync && !prev_dbg_sync) {
        // SYNC 立ち上がりエッジ: 新しいマシンサイクル開始
        // PC アドレスにある命令バイトを読んで CALL/RET を検出する
        uint16_t pc = (uint16_t)top->dbg_pc;
        uint8_t  op = (uint8_t)top->cpm_top->ram[pc];
        bool is_call = (op == 0xCD) || ((op & 0xC7) == 0xC4);
        bool is_ret  = (op == 0xC9) || ((op & 0xC7) == 0xC0);
        if (is_call || is_ret) {
            uint32_t idx = (call_log_head % CALL_LOG_SIZE) * 2;
            uint16_t target = 0;
            if (is_call) {
                uint8_t lo = (uint8_t)top->cpm_top->ram[(uint16_t)(pc + 1)];
                uint8_t hi = (uint8_t)top->cpm_top->ram[(uint16_t)(pc + 2)];
                target = (uint16_t)((uint16_t)lo | ((uint16_t)hi << 8));
            } else {
                // RET: スタックトップがリターンアドレス
                auto* cpu = top->cpm_top->cpu;
                uint16_t sp  = (uint16_t)cpu->__PVT__r16_sp;
                uint8_t  rlo = (uint8_t)top->cpm_top->ram[sp];
                uint8_t  rhi = (uint8_t)top->cpm_top->ram[(uint16_t)(sp + 1)];
                target = (uint16_t)((uint16_t)rlo | ((uint16_t)rhi << 8));
            }
            call_log_buf[idx    ] = (uint32_t)pc | ((uint32_t)(is_ret ? 1u : 0u) << 16);
            call_log_buf[idx + 1] = (uint32_t)target;
            call_log_head++;
            // call/ret トリガーチェック
            if (!trig_fired) {
                bool match = false;
                if (is_call && trig_type == 2 && (trig_pc == 0 || trig_pc == target)) match = true;
                if (is_ret  && trig_type == 3 && (trig_pc == 0 || trig_pc == target)) match = true;
                if (match) { trig_fired = true; trig_fire_head = ring_head; }
            }
        }
        // On Instruction トリガー (type=5): M1 フェッチ時に PC・オペコードでフィルタ
        if (!trig_fired && trig_type == 5 && (current_status & 0x20u)) {
            bool pc_match  = (trig_instr_pc  == 0xFFFF) || (pc  == trig_instr_pc);
            bool opc_match = (trig_instr_opc == 0xFF  ) || (op  == trig_instr_opc);
            if (pc_match && opc_match) { trig_fired = true; trig_fire_head = ring_head; }
        }
    }
    prev_dbg_sync = cur_sync;

    // I/O トリガーチェック（ring 書き込み後に判定 → トリガーイベントをリングに含む）
    if (!trig_fired && trig_type == 1 && top->io_req) {
        if (trig_port == 0xFF || trig_port == (uint8_t)top->io_addr) {
            trig_fired = true; trig_fire_head = ring_head;
        }
    }

    // エッジトリガーチェック (type=4) — ring 書き込み (la_enabled) が必要
    if (la_enabled && !trig_fired && trig_type == 4) {
        // 今書き込んだサンプルの Word を直接参照（ring_head は既にインクリメント済み）
        uint32_t samp_ridx = ((ring_head - 1) & (RING_SIZE - 1)) * 6;
        uint32_t cur = (ring[samp_ridx + trig_edge_word] >> trig_edge_bit) & 1u;
        bool hit = trig_edge_dir ? (prev_edge_val && !cur) : (!prev_edge_val && cur);
        prev_edge_val = cur;
        if (hit) { trig_fired = true; trig_fire_head = ring_head; }
    }

    // 値トリガーチェック (type=6) — ring 書き込み (la_enabled) が必要
    if (la_enabled && !trig_fired && trig_type == 6 && !ring_frozen) {
        uint32_t samp_ridx = ((ring_head - 1) & (RING_SIZE - 1)) * 6;
        if ((ring[samp_ridx + trig_val_word] & trig_val_mask) == trig_val_cmp) {
            trig_fired = true; trig_fire_head = ring_head;
        }
    }

    // レジスタ値トリガーチェック (type=7): 毎クロック レジスタ値と比較
    // reg_id: 0=A 1=F 2=B 3=C 4=D 5=E 6=H 7=L 8=SP 9=PC 10=BC 11=DE 12=HL 13=IR
    if (!trig_fired && trig_type == 7) {
        auto* cpu7 = top->cpm_top->cpu;
        uint32_t regval = 0;
        switch (trig_reg_id) {
        case  0: regval = (uint32_t)cpu7->acc;                         break;
        case  1: regval = (uint32_t)top->dbg_f;                        break;
        case  2: regval = ((uint32_t)cpu7->__PVT__r16_bc >>  8) & 0xFF; break;
        case  3: regval =  (uint32_t)cpu7->__PVT__r16_bc        & 0xFF; break;
        case  4: regval = ((uint32_t)cpu7->__PVT__r16_de >>  8) & 0xFF; break;
        case  5: regval =  (uint32_t)cpu7->__PVT__r16_de        & 0xFF; break;
        case  6: regval = ((uint32_t)cpu7->__PVT__r16_hl >>  8) & 0xFF; break;
        case  7: regval =  (uint32_t)cpu7->__PVT__r16_hl        & 0xFF; break;
        case  8: regval = (uint32_t)cpu7->__PVT__r16_sp & 0xFFFF;       break;
        case  9: regval = (uint32_t)cpu7->__PVT__r16_pc & 0xFFFF;       break;
        case 10: regval = (uint32_t)cpu7->__PVT__r16_bc & 0xFFFF;       break;
        case 11: regval = (uint32_t)cpu7->__PVT__r16_de & 0xFFFF;       break;
        case 12: regval = (uint32_t)cpu7->__PVT__r16_hl & 0xFFFF;       break;
        case 13: regval = (uint32_t)cpu7->__PVT__i      & 0xFF;         break; // IR
        default: break;
        }
        uint32_t cmpval = trig_reg_val & (trig_reg_id <= 7 || trig_reg_id == 13 ? 0xFFu : 0xFFFFu);
        if (regval == cmpval) { trig_fired = true; trig_fire_head = ring_head; }
    }

    // ポストトリガーチェック: 発火済みかつ遅延クロック数を満たしたら Freeze
    if (trig_fired && !trig_hit) {
        if (ring_head - trig_fire_head >= trig_post_delay) {
            trig_hit = true;
            ring_frozen = true;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void sim_run_n(int n) {
    for (int i = 0; i < n; i++) step();
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

// RAM に 1 バイト書き込む（テスト用: sim_init 後に小さなテストプログラムをポークする）
EMSCRIPTEN_KEEPALIVE
void sim_poke(uint16_t addr, uint8_t val)
{
    mem[addr] = val;
    if (top) top->cpm_top->ram[addr] = val;
}

EMSCRIPTEN_KEEPALIVE
void load_disk_drive(int drive, const uint8_t* data, int size)
{
    if (drive < 0 || drive >= N_DRIVES) return;
    if (size > DISK_BYTES) size = DISK_BYTES;
    memcpy(disk_image[drive], data, size);
    disk_size[drive] = size;
}

EMSCRIPTEN_KEEPALIVE
void load_disk(const uint8_t* data, int size)
{
    load_disk_drive(0, data, size);
}

EMSCRIPTEN_KEEPALIVE
int sim_load_disk_file(int drive, const char* path)
{
    if (drive < 0 || drive >= N_DRIVES) return -1;
    FILE* f = fopen(path, "rb");
    if (!f) { fprintf(stderr, "cannot open disk[%d]: %s\n", drive, path); return -1; }
    if (fread(disk_image[drive], 1, DISK_BYTES, f) == 0 && !feof(f))
        fprintf(stderr, "disk[%d] read error: %s\n", drive, path);
    disk_size[drive] = DISK_BYTES;
    fclose(f);
    return 0;
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
EMSCRIPTEN_KEEPALIVE int       get_ring_words() { return 6; }

EMSCRIPTEN_KEEPALIVE int      sim_get_cur_drive()   { return cur_drive; }
EMSCRIPTEN_KEEPALIVE int      sim_get_disk_track()  { return disk_track; }
EMSCRIPTEN_KEEPALIVE int      sim_get_disk_sector() { return disk_sector; }
EMSCRIPTEN_KEEPALIVE uint16_t sim_get_disk_dma()    { return disk_dma; }
EMSCRIPTEN_KEEPALIVE int      sim_con_in_space()     { return 255 - (con_in_tail - con_in_head); }
EMSCRIPTEN_KEEPALIVE uint32_t sim_get_cycle_count() { return cycle_count; }

// WASM 用ラッパー: JS から const char* を直接渡せないため埋め込みパスを使用
EMSCRIPTEN_KEEPALIVE
int sim_init_wasm() {
    return sim_init("/bios.bin", "/cpm22.bin", "/cpm22.dsk");
}

// ディスク構成付きリセット
// disk_id=0: A:=cpm22.dsk, B:-D:=ブランク
// disk_id=1: A:=cpm22.dsk, B:=bdsc.dsk, C:-D:=ブランク
// disk_id=2: A:-D:=ブランク
EMSCRIPTEN_KEEPALIVE
int sim_init_disk(int disk_id) {
    if (disk_id == 2) {
        return sim_init("/bios.bin", "/cpm22.bin", nullptr);
    }
    int r = sim_init("/bios.bin", "/cpm22.bin", "/cpm22.dsk");
    if (r != 0) return r;
    if (disk_id == 1) {
        FILE* f = fopen("/bdsc.dsk", "rb");
        if (f) {
            if (fread(disk_image[1], 1, DISK_BYTES, f) == 0)
                fprintf(stderr, "warning: bdsc.dsk read 0 bytes\n");
            fclose(f);
        }
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* sim_get_disk_ptr(int drive) {
    if (drive < 0 || drive >= N_DRIVES) return nullptr;
    return disk_image[drive];
}

EMSCRIPTEN_KEEPALIVE
int sim_get_disk_size(int drive) { (void)drive; return DISK_BYTES; }

EMSCRIPTEN_KEEPALIVE
void sim_clear_disk_dirty(int drive) {
    if (drive >= 0 && drive < N_DRIVES) disk_dirty[drive] = false;
}

EMSCRIPTEN_KEEPALIVE
void sim_set_disk_readonly(int drive, bool ro)
{
    if (drive >= 0 && drive < N_DRIVES) disk_readonly[drive] = ro;
}

EMSCRIPTEN_KEEPALIVE
bool sim_get_disk_dirty(int drive)
{
    return (drive >= 0 && drive < N_DRIVES) && disk_dirty[drive];
}

EMSCRIPTEN_KEEPALIVE
int sim_save_disk(int drive, const char* path)
{
    if (drive < 0 || drive >= N_DRIVES) return -1;
    FILE* f = fopen(path, "wb");
    if (!f) { fprintf(stderr, "cannot save disk[%d]: %s\n", drive, path); return -1; }
    size_t n = fwrite(disk_image[drive], 1, DISK_BYTES, f);
    fclose(f);
    if (n != (size_t)DISK_BYTES) {
        fprintf(stderr, "disk[%d] write incomplete: %s\n", drive, path);
        return -1;
    }
    disk_dirty[drive] = false;
    return 0;
}

// ── デバッグ: レジスタスナップショット ──────────────────────────
// 戻り値: 12 バイトバッファ [A, F, B, C, D, E, H, L, SPH, SPL, PCH, PCL]
// F フォーマット: S Z 0 AC 0 P 1 C  (Intel 8080 標準)
EMSCRIPTEN_KEEPALIVE
uint8_t* sim_snap_regs() {
    if (!top) { memset(reg_snap, 0, sizeof(reg_snap)); return reg_snap; }
    auto* cpu = top->cpm_top->cpu;
    uint8_t f =
        ((cpu->__PVT__psw_s  ? 1u : 0u) << 7) |
        ((cpu->__PVT__psw_z  ? 1u : 0u) << 6) |
        ((cpu->__PVT__psw_ac ? 1u : 0u) << 4) |
        ((cpu->__PVT__psw_p  ? 1u : 0u) << 2) |
        (1u << 1) |
        ((cpu->__PVT__psw_c  ? 1u : 0u) << 0);
    uint16_t bc = (uint16_t)cpu->__PVT__r16_bc;
    uint16_t de = (uint16_t)cpu->__PVT__r16_de;
    uint16_t hl = (uint16_t)cpu->__PVT__r16_hl;
    uint16_t sp = (uint16_t)cpu->__PVT__r16_sp;
    uint16_t pc = (uint16_t)cpu->__PVT__r16_pc;
    reg_snap[ 0] = cpu->acc;
    reg_snap[ 1] = f;
    reg_snap[ 2] = (bc >> 8) & 0xFF;   // B
    reg_snap[ 3] = bc & 0xFF;           // C
    reg_snap[ 4] = (de >> 8) & 0xFF;   // D
    reg_snap[ 5] = de & 0xFF;           // E
    reg_snap[ 6] = (hl >> 8) & 0xFF;   // H
    reg_snap[ 7] = hl & 0xFF;           // L
    reg_snap[ 8] = (sp >> 8) & 0xFF;   // SPH
    reg_snap[ 9] = sp & 0xFF;           // SPL
    reg_snap[10] = (pc >> 8) & 0xFF;   // PCH
    reg_snap[11] = pc & 0xFF;           // PCL
    return reg_snap;
}

// ── デバッグ: リングバッファ フリーズ / アンフリーズ ─────────────
EMSCRIPTEN_KEEPALIVE void sim_freeze_ring() { ring_frozen = true; }
EMSCRIPTEN_KEEPALIVE void sim_thaw_ring()   { ring_frozen = false; trig_hit = false; }
EMSCRIPTEN_KEEPALIVE int  sim_ring_frozen() { return ring_frozen ? 1 : 0; }

// ── デバッグ: トリガー設定 ────────────────────────────────────────
// type: 0=off  1=io_req(portフィルタ)  2=call(targetフィルタ)  3=ret(targetフィルタ)
// port: type=1 のポートフィルタ (0xFF=任意)
// pc  : type=2,3 のターゲットアドレスフィルタ (0=任意)
EMSCRIPTEN_KEEPALIVE
void sim_set_trigger(int type, int port, int pc) {
    trig_type      = type;
    trig_port      = (uint8_t)port;
    trig_pc        = (uint16_t)pc;
    trig_hit       = false;
    trig_fired     = false;
    trig_fire_head = 0;
    ring_frozen    = false;
}
EMSCRIPTEN_KEEPALIVE int  sim_trigger_hit()    { return trig_hit  ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int  sim_trigger_fired()  { return trig_fired ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int  sim_get_trig_fire_head() {
    return trig_fired ? (int)trig_fire_head : -1;
}
EMSCRIPTEN_KEEPALIVE void sim_set_post_delay(int n) {
    trig_post_delay = (n > 0) ? (uint32_t)n : 0;
}
EMSCRIPTEN_KEEPALIVE void sim_clear_trigger() {
    trig_type = 0; trig_hit = false; trig_fired = false;
    trig_fire_head = 0; ring_frozen = false;
}

// エッジトリガー設定
// word: Word インデックス (0-4), bit: ビット番号 (0-31), dir: 0=立ち上がり, 1=立ち下がり
EMSCRIPTEN_KEEPALIVE
void sim_set_edge_trigger(int word, int bit, int dir) {
    trig_type      = 4;
    trig_edge_word = word;
    trig_edge_bit  = bit;
    trig_edge_dir  = dir;
    trig_hit       = false;
    trig_fired     = false;
    trig_fire_head = 0;
    ring_frozen    = false;
    prev_edge_val  = 0;
}

// 値トリガー設定
// word: Word インデックス (0-4), mask: ビットマスク, cmp: 比較値（mask 適用後）
EMSCRIPTEN_KEEPALIVE
void sim_set_value_trigger(int word, int mask, int cmp) {
    trig_type      = 6;
    trig_val_word  = word;
    trig_val_mask  = (uint32_t)mask;
    trig_val_cmp   = (uint32_t)cmp;
    trig_hit       = false;
    trig_fired     = false;
    trig_fire_head = 0;
    ring_frozen    = false;
}

// レジスタ値トリガー設定 (type=7)
// reg_id: 0=A 1=F 2=B 3=C 4=D 5=E 6=H 7=L 8=SP 9=PC 10=BC 11=DE 12=HL
// value:  比較値 (8ビットレジスタは下位8ビット、16ビットは下位16ビットを使用)
EMSCRIPTEN_KEEPALIVE
void sim_set_reg_trigger(int reg_id, int value) {
    trig_type      = 7;
    trig_reg_id    = reg_id;
    trig_reg_val   = (uint32_t)value;
    trig_hit       = false;
    trig_fired     = false;
    trig_fire_head = 0;
    ring_frozen    = false;
}

// 命令トリガー設定 (type=5)
// pc:  ターゲット PC アドレス (-1 = 任意)
// opc: ターゲット オペコード  (-1 = 任意)
EMSCRIPTEN_KEEPALIVE
void sim_set_instr_trigger(int pc, int opc) {
    trig_type      = 5;
    trig_instr_pc  = (pc  < 0) ? 0xFFFF : (uint16_t)pc;
    trig_instr_opc = (opc < 0) ? 0xFF   : (uint8_t)opc;
    trig_hit       = false;
    trig_fired     = false;
    trig_fire_head = 0;
    ring_frozen    = false;
}

// Logic Analyzer 有効/無効切替
// enabled=0 のとき ring 書き込みをスキップして速度向上（エッジ/値トリガーは無効になる）
EMSCRIPTEN_KEEPALIVE
void sim_set_la_enabled(int enabled) {
    la_enabled = (enabled != 0);
}

// DDT スタイル 1 命令ステップ実行
// 呼び出し時に ring_frozen/trig_hit をクリアしてシミュレーションを再開し、
// 次の M1 フェッチ（命令境界）まで実行して停止する。
// HLT や WAIT によるタイムアウト (400 クロック超) の場合も ring_frozen=true で止まる。
EMSCRIPTEN_KEEPALIVE
void sim_step_instr() {
    ring_frozen = false;
    trig_hit    = false;
    // 現在 M1 SYNC のクロック上にいる場合、最初の M1 を読み飛ばして次を待つ
    bool skip_first = (bool)(top->dbg_sync) && (bool)(current_status & 0x20u);
    for (int i = 0; i < 400; i++) {
        step();
        if (trig_hit) return;   // On Instruction トリガーが再発火した場合
        if (top->dbg_sync && (current_status & 0x20u)) {
            if (skip_first) {
                skip_first = false;
                continue;
            }
            ring_frozen = true;
            trig_hit    = true;
            return;
        }
    }
    // タイムアウト (HLT 等): 安全のため凍結して戻る
    ring_frozen = true;
    trig_hit    = true;
}

// ── デバッグ: コールトレースログ ─────────────────────────────────
EMSCRIPTEN_KEEPALIVE uint32_t* sim_get_call_log_ptr()  { return call_log_buf; }
EMSCRIPTEN_KEEPALIVE uint32_t  sim_get_call_log_head() { return call_log_head; }
EMSCRIPTEN_KEEPALIVE void      sim_clear_call_log() {
    call_log_head = 0;
    memset(call_log_buf, 0, sizeof(call_log_buf));
}

} // extern "C"
