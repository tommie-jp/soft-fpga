// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design internal header
// See Vcpm_top.h for the primary calling header

#ifndef VERILATED_VCPM_TOP_CPM_TOP_H_
#define VERILATED_VCPM_TOP_CPM_TOP_H_  // guard

#include "verilated.h"
class Vcpm_top_vm80a_core;


class Vcpm_top__Syms;

class alignas(VL_CACHE_LINE_BYTES) Vcpm_top_cpm_top final {
  public:
    // CELLS
    Vcpm_top_vm80a_core* cpu;

    // DESIGN SPECIFIC STATE
    CData/*0:0*/ clk;
    CData/*0:0*/ reset;
    CData/*0:0*/ io_req;
    CData/*0:0*/ io_wr;
    CData/*7:0*/ io_addr;
    CData/*7:0*/ io_dout;
    CData/*7:0*/ io_din;
    CData/*0:0*/ io_dbin;
    CData/*0:0*/ io_active;
    CData/*7:0*/ io_port;
    CData/*7:0*/ dbg_a;
    CData/*7:0*/ dbg_f;
    CData/*0:0*/ f1;
    CData/*0:0*/ f2;
    CData/*7:0*/ __PVT__cpu_din;
    CData/*7:0*/ __PVT__status;
    CData/*0:0*/ __PVT__prev_wr_n;
    SData/*15:0*/ dbg_pc;
    VlUnpacked<CData/*7:0*/, 65536> ram;

    // INTERNAL VARIABLES
    Vcpm_top__Syms* vlSymsp;
    const char* vlNamep;

    // CONSTRUCTORS
    Vcpm_top_cpm_top();
    ~Vcpm_top_cpm_top();
    void ctor(Vcpm_top__Syms* symsp, const char* namep);
    void dtor();
    VL_UNCOPYABLE(Vcpm_top_cpm_top);

    // INTERNAL METHODS
    void __Vconfigure(bool first);
};


#endif  // guard
