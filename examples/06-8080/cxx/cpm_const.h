// cpm_const.h — CP/M 8080 シミュレータ共通定数
//
// harness.cpp / main_linux.cpp の両方からインクルードする。
// マジックナンバーをここに集約することで保守性を高める。

#pragma once
#include <stdint.h>

// ── CP/M メモリマップ ──────────────────────────────────────────────
static constexpr int CPM_TPA_BASE   = 0x0100;  // TPA 開始 (page 0 の直後)
static constexpr int CPM_CCP_BASE   = 0xDC00;  // CCP 開始アドレス
static constexpr int CPM_BDOS_BASE  = 0xE400;  // BDOS 開始アドレス
static constexpr int CPM_BIOS_BASE  = 0xF200;  // BIOS 開始アドレス

// CCP+BDOS サイズ (0xDC00 〜 0xF1FF = 5632 bytes = 0x1600)
static constexpr int CCP_BDOS_SIZE  = CPM_BIOS_BASE - CPM_CCP_BASE;
// BIOS 最大サイズ (0xF200 〜 0xFFFF = 3584 bytes = 0x0E00)
static constexpr int BIOS_MAX_SIZE  = 0x10000  - CPM_BIOS_BASE;

// ── IBM 3740 SSSD ディスクパラメータ ─────────────────────────────
static constexpr int DISK_TRACKS      = 77;
static constexpr int DISK_SECTORS     = 26;
static constexpr int DISK_SECTOR_SIZE = 128;
static constexpr int DISK_BYTES       = DISK_TRACKS * DISK_SECTORS * DISK_SECTOR_SIZE;
static constexpr int N_DRIVES         = 4;

// ── バッファサイズ ────────────────────────────────────────────────
static constexpr int CON_IN_SIZE   = 256;   // コンソール入力キュー
static constexpr int CON_OUT_SIZE  = 1024;  // コンソール出力キュー
static constexpr int RING_SIZE     = 4096;  // Logic Analyzer リングバッファ (サンプル数)
static constexpr int RING_WORDS    = 6;     // 1 サンプルあたりの uint32_t ワード数
static constexpr int CALL_LOG_SIZE = 64;    // コールトレースログエントリ数
