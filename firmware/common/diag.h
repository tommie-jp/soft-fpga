// firmware/common/diag.h
//
// 診断出力（ビルド情報）。hello / apple1 の両ターゲットで共用する。

#pragma once

namespace diag {

// "+XI pf=... chip=Bn flash=..KB prog=..KB(..%) ram=..KB bss=..KB(..%) clk=..MHz git=...\r\n"
// prog / bss は Flash / SRAM の静的使用量（bss は .data + .bss + heap の末尾まで）。
void reportId();

}  // namespace diag
