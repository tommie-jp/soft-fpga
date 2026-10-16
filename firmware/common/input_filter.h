// firmware/common/input_filter.h
//
// 端末から来た 1 バイトを「Apple-1 のキー」か「本体コマンド」に振り分ける。
// Pico SDK に依存しない（ホストの単体テストで回すため）。
//
//   - Ctrl-] (0x1D) に続く 1 バイトは本体コマンド（i / b / r ...）
//   - LF は CR に直す（Apple-1 は CR で確定）。CR+LF の LF は捨てる
//   - BS / DEL は '_' に直す（wozmon のラボアウト）
//   - bit7 付きのバイト（UTF-8 など）は捨てる
//   - 小文字→大文字は harness の send_key() が行う

#pragma once

#include <cstdint>

namespace apple1 {

enum class InputKind : uint8_t { None, Key, Command };

struct InputEvent {
    InputKind kind;
    uint8_t value;
};

class InputFilter {
public:
    static constexpr uint8_t kEscape = 0x1D;  // Ctrl-]

    InputEvent feed(uint8_t byte) {
        if (escapePending_) {
            escapePending_ = false;
            lastWasCr_ = false;
            return {InputKind::Command, byte};
        }
        if (byte == kEscape) {
            escapePending_ = true;
            return {InputKind::None, 0};
        }
        if (byte >= 0x80) {
            return {InputKind::None, 0};
        }
        if (byte == '\n') {
            if (lastWasCr_) {
                lastWasCr_ = false;
                return {InputKind::None, 0};
            }
            return {InputKind::Key, '\r'};
        }

        lastWasCr_ = (byte == '\r');
        if (byte == 0x7F || byte == 0x08) {
            return {InputKind::Key, '_'};
        }
        return {InputKind::Key, byte};
    }

private:
    bool escapePending_ = false;
    bool lastWasCr_ = false;
};

}  // namespace apple1
