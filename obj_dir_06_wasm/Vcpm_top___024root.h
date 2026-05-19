// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design internal header
// See Vcpm_top.h for the primary calling header

#ifndef VERILATED_VCPM_TOP___024ROOT_H_
#define VERILATED_VCPM_TOP___024ROOT_H_  // guard

#include "verilated.h"
class Vcpm_top_cpm_top;


class Vcpm_top__Syms;

class alignas(VL_CACHE_LINE_BYTES) Vcpm_top___024root final {
  public:
    // CELLS
    Vcpm_top_cpm_top* cpm_top;

    // DESIGN SPECIFIC STATE
    VL_IN8(clk,0,0);
    VL_IN8(reset,0,0);
    VL_OUT8(io_req,0,0);
    VL_OUT8(io_wr,0,0);
    VL_OUT8(io_addr,7,0);
    VL_OUT8(io_dout,7,0);
    VL_IN8(io_din,7,0);
    VL_OUT8(io_dbin,0,0);
    VL_OUT8(io_active,0,0);
    VL_OUT8(io_port,7,0);
    VL_OUT8(dbg_a,7,0);
    VL_OUT8(dbg_f,7,0);
    CData/*0:0*/ __VstlFirstIteration;
    CData/*0:0*/ __VstlPhaseResult;
    CData/*0:0*/ __VicoFirstIteration;
    CData/*0:0*/ __VicoPhaseResult;
    CData/*0:0*/ __Vtrigprevexpr___TOP__clk__0;
    CData/*0:0*/ __Vtrigprevexpr___TOP__cpm_top__cpu____PVT__reset__0;
    CData/*0:0*/ __VactPhaseResult;
    CData/*0:0*/ __VnbaPhaseResult;
    VL_OUT16(dbg_pc,15,0);
    IData/*31:0*/ __VactIterCount;
    VlUnpacked<QData/*63:0*/, 1> __VstlTriggered;
    VlUnpacked<QData/*63:0*/, 1> __VicoTriggered;
    VlUnpacked<QData/*63:0*/, 1> __VactTriggered;
    VlUnpacked<QData/*63:0*/, 1> __VnbaTriggered;

    // INTERNAL VARIABLES
    Vcpm_top__Syms* vlSymsp;
    const char* vlNamep;

    // CONSTRUCTORS
    Vcpm_top___024root(Vcpm_top__Syms* symsp, const char* namep);
    ~Vcpm_top___024root();
    VL_UNCOPYABLE(Vcpm_top___024root);

    // INTERNAL METHODS
    void __Vconfigure(bool first);
};


#endif  // guard
