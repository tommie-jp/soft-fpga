// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

void Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0(Vcpm_top_cpm_top* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+      Vcpm_top_cpm_top___ico_sequent__TOP__cpm_top__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__PVT__cpu_din = ((IData)(vlSymsp->TOP.io_active)
                                 ? (IData)(vlSymsp->TOP.io_din)
                                 : vlSelfRef.ram[vlSymsp->TOP__cpm_top__cpu.__PVT__a]);
}

void Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__0(Vcpm_top_cpm_top* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+      Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __Vdly__f1;
    __Vdly__f1 = 0;
    CData/*7:0*/ __VdlyVal__ram__v0;
    __VdlyVal__ram__v0 = 0;
    SData/*15:0*/ __VdlyDim0__ram__v0;
    __VdlyDim0__ram__v0 = 0;
    CData/*0:0*/ __VdlySet__ram__v0;
    __VdlySet__ram__v0 = 0;
    // Body
    __Vdly__f1 = vlSelfRef.f1;
    __VdlySet__ram__v0 = 0U;
    if ((1U & (((~ (IData)(vlSymsp->TOP.reset)) & (~ (IData)(vlSymsp->TOP.io_active))) 
               & (~ (IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__wr_n))))) {
        __VdlyVal__ram__v0 = vlSymsp->TOP__cpm_top__cpu.__PVT__db;
        __VdlyDim0__ram__v0 = vlSymsp->TOP__cpm_top__cpu.__PVT__a;
        __VdlySet__ram__v0 = 1U;
    }
    vlSelfRef.io_req = 0U;
    if (((((IData)(vlSelfRef.__PVT__status) >> 4U) 
          & (~ (IData)(vlSelfRef.__PVT__prev_wr_n))) 
         & (IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__wr_n))) {
        vlSelfRef.io_req = 1U;
        vlSelfRef.io_wr = 1U;
        vlSelfRef.io_addr = (0x000000ffU & (IData)(vlSymsp->TOP__cpm_top__cpu.__PVT__a));
        vlSelfRef.io_dout = vlSymsp->TOP__cpm_top__cpu.__PVT__db;
    }
    if (__VdlySet__ram__v0) {
        vlSelfRef.ram[__VdlyDim0__ram__v0] = __VdlyVal__ram__v0;
    }
    if (vlSymsp->TOP__cpm_top__cpu.__PVT__sync) {
        vlSelfRef.__PVT__status = vlSymsp->TOP__cpm_top__cpu.__PVT__db;
    }
    vlSelfRef.__PVT__prev_wr_n = vlSymsp->TOP__cpm_top__cpu.__PVT__wr_n;
}

void Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__1(Vcpm_top_cpm_top* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+      Vcpm_top_cpm_top___nba_sequent__TOP__cpm_top__1\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __Vdly__f1;
    __Vdly__f1 = 0;
    // Body
    vlSelfRef.__PVT__cpu_din = ((IData)(vlSymsp->TOP.io_active)
                                 ? (IData)(vlSymsp->TOP.io_din)
                                 : vlSelfRef.ram[vlSymsp->TOP__cpm_top__cpu.__PVT__a]);
    __Vdly__f1 = (1U & (~ (IData)(vlSelfRef.f1)));
    vlSelfRef.f2 = vlSelfRef.f1;
    vlSelfRef.f1 = __Vdly__f1;
}
