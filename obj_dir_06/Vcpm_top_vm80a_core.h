// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design internal header
// See Vcpm_top.h for the primary calling header

#ifndef VERILATED_VCPM_TOP_VM80A_CORE_H_
#define VERILATED_VCPM_TOP_VM80A_CORE_H_  // guard

#include "verilated.h"


class Vcpm_top__Syms;

class alignas(VL_CACHE_LINE_BYTES) Vcpm_top_vm80a_core final : public VerilatedModule {
  public:

    // DESIGN SPECIFIC STATE
    // Anonymous structures to workaround compiler member-count bugs
    struct {
        VL_IN8(__PVT__pin_clk,0,0);
        VL_IN8(__PVT__pin_f1,0,0);
        VL_IN8(__PVT__pin_f2,0,0);
        VL_IN8(__PVT__pin_reset,0,0);
        VL_OUT8(__PVT__pin_dout,7,0);
        VL_IN8(__PVT__pin_din,7,0);
        VL_OUT8(__PVT__pin_aena,0,0);
        VL_OUT8(__PVT__pin_dena,0,0);
        VL_IN8(__PVT__pin_hold,0,0);
        VL_OUT8(__PVT__pin_hlda,0,0);
        VL_IN8(__PVT__pin_ready,0,0);
        VL_OUT8(__PVT__pin_wait,0,0);
        VL_IN8(__PVT__pin_int,0,0);
        VL_OUT8(__PVT__pin_inte,0,0);
        VL_OUT8(__PVT__pin_sync,0,0);
        VL_OUT8(__PVT__pin_dbin,0,0);
        VL_OUT8(__PVT__pin_wr_n,0,0);
        CData/*7:0*/ __PVT__d;
        CData/*7:0*/ __PVT__db;
        CData/*7:0*/ __PVT__di;
        CData/*0:0*/ __PVT__db_stb;
        CData/*0:0*/ __PVT__dbin_pin;
        CData/*0:0*/ __PVT__dbin_ext;
        CData/*0:0*/ __PVT__reset;
        CData/*0:0*/ __PVT__t404;
        CData/*0:0*/ __PVT__t382;
        CData/*0:0*/ __PVT__t383;
        CData/*0:0*/ __PVT__hold;
        CData/*0:0*/ __PVT__h889;
        CData/*0:0*/ __PVT__wr_n;
        CData/*0:0*/ __PVT__t1124;
        CData/*0:0*/ __PVT__t1011;
        CData/*0:0*/ __PVT__sync;
        CData/*0:0*/ __PVT__ready_int;
        CData/*0:0*/ __PVT__mxr1;
        CData/*0:0*/ __PVT__mxr2;
        CData/*0:0*/ __PVT__mxr3;
        CData/*0:0*/ __PVT__mxr4;
        CData/*0:0*/ __PVT__mxwh;
        CData/*0:0*/ __PVT__mxwl;
        CData/*0:0*/ __PVT__mxrh;
        CData/*0:0*/ __PVT__mxrl;
        CData/*0:0*/ __PVT__xchg_dh;
        CData/*0:0*/ __PVT__xchg_tt;
        CData/*0:0*/ __PVT__t3144;
        CData/*0:0*/ __PVT__t1460;
        CData/*0:0*/ __PVT__sy_wo_n;
        CData/*0:0*/ __PVT__sy_inp;
        CData/*0:0*/ __PVT__sy_stack;
        CData/*0:0*/ __PVT__thalt;
        CData/*0:0*/ t1;
        CData/*0:0*/ t2;
        CData/*0:0*/ __PVT__tw;
        CData/*0:0*/ t3;
        CData/*0:0*/ t4;
        CData/*0:0*/ __PVT__t5;
        CData/*0:0*/ __PVT__t1f1;
        CData/*0:0*/ __PVT__t2f1;
        CData/*0:0*/ __PVT__twf1;
        CData/*0:0*/ __PVT__t3f1;
        CData/*0:0*/ __PVT__t4f1;
        CData/*0:0*/ __PVT__t5f1;
        CData/*0:0*/ m1;
        CData/*0:0*/ m2;
    };
    struct {
        CData/*0:0*/ m3;
        CData/*0:0*/ m4;
        CData/*0:0*/ m5;
        CData/*0:0*/ __PVT__m1f1;
        CData/*0:0*/ __PVT__m2f1;
        CData/*0:0*/ __PVT__m3f1;
        CData/*0:0*/ __PVT__m4f1;
        CData/*0:0*/ __PVT__m5f1;
        CData/*0:0*/ __PVT__start;
        CData/*0:0*/ __PVT__ms0;
        CData/*0:0*/ __PVT__ms1;
        CData/*0:0*/ __PVT__m839;
        CData/*0:0*/ eom;
        CData/*0:0*/ __PVT__t789;
        CData/*0:0*/ __PVT__t887;
        CData/*0:0*/ __PVT__t953;
        CData/*0:0*/ __PVT__t976;
        CData/*0:0*/ __PVT__t980;
        CData/*0:0*/ __PVT__intr;
        CData/*0:0*/ __PVT__inta;
        CData/*0:0*/ __PVT__inte;
        CData/*0:0*/ __PVT__mstart;
        CData/*0:0*/ __PVT__minta;
        CData/*7:0*/ __PVT__i;
        CData/*0:0*/ __PVT__i25;
        CData/*0:0*/ __PVT__i14;
        CData/*0:0*/ __PVT__i03;
        CData/*0:0*/ __PVT__acc_sel;
        CData/*0:0*/ __PVT__id_op;
        CData/*0:0*/ __PVT__id_io;
        CData/*0:0*/ __PVT__id_in;
        CData/*0:0*/ __PVT__id_popsw;
        CData/*0:0*/ __PVT__id_pupsw;
        CData/*0:0*/ __PVT__id_nop;
        CData/*0:0*/ __PVT__id_lxi;
        CData/*0:0*/ __PVT__id_inr;
        CData/*0:0*/ __PVT__id_dcr;
        CData/*0:0*/ __PVT__id_idr;
        CData/*0:0*/ __PVT__id_mvi;
        CData/*0:0*/ __PVT__id_dad;
        CData/*0:0*/ __PVT__id_dcx;
        CData/*0:0*/ __PVT__id_opa;
        CData/*0:0*/ __PVT__id_idm;
        CData/*0:0*/ __PVT__id_hlt;
        CData/*0:0*/ __PVT__id_mov;
        CData/*0:0*/ __PVT__id_opm;
        CData/*0:0*/ __PVT__id_pop;
        CData/*0:0*/ __PVT__id_rst;
        CData/*0:0*/ __PVT__id_cxx;
        CData/*0:0*/ __PVT__id_jxx;
        CData/*0:0*/ __PVT__id_rxx;
        CData/*0:0*/ __PVT__id_ret;
        CData/*0:0*/ __PVT__id_jmp;
        CData/*0:0*/ __PVT__id_opi;
        CData/*0:0*/ __PVT__id_out;
        CData/*0:0*/ __PVT__id_11x;
        CData/*0:0*/ __PVT__id_rxc;
        CData/*0:0*/ __PVT__id_sha;
        CData/*0:0*/ __PVT__id_daa;
        CData/*0:0*/ __PVT__id_cma;
        CData/*0:0*/ __PVT__id_stc;
        CData/*0:0*/ __PVT__id_add;
        CData/*0:0*/ __PVT__id_adc;
        CData/*0:0*/ __PVT__id_sub;
    };
    struct {
        CData/*0:0*/ __PVT__id_sbb;
        CData/*0:0*/ __PVT__id_ana;
        CData/*0:0*/ __PVT__id_xra;
        CData/*0:0*/ __PVT__id_ora;
        CData/*0:0*/ __PVT__id_cmp;
        CData/*0:0*/ __PVT__id_lsax;
        CData/*0:0*/ __PVT__id_mvim;
        CData/*0:0*/ __PVT__id_shld;
        CData/*0:0*/ __PVT__id_lhld;
        CData/*0:0*/ __PVT__id_mvmr;
        CData/*0:0*/ __PVT__id_mvrm;
        CData/*0:0*/ __PVT__id_push;
        CData/*0:0*/ __PVT__id_xthl;
        CData/*0:0*/ __PVT__id_sphl;
        CData/*0:0*/ __PVT__id_pchl;
        CData/*0:0*/ __PVT__id_xchg;
        CData/*0:0*/ __PVT__id_call;
        CData/*0:0*/ __PVT__id_eidi;
        CData/*0:0*/ __PVT__id_stlda;
        CData/*0:0*/ __PVT__id82;
        CData/*0:0*/ __PVT__id00;
        CData/*0:0*/ __PVT__id01;
        CData/*0:0*/ __PVT__id02;
        CData/*0:0*/ __PVT__id03;
        CData/*0:0*/ __PVT__id06;
        CData/*0:0*/ __PVT__id07;
        CData/*0:0*/ __PVT__id08;
        CData/*0:0*/ __PVT__id09;
        CData/*0:0*/ __PVT__id10;
        CData/*0:0*/ __PVT__jmpflag;
        CData/*0:0*/ __PVT__jmptake;
        CData/*0:0*/ __PVT__tree0;
        CData/*0:0*/ __PVT__tree1;
        CData/*0:0*/ __PVT__tree2;
        CData/*0:0*/ __PVT__t2806;
        CData/*0:0*/ __PVT__t2817;
        CData/*0:0*/ __PVT__t2819;
        CData/*0:0*/ __PVT__t3047;
        CData/*0:0*/ __PVT__t2998;
        CData/*0:0*/ __PVT__t3363;
        CData/*0:0*/ __PVT__t3403;
        CData/*0:0*/ __PVT__t3335;
        CData/*0:0*/ __PVT__t3361;
        CData/*7:0*/ __PVT__xr;
        CData/*7:0*/ __PVT__r;
        CData/*7:0*/ acc;
        CData/*7:0*/ __PVT__x;
        CData/*7:0*/ __PVT__s;
        CData/*0:0*/ __PVT__c__BRA__7__KET__;
        CData/*0:0*/ __PVT__c__BRA__3__KET__;
        CData/*0:0*/ __PVT__daa;
        CData/*0:0*/ __PVT__daa_6x;
        CData/*0:0*/ __PVT__a327;
        CData/*0:0*/ __PVT__a357;
        CData/*0:0*/ __PVT__a358;
        CData/*0:0*/ __PVT__alu_xrd;
        CData/*0:0*/ __PVT__alu_ard;
        CData/*0:0*/ __PVT__psw_z;
        CData/*0:0*/ __PVT__psw_s;
        CData/*0:0*/ __PVT__psw_p;
        CData/*0:0*/ __PVT__psw_c;
        CData/*0:0*/ __PVT__psw_ac;
        CData/*0:0*/ __PVT__tmp_c;
        CData/*0:0*/ __PVT__t2222;
    };
    struct {
        CData/*0:0*/ __PVT__t1375;
        CData/*0:0*/ __PVT__t1497;
        CData/*0:0*/ __PVT__t1698;
        CData/*0:0*/ __PVT__t1668;
        CData/*0:0*/ __PVT__t1780;
        CData/*0:0*/ __PVT__t1993;
        CData/*0:0*/ __PVT__t1994;
        CData/*0:0*/ __PVT__psw_ld;
        CData/*0:0*/ __PVT__psw_wr;
        CData/*0:0*/ __PVT__t2046;
        CData/*0:0*/ __PVT__t2133;
        CData/*0:0*/ __PVT__t2175;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_1;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_2;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_9;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_13;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_14;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_15;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_18;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_25;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_26;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_29;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_32;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_33;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_34;
        CData/*0:0*/ __VdfgRegularize_h11d02322_0_36;
        CData/*0:0*/ __VdfgRegularize_h11d02322_1_0;
        CData/*0:0*/ __Vfunc_cmp__16__Vfuncout;
        CData/*7:0*/ __Vfunc_cmp__16__i;
        CData/*0:0*/ __Vfunc_cmp__17__Vfuncout;
        CData/*7:0*/ __Vfunc_cmp__17__i;
        CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_0;
        CData/*0:0*/ __Vdly__twf1;
        CData/*0:0*/ __Vdly__m1;
        CData/*0:0*/ __Vdly__inta;
        VL_OUT16(__PVT__pin_a,15,0);
        SData/*15:0*/ __PVT__a;
        SData/*15:0*/ __PVT__r16_pc;
        SData/*15:0*/ __PVT__r16_hl;
        SData/*15:0*/ __PVT__r16_de;
        SData/*15:0*/ __PVT__r16_bc;
        SData/*15:0*/ __PVT__r16_sp;
        SData/*15:0*/ __PVT__r16_wz;
        SData/*15:0*/ __PVT__mxo;
        SData/*15:0*/ __PVT__mxi;
    };

    // INTERNAL VARIABLES
    Vcpm_top__Syms* const vlSymsp;

    // CONSTRUCTORS
    Vcpm_top_vm80a_core(Vcpm_top__Syms* symsp, const char* v__name);
    ~Vcpm_top_vm80a_core();
    VL_UNCOPYABLE(Vcpm_top_vm80a_core);

    // INTERNAL METHODS
    void __Vconfigure(bool first);
};


#endif  // guard
