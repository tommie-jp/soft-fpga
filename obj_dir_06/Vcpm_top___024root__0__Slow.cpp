// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

VL_ATTR_COLD void Vcpm_top___024root___eval_static(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_static\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__Vtrigprevexpr___TOP__clk__0 = vlSelfRef.clk;
    vlSelfRef.__Vtrigprevexpr___TOP__cpm_top__cpu____PVT__reset__0 
        = vlSymsp->TOP__cpm_top__cpu.__PVT__reset;
}

VL_ATTR_COLD void Vcpm_top___024root___eval_initial(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_initial\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
}

VL_ATTR_COLD void Vcpm_top___024root___eval_final(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_final\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
}

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__stl(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag);
#endif  // VL_DEBUG
VL_ATTR_COLD bool Vcpm_top___024root___eval_phase__stl(Vcpm_top___024root* vlSelf);

VL_ATTR_COLD void Vcpm_top___024root___eval_settle(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_settle\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    IData/*31:0*/ __VstlIterCount;
    // Body
    __VstlIterCount = 0U;
    vlSelfRef.__VstlFirstIteration = 1U;
    do {
        if (VL_UNLIKELY(((0x00000064U < __VstlIterCount)))) {
#ifdef VL_DEBUG
            Vcpm_top___024root___dump_triggers__stl(vlSelfRef.__VstlTriggered, "stl"s);
#endif
            VL_FATAL_MT("/home/tommie/36-soft-FPGA/scripts/../examples/06-8080/verilog/cpm_top.v", 21, "", "Settle region did not converge after 100 tries");
        }
        __VstlIterCount = ((IData)(1U) + __VstlIterCount);
    } while (Vcpm_top___024root___eval_phase__stl(vlSelf));
}

VL_ATTR_COLD void Vcpm_top___024root___eval_triggers__stl(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_triggers__stl\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__VstlTriggered[0U] = ((0xfffffffffffffffeULL 
                                      & vlSelfRef.__VstlTriggered
                                      [0U]) | (IData)((IData)(vlSelfRef.__VstlFirstIteration)));
    vlSelfRef.__VstlFirstIteration = 0U;
#ifdef VL_DEBUG
    if (VL_UNLIKELY(vlSymsp->_vm_contextp__->debug())) {
        Vcpm_top___024root___dump_triggers__stl(vlSelfRef.__VstlTriggered, "stl"s);
    }
#endif
}

VL_ATTR_COLD bool Vcpm_top___024root___trigger_anySet__stl(const VlUnpacked<QData/*63:0*/, 1> &in);

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__stl(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___dump_triggers__stl\n"); );
    // Body
    if ((1U & (~ (IData)(Vcpm_top___024root___trigger_anySet__stl(triggers))))) {
        VL_DBG_MSGS("         No '" + tag + "' region triggers active\n");
    }
    if ((1U & (IData)(triggers[0U]))) {
        VL_DBG_MSGS("         '" + tag + "' region trigger index 0 is active: Internal 'stl' trigger - first iteration\n");
    }
}
#endif  // VL_DEBUG

VL_ATTR_COLD bool Vcpm_top___024root___trigger_anySet__stl(const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___trigger_anySet__stl\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        if (in[n]) {
            return (1U);
        }
        n = ((IData)(1U) + n);
    } while ((1U > n));
    return (0U);
}

VL_ATTR_COLD void Vcpm_top___024root___stl_sequent__TOP__0(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___stl_sequent__TOP__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.dbg_f = vlSymsp->TOP__cpm_top__cpu.__PVT__wr_n;
    vlSelfRef.dbg_a = vlSymsp->TOP__cpm_top__cpu.__PVT__db;
    vlSelfRef.dbg_pc = vlSymsp->TOP__cpm_top__cpu.__PVT__a;
    vlSelfRef.io_port = (0x000000ffU & (IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__a));
    vlSelfRef.io_dbin = vlSymsp->TOP__cpm_top__cpu.__PVT__dbin_pin;
    vlSelfRef.io_dout = vlSymsp->TOP__cpm_top.io_dout;
    vlSelfRef.io_addr = vlSymsp->TOP__cpm_top.io_addr;
    vlSelfRef.io_wr = vlSymsp->TOP__cpm_top.io_wr;
    vlSelfRef.io_req = vlSymsp->TOP__cpm_top.io_req;
    vlSelfRef.io_active = (IData)((0U != (0x50U & (IData)(vlSymsp->TOP__cpm_top.__PVT__status))));
}

