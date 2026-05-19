// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

VL_ATTR_COLD void Vcpm_top_cpm_top___ctor_var_reset(Vcpm_top_cpm_top* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+      Vcpm_top_cpm_top___ctor_var_reset\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    const uint64_t __VscopeHash = VL_MURMUR64_HASH(vlSelf->name());
    vlSelf->clk = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16707436170211756652ull);
    vlSelf->reset = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9928399931838511862ull);
    vlSelf->io_req = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11438338458259327575ull);
    vlSelf->io_wr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7179888871461122698ull);
    vlSelf->io_addr = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 18685772434100369ull);
    vlSelf->io_dout = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 4888449741199479667ull);
    vlSelf->io_din = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 11002663319847879293ull);
    vlSelf->io_dbin = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16450227945211426595ull);
    vlSelf->io_active = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15106302221095905593ull);
    vlSelf->io_port = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 6613331055654258869ull);
    vlSelf->dbg_pc = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 4205037871569850614ull);
    vlSelf->dbg_a = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 3912950516105535584ull);
    vlSelf->dbg_f = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 11240337348582819707ull);
    vlSelf->f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13438191067195198270ull);
    vlSelf->f2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8912691017008511026ull);
    vlSelf->__PVT__cpu_din = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 3245090486746556407ull);
    vlSelf->__PVT__status = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 14822974759303984767ull);
    for (int __Vi0 = 0; __Vi0 < 65536; ++__Vi0) {
        vlSelf->ram[__Vi0] = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 12779093550319448395ull);
    }
    vlSelf->__PVT__prev_wr_n = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9844259598432293563ull);
}
