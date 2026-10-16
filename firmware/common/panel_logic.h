// firmware/common/panel_logic.h
//
// LED パネルに出す GPIO ワードを決める。Pico SDK に依存しない（ホストの単体テストで回すため）。
//
// ピン割り当て（docs/07 §9.2）:
//   A0〜A15 → GP0〜15 / D0〜D6 → GP16〜22 / D7 → GP26 / RW → GP27 / SYNC → GP28 / φ2 → GP25
//
// 表示の考え方:
//   - 既定は「SYNC サンプル」。命令フェッチ (SYNC=1) のときだけ A / D を更新する。
//     A は命令の番地 (pc - 1)、D は命令コード。RW / SYNC / φ2 は毎サイクル更新する
//   - `a` で「全サイクル」。harness が見せるバスをそのまま出す（D は 1 サイクル遅れる）
//   - $C000 への書き込み（出力ポート）があると、D の LED はポートの値に切り替わり保持する。
//     `y` / `a` でバス表示に戻る

#pragma once

#include <cstdint>

namespace apple1 {

// harness の sim_bus_observe() が毎サイクル渡す観測値。
struct BusSample {
    uint16_t ab;
    uint8_t db;
    bool we;
    bool sync;
    uint16_t pc;  // SYNC=1 のとき命令の次の番地（命令の番地は pc - 1）
};

namespace panel {

constexpr uint32_t kPhi2Bit = 1u << 25;
constexpr uint32_t kDataHighBit = 1u << 26;  // D7
constexpr uint32_t kReadBit = 1u << 27;      // RW（読み出しで点灯）
constexpr uint32_t kSyncBit = 1u << 28;
constexpr uint32_t kAddrMask = 0xFFFFu;
constexpr uint32_t kDataLowMask = 0x7Fu << 16;  // D0〜D6
constexpr uint32_t kOutputMask =
    kAddrMask | kDataLowMask | kPhi2Bit | kDataHighBit | kReadBit | kSyncBit;

// Debug Probe の UART ブリッジ (UART0 = GP0 / GP1) と共存するとき、A0 / A1 は LED に出せない。
constexpr uint32_t kDebugUartMask = (1u << 0) | (1u << 1);

constexpr uint16_t kPortAddress = 0xC000;

inline uint32_t pack(uint16_t addr, uint8_t data, bool read, bool sync, bool phi2) {
    uint32_t word = addr;
    word |= static_cast<uint32_t>(data & 0x7Fu) << 16;
    if (data & 0x80u) word |= kDataHighBit;
    if (read) word |= kReadBit;
    if (sync) word |= kSyncBit;
    if (phi2) word |= kPhi2Bit;
    return word;
}

// PanelLogic が解釈するコマンド ('t' の自己診断は GPIO を直接触るので別処理)。
inline bool isCommand(uint8_t c) {
    return c == 'y' || c == 'a' || c == 'o' || c == 't';
}

}  // namespace panel

class PanelLogic {
public:
    // 'y' SYNC サンプル + バス / 'a' 全サイクル + バス / 'o' ポート。扱ったら true。
    bool applyCommand(uint8_t c) {
        switch (c) {
            case 'y':
                liveBus_ = false;
                showPort_ = false;
                return true;
            case 'a':
                liveBus_ = true;
                showPort_ = false;
                return true;
            case 'o':
                showPort_ = true;
                return true;
            default:
                return false;
        }
    }

    void reset() { *this = PanelLogic{}; }

    // 1 サイクル分の観測値から、LED に出す GPIO ワードを返す。
    uint32_t update(const BusSample& s) {
        phi2_ = !phi2_;

        if (s.we && s.ab == panel::kPortAddress) {
            port_ = s.db;
            showPort_ = true;
        }

        if (liveBus_) {
            addr_ = s.ab;
            data_ = s.db;
        } else if (s.sync) {
            addr_ = static_cast<uint16_t>(s.pc - 1u);
            data_ = s.db;
        }

        return panel::pack(addr_, showPort_ ? port_ : data_, !s.we, s.sync, phi2_);
    }

private:
    bool liveBus_ = false;
    bool showPort_ = false;
    bool phi2_ = false;
    uint16_t addr_ = 0;
    uint8_t data_ = 0;
    uint8_t port_ = 0;
};

}  // namespace apple1
