// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design internal header
// See Vcpm_top.h for the primary calling header

#ifndef VERILATED_VCPM_TOP_CPM_TOP_H_
#define VERILATED_VCPM_TOP_CPM_TOP_H_  // guard

#include "verilated.h"
class Vcpm_top_vm80a_core;


class Vcpm_top__Syms;

class alignas(VL_CACHE_LINE_BYTES) Vcpm_top_cpm_top final : public VerilatedModule {
  public:
    // CELLS
    Vcpm_top_vm80a_core* cpu;

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
    CData/*0:0*/ f1;
    CData/*0:0*/ f2;
    CData/*7:0*/ __PVT__cpu_din;
    CData/*7:0*/ __PVT__status;
    CData/*0:0*/ __PVT__prev_wr_n;
    VL_OUT16(dbg_pc,15,0);
    VlUnpacked<CData/*7:0*/, 65536> ram;

    // INTERNAL VARIABLES
    Vcpm_top__Syms* const vlSymsp;

    // CONSTRUCTORS
    Vcpm_top_cpm_top(Vcpm_top__Syms* symsp, const char* v__name);
    ~Vcpm_top_cpm_top();
    VL_UNCOPYABLE(Vcpm_top_cpm_top);

    // INTERNAL METHODS
    void __Vconfigure(bool first);
};


#endif  // guard