VL_ATTR_COLD void Vcpm_top_vm80a_core___stl_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0(Vcpm_top_cpm_top* vlSelf);

VL_ATTR_COLD void Vcpm_top___024root___eval_stl(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_stl\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    if ((1ULL & vlSelfRef.__VstlTriggered[0U])) {
        Vcpm_top___024root___stl_sequent__TOP__0(vlSelf);
        Vcpm_top_vm80a_core___stl_sequent__TOP__cpm_top__cpu__0((&vlSymsp->TOP__cpm_top__cpu));
        Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0((&vlSymsp->TOP__cpm_top));
    }
}

VL_ATTR_COLD bool Vcpm_top___024root___eval_phase__stl(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_phase__stl\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __VstlExecute;
    // Body
    Vcpm_top___024root___eval_triggers__stl(vlSelf);
    __VstlExecute = Vcpm_top___024root___trigger_anySet__stl(vlSelfRef.__VstlTriggered);
    if (__VstlExecute) {
        Vcpm_top___024root___eval_stl(vlSelf);
    }
    return (__VstlExecute);
}

bool Vcpm_top___024root___trigger_anySet__ico(const VlUnpacked<QData/*63:0*/, 1> &in);

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__ico(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___dump_triggers__ico\n"); );
    // Body
    if ((1U & (~ (IData)(Vcpm_top___024root___trigger_anySet__ico(triggers))))) {
        VL_DBG_MSGS("         No '" + tag + "' region triggers active\n");
    }
    if ((1U & (IData)(triggers[0U]))) {
        VL_DBG_MSGS("         '" + tag + "' region trigger index 0 is active: Internal 'ico' trigger - first iteration\n");
    }
}
#endif  // VL_DEBUG

bool Vcpm_top___024root___trigger_anySet__act(const VlUnpacked<QData/*63:0*/, 1> &in);

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__act(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___dump_triggers__act\n"); );
    // Body
    if ((1U & (~ (IData)(Vcpm_top___024root___trigger_anySet__act(triggers))))) {
        VL_DBG_MSGS("         No '" + tag + "' region triggers active\n");
    }
    if ((1U & (IData)(triggers[0U]))) {
        VL_DBG_MSGS("         '" + tag + "' region trigger index 0 is active: @(posedge clk)\n");
    }
    if ((1U & (IData)((triggers[0U] >> 1U)))) {
        VL_DBG_MSGS("         '" + tag + "' region trigger index 1 is active: @(posedge cpm_top.cpu.reset)\n");
    }
}
#endif  // VL_DEBUG

VL_ATTR_COLD void Vcpm_top___024root___ctor_var_reset(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___ctor_var_reset\n"); );
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
    for (int __Vi0 = 0; __Vi0 < 1; ++__Vi0) {
        vlSelf->__VstlTriggered[__Vi0] = 0;
    }
    for (int __Vi0 = 0; __Vi0 < 1; ++__Vi0) {
        vlSelf->__VicoTriggered[__Vi0] = 0;
    }
    for (int __Vi0 = 0; __Vi0 < 1; ++__Vi0) {
        vlSelf->__VactTriggered[__Vi0] = 0;
    }
    vlSelf->__Vtrigprevexpr___TOP__clk__0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9526919608049418986ull);
    vlSelf->__Vtrigprevexpr___TOP__cpm_top__cpu____PVT__reset__0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8663364668429766104ull);
    for (int __Vi0 = 0; __Vi0 < 1; ++__Vi0) {
        vlSelf->__VnbaTriggered[__Vi0] = 0;
    }
}
