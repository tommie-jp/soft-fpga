// firmware/common/display_filter.h
//
// Apple-1 のディスプレイ出力 1 文字を、端末へ書くバイト列に直す。
// Pico SDK に依存しない（ホストの単体テストで回すため）。
//
//   - bit7 は落とす（Apple-1 の表示は 7bit）
//   - LF は CR LF にする（端末は生モードで、改行を自動では足さない）。
//     harness.cpp は Apple-1 の CR (0x0D) を xterm.js 向けに LF へ変換して渡す
//   - それ以外の制御文字と DEL は捨てる（wozmon のリセット直後に 0x7F が出る）

#pragma once

#include <cstdint>

namespace apple1 {

// out に 0〜2 バイト書き、書いたバイト数を返す。
inline int formatDisplayChar(uint8_t ch, uint8_t out[2]) {
    ch &= 0x7F;
    if (ch == '\n') {
        out[0] = '\r';
        out[1] = '\n';
        return 2;
    }
    if (ch < 0x20 || ch == 0x7F) {
        return 0;
    }
    out[0] = ch;
    return 1;
}

}  // namespace apple1
