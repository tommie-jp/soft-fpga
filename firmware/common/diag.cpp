// firmware/common/diag.cpp

#include "diag.h"

#include <cstdint>
#include <cstdio>

#include "hardware/clocks.h"
#include "hardware/structs/sysinfo.h"
#include "pico/stdlib.h"

// リンカスクリプトが定義するシンボル（namespace の外に置かないとリンクできない）
extern "C" {
extern char __flash_binary_start;
extern char __flash_binary_end;
extern char __bss_end__;
}

namespace diag {

namespace {
constexpr uint32_t kSramKb = 520;
constexpr uint32_t kSramBase = 0x20000000u;
}  // namespace

void reportId() {
    constexpr uint32_t flashKb = PICO_FLASH_SIZE_BYTES / 1024u;
    const uint32_t progKb =
        static_cast<uint32_t>(&__flash_binary_end - &__flash_binary_start) / 1024u;
    const uint32_t bssKb =
        static_cast<uint32_t>(reinterpret_cast<uintptr_t>(&__bss_end__) - kSramBase) / 1024u;
    const uint32_t clkMhz = clock_get_hz(clk_sys) / 1000000u;
    // CHIP_ID[31:28] = revision (0=B0, 1=B1, 2=B2)
    const uint32_t chipRev = (sysinfo_hw->chip_id >> 28u) & 0xFu;

    printf("+XI pf=" PICO_PLATFORM_STR
           " chip=B%u flash=%uKB prog=%uKB(%u%%) ram=%uKB bss=%uKB(%u%%)"
           " clk=%uMHz git=%s\r\n",
           static_cast<unsigned>(chipRev),
           static_cast<unsigned>(flashKb),
           static_cast<unsigned>(progKb), static_cast<unsigned>(progKb * 100u / flashKb),
           static_cast<unsigned>(kSramKb),
           static_cast<unsigned>(bssKb), static_cast<unsigned>(bssKb * 100u / kSramKb),
           static_cast<unsigned>(clkMhz),
           GIT_HASH);
}

}  // namespace diag
