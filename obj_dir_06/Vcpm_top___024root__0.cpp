// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__ico(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag);
#endif  // VL_DEBUG

void Vcpm_top___024root___eval_triggers__ico(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_triggers__ico\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__VicoTriggered[0U] = ((0xfffffffffffffffeULL 
                                      & vlSelfRef.__VicoTriggered
                                      [0U]) | (IData)((IData)(vlSelfRef.__VicoFirstIteration)));
    vlSelfRef.__VicoFirstIteration = 0U;
#ifdef VL_DEBUG
    if (VL_UNLIKELY(vlSymsp->_vm_contextp__->debug())) {
        Vcpm_top___024root___dump_triggers__ico(vlSelfRef.__VicoTriggered, "ico"s);
    }
#endif
}

bool Vcpm_top___024root___trigger_anySet__ico(const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___trigger_anySet__ico\n"); );
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

void Vcpm_top_vm80a_core___ico_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0(Vcpm_top_cpm_top* vlSelf);

void Vcpm_top___024root___eval_ico(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_ico\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    if ((1ULL & vlSelfRef.__VicoTriggered[0U])) {
        Vcpm_top_vm80a_core___ico_sequent__TOP__cpm_top__cpu__0((&vlSymsp->TOP__cpm_top__cpu));
        Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0((&vlSymsp->TOP__cpm_top));
    }
}

bool Vcpm_top___024root___eval_phase__ico(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_phase__ico\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __VicoExecute;
    // Body
    Vcpm_top___024root___eval_triggers__ico(vlSelf);
    __VicoExecute = Vcpm_top___024root___trigger_anySet__ico(vlSelfRef.__VicoTriggered);
    if (__VicoExecute) {
        Vcpm_top___024root___eval_ico(vlSelf);
    }
    return (__VicoExecute);
}

#ifdef VL_DEBUG
VL_ATTR_COLD void Vcpm_top___024root___dump_triggers__act(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag);
#endif  // VL_DEBUG

void Vcpm_top___024root___eval_triggers__act(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_triggers__act\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__VactTriggered[0U] = (QData)((IData)(
                                                    ((((IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__reset) 
                                                       & (~ (IData)(vlSelfRef.__Vtrigprevexpr___TOP__cpm_top__cpu____PVT__reset__0))) 
                                                      << 1U) 
                                                     | ((IData)(vlSelfRef.clk) 
                                                        & (~ (IData)(vlSelfRef.__Vtrigprevexpr___TOP__clk__0))))));
    vlSelfRef.__Vtrigprevexpr___TOP__clk__0 = vlSelfRef.clk;
    vlSelfRef.__Vtrigprevexpr___TOP__cpm_top__cpu____PVT__reset__0 
        = vlSymsp->TOP__cpm_top__cpu.__PVT__reset;
#ifdef VL_DEBUG
    if (VL_UNLIKELY(vlSymsp->_vm_contextp__->debug())) {
        Vcpm_top___024root___dump_triggers__act(vlSelfRef.__VactTriggered, "act"s);
    }
#endif
}

bool Vcpm_top___024root___trigger_anySet__act(const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___trigger_anySet__act\n"); );
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

void Vcpm_top___024root___nba_sequent__TOP__0(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___nba_sequent__TOP__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.io_req = vlSymsp->TOP__cpm_top.io_req;
    vlSelfRef.io_wr = vlSymsp->TOP__cpm_top.io_wr;
    vlSelfRef.io_addr = vlSymsp->TOP__cpm_top.io_addr;
    vlSelfRef.io_dout = vlSymsp->TOP__cpm_top.io_dout;
    vlSelfRef.io_active = (IData)((0U != (0x50U & (IData)(vlSymsp->TOP__cpm_top.__PVT__status))));
    vlSelfRef.io_dbin = vlSymsp->TOP__cpm_top__cpu.__PVT__dbin_pin;
    vlSelfRef.dbg_pc = vlSymsp->TOP__cpm_top__cpu.__PVT__a;
    vlSelfRef.io_port = (0x000000ffU & (IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__a));
    vlSelfRef.dbg_a = vlSymsp->TOP__cpm_top__cpu.__PVT__db;
    vlSelfRef.dbg_f = vlSymsp->TOP__cpm_top__cpu.__PVT__wr_n;
}

void Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__0(Vcpm_top_cpm_top* vlSelf);
void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__1(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__2(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__1(Vcpm_top_cpm_top* vlSelf);
void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__3(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__4(Vcpm_top_vm80a_core* vlSelf);
void Vcpm_top_vm80a_core___nba_comb__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf);

void Vcpm_top___024root___eval_nba(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_nba\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    if ((1ULL & vlSelfRef.__VnbaTriggered[0U])) {
        Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__0((&vlSymsp->TOP__cpm_top));
        Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__0((&vlSymsp->TOP__cpm_top__cpu));
        Vcpm_top___024root___nba_sequent__TOP__0(vlSelf);
    }
    if ((3ULL & vlSelfRef.__VnbaTriggered[0U])) {
        Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__1((&vlSymsp->TOP__cpm_top__cpu));
    }
    if ((1ULL & vlSelfRef.__VnbaTriggered[0U])) {
        Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__2((&vlSymsp->TOP__cpm_top__cpu));
        Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__1((&vlSymsp->TOP__cpm_top));
        Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__3((&vlSymsp->TOP__cpm_top__cpu));
    }
    if ((3ULL & vlSelfRef.__VnbaTriggered[0U])) {
        Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__4((&vlSymsp->TOP__cpm_top__cpu));
    }
    if ((3ULL & vlSelfRef.__VnbaTriggered[0U])) {
        Vcpm_top_vm80a_core___nba_comb__TOP__cpm_top__cpu__0((&vlSymsp->TOP__cpm_top__cpu));
    }
}

void Vcpm_top___024root___trigger_orInto__act(VlUnpacked<QData/*63:0*/, 1> &out, const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___trigger_orInto__act\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        out[n] = (out[n] | in[n]);
        n = ((IData)(1U) + n);
    } while ((1U > n));
}

bool Vcpm_top___024root___eval_phase__act(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_phase__act\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    Vcpm_top___024root___eval_triggers__act(vlSelf);
    Vcpm_top___024root___trigger_orInto__act(vlSelfRef.__VnbaTriggered, vlSelfRef.__VactTriggered);
    return (0U);
}

void Vcpm_top___024root___trigger_clear__act(VlUnpacked<QData/*63:0*/, 1> &out) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___trigger_clear__act\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        out[n] = 0ULL;
        n = ((IData)(1U) + n);
    } while ((1U > n));
}

bool Vcpm_top___024root___eval_phase__nba(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_phase__nba\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __VnbaExecute;
    // Body
    __VnbaExecute = Vcpm_top___024root___trigger_anySet__act(vlSelfRef.__VnbaTriggered);
    if (__VnbaExecute) {
        Vcpm_top___024root___eval_nba(vlSelf);
        Vcpm_top___024root___trigger_clear__act(vlSelfRef.__VnbaTriggered);
    }
    return (__VnbaExecute);
}

void Vcpm_top___024root___eval(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    IData/*31:0*/ __VicoIterCount;
    IData/*31:0*/ __VnbaIterCount;
    // Body
    __VicoIterCount = 0U;
    vlSelfRef.__VicoFirstIteration = 1U;
    do {
        if (VL_UNLIKELY(((0x00000064U < __VicoIterCount)))) {
#ifdef VL_DEBUG
            Vcpm_top___024root___dump_triggers__ico(vlSelfRef.__VicoTriggered, "ico"s);
#endif
            VL_FATAL_MT("/home/tommie/36-soft-FPGA/scripts/../examples/06-8080/verilog/cpm_top.v", 21, "", "Input combinational region did not converge after 100 tries");
        }
        __VicoIterCount = ((IData)(1U) + __VicoIterCount);
    } while (Vcpm_top___024root___eval_phase__ico(vlSelf));
    __VnbaIterCount = 0U;
    do {
        if (VL_UNLIKELY(((0x00000064U < __VnbaIterCount)))) {
#ifdef VL_DEBUG
            Vcpm_top___024root___dump_triggers__act(vlSelfRef.__VnbaTriggered, "nba"s);
#endif
            VL_FATAL_MT("/home/tommie/36-soft-FPGA/scripts/../examples/06-8080/verilog/cpm_top.v", 21, "", "NBA region did not converge after 100 tries");
        }
        __VnbaIterCount = ((IData)(1U) + __VnbaIterCount);
        vlSelfRef.__VactIterCount = 0U;
        do {
            if (VL_UNLIKELY(((0x00000064U < vlSelfRef.__VactIterCount)))) {
#ifdef VL_DEBUG
                Vcpm_top___024root___dump_triggers__act(vlSelfRef.__VactTriggered, "act"s);
#endif
                VL_FATAL_MT("/home/tommie/36-soft-FPGA/scripts/../examples/06-8080/verilog/cpm_top.v", 21, "", "Active region did not converge after 100 tries");
            }
            vlSelfRef.__VactIterCount = ((IData)(1U) 
                                         + vlSelfRef.__VactIterCount);
        } while (Vcpm_top___024root___eval_phase__act(vlSelf));
    } while (Vcpm_top___024root___eval_phase__nba(vlSelf));
}

#ifdef VL_DEBUG
void Vcpm_top___024root___eval_debug_assertions(Vcpm_top___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vcpm_top___024root___eval_debug_assertions\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    if (VL_UNLIKELY(((vlSelfRef.clk & 0xfeU)))) {
        Verilated::overWidthError("clk");
    }
    if (VL_UNLIKELY(((vlSelfRef.reset & 0xfeU)))) {
        Verilated::overWidthError("reset");
    }
}
#endif  // VL_DEBUG
