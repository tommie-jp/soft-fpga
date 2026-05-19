// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

extern const VlUnpacked<CData/*0:0*/, 1024> Vcpm_top__ConstPool__TABLE_h6a3f4859_0;

VL_ATTR_COLD void Vcpm_top_vm80a_core___stl_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___stl_sequent__TOP__cpm_top__cpu__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __PVT__dec16;
    __PVT__dec16 = 0;
    CData/*0:0*/ __PVT__iad16;
    __PVT__iad16 = 0;
    CData/*0:0*/ __PVT__t1467;
    __PVT__t1467 = 0;
    CData/*0:0*/ __PVT__t1513;
    __PVT__t1513 = 0;
    CData/*0:0*/ __PVT__t1519;
    __PVT__t1519 = 0;
    CData/*0:0*/ __PVT__id_inx;
    __PVT__id_inx = 0;
    CData/*0:0*/ __PVT__id_rlc;
    __PVT__id_rlc = 0;
    CData/*0:0*/ __PVT__id_rar;
    __PVT__id_rar = 0;
    CData/*0:0*/ __PVT__cl;
    __PVT__cl = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_5;
    __VdfgRegularize_h11d02322_0_5 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_7;
    __VdfgRegularize_h11d02322_0_7 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_10;
    __VdfgRegularize_h11d02322_0_10 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_27;
    __VdfgRegularize_h11d02322_0_27 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_30;
    __VdfgRegularize_h11d02322_0_30 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_31;
    __VdfgRegularize_h11d02322_0_31 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_35;
    __VdfgRegularize_h11d02322_0_35 = 0;
    CData/*0:0*/ __VdfgRegularize_h11d02322_0_37;
    __VdfgRegularize_h11d02322_0_37 = 0;
    CData/*0:0*/ __Vfunc_cmp__0__Vfuncout;
    __Vfunc_cmp__0__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__0__i;
    __Vfunc_cmp__0__i = 0;
    CData/*0:0*/ __Vfunc_cmp__1__Vfuncout;
    __Vfunc_cmp__1__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__1__i;
    __Vfunc_cmp__1__i = 0;
    CData/*0:0*/ __Vfunc_cmp__2__Vfuncout;
    __Vfunc_cmp__2__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__2__i;
    __Vfunc_cmp__2__i = 0;
    CData/*0:0*/ __Vfunc_cmp__3__Vfuncout;
    __Vfunc_cmp__3__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__3__i;
    __Vfunc_cmp__3__i = 0;
    CData/*0:0*/ __Vfunc_cmp__4__Vfuncout;
    __Vfunc_cmp__4__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__4__i;
    __Vfunc_cmp__4__i = 0;
    CData/*0:0*/ __Vfunc_cmp__5__Vfuncout;
    __Vfunc_cmp__5__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__5__i;
    __Vfunc_cmp__5__i = 0;
    CData/*0:0*/ __Vfunc_cmp__6__Vfuncout;
    __Vfunc_cmp__6__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__6__i;
    __Vfunc_cmp__6__i = 0;
    CData/*0:0*/ __Vfunc_cmp__7__Vfuncout;
    __Vfunc_cmp__7__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__7__i;
    __Vfunc_cmp__7__i = 0;
    CData/*0:0*/ __Vfunc_cmp__8__Vfuncout;
    __Vfunc_cmp__8__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__8__i;
    __Vfunc_cmp__8__i = 0;
    CData/*0:0*/ __Vfunc_cmp__9__Vfuncout;
    __Vfunc_cmp__9__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__9__i;
    __Vfunc_cmp__9__i = 0;
    CData/*0:0*/ __Vfunc_cmp__10__Vfuncout;
    __Vfunc_cmp__10__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__10__i;
    __Vfunc_cmp__10__i = 0;
    CData/*0:0*/ __Vfunc_cmp__11__Vfuncout;
    __Vfunc_cmp__11__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__11__i;
    __Vfunc_cmp__11__i = 0;
    CData/*0:0*/ __Vfunc_cmp__12__Vfuncout;
    __Vfunc_cmp__12__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__12__i;
    __Vfunc_cmp__12__i = 0;
    CData/*0:0*/ __Vfunc_cmp__13__Vfuncout;
    __Vfunc_cmp__13__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__13__i;
    __Vfunc_cmp__13__i = 0;
    CData/*0:0*/ __Vfunc_cmp__14__Vfuncout;
    __Vfunc_cmp__14__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__14__i;
    __Vfunc_cmp__14__i = 0;
    CData/*0:0*/ __Vfunc_cmp__15__Vfuncout;
    __Vfunc_cmp__15__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__15__i;
    __Vfunc_cmp__15__i = 0;
    CData/*0:0*/ __Vfunc_cmp__18__Vfuncout;
    __Vfunc_cmp__18__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__18__i;
    __Vfunc_cmp__18__i = 0;
    CData/*0:0*/ __Vfunc_cmp__19__Vfuncout;
    __Vfunc_cmp__19__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__19__i;
    __Vfunc_cmp__19__i = 0;
    CData/*0:0*/ __Vfunc_cmp__20__Vfuncout;
    __Vfunc_cmp__20__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__20__i;
    __Vfunc_cmp__20__i = 0;
    CData/*0:0*/ __Vfunc_cmp__21__Vfuncout;
    __Vfunc_cmp__21__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__21__i;
    __Vfunc_cmp__21__i = 0;
    CData/*0:0*/ __Vfunc_cmp__22__Vfuncout;
    __Vfunc_cmp__22__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__22__i;
    __Vfunc_cmp__22__i = 0;
    CData/*0:0*/ __Vfunc_cmp__23__Vfuncout;
    __Vfunc_cmp__23__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__23__i;
    __Vfunc_cmp__23__i = 0;
    CData/*0:0*/ __Vfunc_cmp__24__Vfuncout;
    __Vfunc_cmp__24__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__24__i;
    __Vfunc_cmp__24__i = 0;
    CData/*0:0*/ __Vfunc_cmp__25__Vfuncout;
    __Vfunc_cmp__25__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__25__i;
    __Vfunc_cmp__25__i = 0;
    CData/*0:0*/ __Vfunc_cmp__26__Vfuncout;
    __Vfunc_cmp__26__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__26__i;
    __Vfunc_cmp__26__i = 0;
    CData/*0:0*/ __Vfunc_cmp__27__Vfuncout;
    __Vfunc_cmp__27__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__27__i;
    __Vfunc_cmp__27__i = 0;
    CData/*0:0*/ __Vfunc_cmp__28__Vfuncout;
    __Vfunc_cmp__28__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__28__i;
    __Vfunc_cmp__28__i = 0;
    CData/*0:0*/ __Vfunc_cmp__29__Vfuncout;
    __Vfunc_cmp__29__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__29__i;
    __Vfunc_cmp__29__i = 0;
    CData/*0:0*/ __Vfunc_cmp__30__Vfuncout;
    __Vfunc_cmp__30__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__30__i;
    __Vfunc_cmp__30__i = 0;
    CData/*0:0*/ __Vfunc_cmp__31__Vfuncout;
    __Vfunc_cmp__31__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__31__i;
    __Vfunc_cmp__31__i = 0;
    CData/*0:0*/ __Vfunc_cmp__32__Vfuncout;
    __Vfunc_cmp__32__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__32__i;
    __Vfunc_cmp__32__i = 0;
    CData/*0:0*/ __Vfunc_cmp__33__Vfuncout;
    __Vfunc_cmp__33__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__33__i;
    __Vfunc_cmp__33__i = 0;
    CData/*0:0*/ __Vfunc_cmp__34__Vfuncout;
    __Vfunc_cmp__34__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__34__i;
    __Vfunc_cmp__34__i = 0;
    CData/*0:0*/ __Vfunc_cmp__35__Vfuncout;
    __Vfunc_cmp__35__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__35__i;
    __Vfunc_cmp__35__i = 0;
    CData/*0:0*/ __Vfunc_cmp__36__Vfuncout;
    __Vfunc_cmp__36__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__36__i;
    __Vfunc_cmp__36__i = 0;
    CData/*0:0*/ __Vfunc_cmp__37__Vfuncout;
    __Vfunc_cmp__37__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__37__i;
    __Vfunc_cmp__37__i = 0;
    CData/*0:0*/ __Vfunc_cmp__38__Vfuncout;
    __Vfunc_cmp__38__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__38__i;
    __Vfunc_cmp__38__i = 0;
    CData/*0:0*/ __Vfunc_cmp__39__Vfuncout;
    __Vfunc_cmp__39__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__39__i;
    __Vfunc_cmp__39__i = 0;
    CData/*0:0*/ __Vfunc_cmp__40__Vfuncout;
    __Vfunc_cmp__40__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__40__i;
    __Vfunc_cmp__40__i = 0;
    CData/*0:0*/ __Vfunc_cmp__41__Vfuncout;
    __Vfunc_cmp__41__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__41__i;
    __Vfunc_cmp__41__i = 0;
    CData/*0:0*/ __Vfunc_cmp__42__Vfuncout;
    __Vfunc_cmp__42__Vfuncout = 0;
    CData/*7:0*/ __Vfunc_cmp__42__i;
    __Vfunc_cmp__42__i = 0;
    SData/*9:0*/ __Vtableidx1;
    __Vtableidx1 = 0;
    // Body
    vlSelfRef.__PVT__h889 = ((IData)(vlSelfRef.__PVT__t2f1) 
                             | (IData)(vlSelfRef.__PVT__twf1));
    vlSelfRef.__PVT__mxwh = ((IData)(vlSelfRef.__PVT__t2817) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    vlSelfRef.__PVT__mxwl = ((IData)(vlSelfRef.__PVT__t2819) 
                             | ((IData)(vlSelfRef.__PVT__i03) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    __Vfunc_cmp__4__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__4__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (4U 
                                                       ^ (IData)(__Vfunc_cmp__4__i))))));
    vlSelfRef.__PVT__id_inr = __Vfunc_cmp__4__Vfuncout;
    __Vfunc_cmp__5__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__5__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (5U 
                                                       ^ (IData)(__Vfunc_cmp__5__i))))));
    vlSelfRef.__PVT__id_dcr = __Vfunc_cmp__5__Vfuncout;
    __Vfunc_cmp__30__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__30__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc2U 
                                                        ^ (IData)(__Vfunc_cmp__30__i))))));
    vlSelfRef.__PVT__id_jxx = __Vfunc_cmp__30__Vfuncout;
    __Vfunc_cmp__35__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__35__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0xc3U 
                                                        ^ (IData)(__Vfunc_cmp__35__i))))));
    vlSelfRef.__PVT__id_jmp = __Vfunc_cmp__35__Vfuncout;
    __Vfunc_cmp__39__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__39__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xf1U 
                                                     ^ (IData)(__Vfunc_cmp__39__i)))));
    vlSelfRef.__PVT__id_popsw = __Vfunc_cmp__39__Vfuncout;
    __Vfunc_cmp__41__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__41__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x3fU 
                                                    | (~ 
                                                       (0xc0U 
                                                        ^ (IData)(__Vfunc_cmp__41__i))))));
    vlSelfRef.__PVT__id_11x = __Vfunc_cmp__41__Vfuncout;
    __Vfunc_cmp__42__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__42__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xf5U 
                                                     ^ (IData)(__Vfunc_cmp__42__i)))));
    vlSelfRef.__PVT__id_pupsw = __Vfunc_cmp__42__Vfuncout;
    vlSelfRef.__VdfgRegularize_h11d02322_0_29 = (IData)(
                                                        (((IData)(vlSelfRef.acc) 
                                                          >> 3U) 
                                                         & (0U 
                                                            != 
                                                            (6U 
                                                             & (IData)(vlSelfRef.acc)))));
    __Vfunc_cmp__15__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__15__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x2aU 
                                                     ^ (IData)(__Vfunc_cmp__15__i)))));
    vlSelfRef.__PVT__id_lhld = __Vfunc_cmp__15__Vfuncout;
    __Vfunc_cmp__0__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__0__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ (IData)(__Vfunc_cmp__0__i)))));
    vlSelfRef.__PVT__id_nop = __Vfunc_cmp__0__Vfuncout;
    __Vfunc_cmp__28__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__28__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xebU 
                                                     ^ (IData)(__Vfunc_cmp__28__i)))));
    vlSelfRef.__PVT__id_xchg = __Vfunc_cmp__28__Vfuncout;
    __Vfunc_cmp__34__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__34__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0xf3U 
                                                        ^ (IData)(__Vfunc_cmp__34__i))))));
    vlSelfRef.__PVT__id_eidi = __Vfunc_cmp__34__Vfuncout;
    vlSelfRef.__PVT__alu_xrd = ((IData)(vlSelfRef.__PVT__a358) 
                                | (IData)(vlSelfRef.__PVT__t1698));
    vlSelfRef.__VdfgRegularize_h11d02322_0_1 = (1U 
                                                & ((~ (IData)(vlSelfRef.__PVT__reset)) 
                                                   & (~ 
                                                      ((IData)(vlSelfRef.__PVT__m1f1) 
                                                       & (IData)(vlSelfRef.__PVT__t3f1)))));
    __Vfunc_cmp__40__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__40__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xd3U 
                                                     ^ (IData)(__Vfunc_cmp__40__i)))));
    vlSelfRef.__PVT__id_out = __Vfunc_cmp__40__Vfuncout;
    __Vfunc_cmp__38__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__38__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xdbU 
                                                     ^ (IData)(__Vfunc_cmp__38__i)))));
    vlSelfRef.__PVT__id_in = __Vfunc_cmp__38__Vfuncout;
    vlSelfRef.__VdfgRegularize_h11d02322_0_2 = ((IData)(vlSelfRef.__PVT__t4f1) 
                                                | (IData)(vlSelfRef.__PVT__t5f1));
    __Vfunc_cmp__14__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__14__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x22U 
                                                     ^ (IData)(__Vfunc_cmp__14__i)))));
    vlSelfRef.__PVT__id_shld = __Vfunc_cmp__14__Vfuncout;
    vlSelfRef.__VdfgRegularize_h11d02322_0_13 = (1U 
                                                 & ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                    & (~ (IData)(vlSelfRef.__PVT__i25))));
    vlSelfRef.__VdfgRegularize_h11d02322_0_33 = ((IData)(vlSelfRef.__PVT__i14) 
                                                 & (IData)(vlSelfRef.__PVT__i25));
    __Vfunc_cmp__21__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__21__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0x86U 
                                                        ^ (IData)(__Vfunc_cmp__21__i))))));
    vlSelfRef.__PVT__id_opm = __Vfunc_cmp__21__Vfuncout;
    vlSelfRef.__VdfgRegularize_h11d02322_1_0 = ((IData)(vlSelfRef.m4) 
                                                | (IData)(vlSelfRef.m5));
    __Vfunc_cmp__31__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__31__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc0U 
                                                        ^ (IData)(__Vfunc_cmp__31__i))))));
    vlSelfRef.__PVT__id_rxx = __Vfunc_cmp__31__Vfuncout;
    __Vfunc_cmp__32__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__32__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x10U 
                                                    | (~ 
                                                       (0xc9U 
                                                        ^ (IData)(__Vfunc_cmp__32__i))))));
    vlSelfRef.__PVT__id_ret = __Vfunc_cmp__32__Vfuncout;
    __Vfunc_cmp__12__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__12__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0x32U 
                                                        ^ (IData)(__Vfunc_cmp__12__i))))));
    vlSelfRef.__PVT__id_stlda = __Vfunc_cmp__12__Vfuncout;
    __Vfunc_cmp__22__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__22__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (0xc1U 
                                                        ^ (IData)(__Vfunc_cmp__22__i))))));
    vlSelfRef.__PVT__id_pop = __Vfunc_cmp__22__Vfuncout;
    __Vfunc_cmp__11__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__11__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (1U 
                                                    | (~ 
                                                       (0x34U 
                                                        ^ (IData)(__Vfunc_cmp__11__i))))));
    vlSelfRef.__PVT__id_idm = __Vfunc_cmp__11__Vfuncout;
    __Vfunc_cmp__13__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__13__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x36U 
                                                     ^ (IData)(__Vfunc_cmp__13__i)))));
    vlSelfRef.__PVT__id_mvim = __Vfunc_cmp__13__Vfuncout;
    vlSelfRef.__VdfgRegularize_h11d02322_0_36 = ((~ (IData)(vlSelfRef.__PVT__i25)) 
                                                 & (IData)(vlSelfRef.__PVT__i14));
    vlSelfRef.__VdfgRegularize_h11d02322_0_9 = ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                & (IData)(vlSelfRef.__PVT__i25));
    __Vfunc_cmp__2__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__2__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x18U 
                                                   | (~ 
                                                      (2U 
                                                       ^ (IData)(__Vfunc_cmp__2__i))))));
    vlSelfRef.__PVT__id_lsax = __Vfunc_cmp__2__Vfuncout;
    __Vfunc_cmp__36__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__36__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0xd3U 
                                                        ^ (IData)(__Vfunc_cmp__36__i))))));
    vlSelfRef.__PVT__id_io = __Vfunc_cmp__36__Vfuncout;
    __Vfunc_cmp__33__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__33__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (0xcdU 
                                                        ^ (IData)(__Vfunc_cmp__33__i))))));
    vlSelfRef.__PVT__id_call = __Vfunc_cmp__33__Vfuncout;
    __Vfunc_cmp__27__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__27__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xe9U 
                                                     ^ (IData)(__Vfunc_cmp__27__i)))));
    vlSelfRef.__PVT__id_pchl = __Vfunc_cmp__27__Vfuncout;
    __Vfunc_cmp__29__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__29__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc4U 
                                                        ^ (IData)(__Vfunc_cmp__29__i))))));
    vlSelfRef.__PVT__id_cxx = __Vfunc_cmp__29__Vfuncout;
    __Vfunc_cmp__26__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__26__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xf9U 
                                                     ^ (IData)(__Vfunc_cmp__26__i)))));
    vlSelfRef.__PVT__id_sphl = __Vfunc_cmp__26__Vfuncout;
    __Vfunc_cmp__24__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__24__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc7U 
                                                        ^ (IData)(__Vfunc_cmp__24__i))))));
    vlSelfRef.__PVT__id_rst = __Vfunc_cmp__24__Vfuncout;
    __Vfunc_cmp__23__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__23__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (0xc5U 
                                                        ^ (IData)(__Vfunc_cmp__23__i))))));
    vlSelfRef.__PVT__id_push = __Vfunc_cmp__23__Vfuncout;
    __Vfunc_cmp__18__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__18__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x76U 
                                                     ^ (IData)(__Vfunc_cmp__18__i)))));
    vlSelfRef.__PVT__id_hlt = __Vfunc_cmp__18__Vfuncout;
    __Vfunc_cmp__1__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__1__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x30U 
                                                   | (~ 
                                                      (1U 
                                                       ^ (IData)(__Vfunc_cmp__1__i))))));
    vlSelfRef.__PVT__id_lxi = __Vfunc_cmp__1__Vfuncout;
    __Vfunc_cmp__3__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__3__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x30U 
                                                   | (~ 
                                                      (3U 
                                                       ^ (IData)(__Vfunc_cmp__3__i))))));
    __PVT__id_inx = __Vfunc_cmp__3__Vfuncout;
    __Vfunc_cmp__9__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__9__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x30U 
                                                   | (~ 
                                                      (0x0bU 
                                                       ^ (IData)(__Vfunc_cmp__9__i))))));
    vlSelfRef.__PVT__id_dcx = __Vfunc_cmp__9__Vfuncout;
    __Vfunc_cmp__6__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__6__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x39U 
                                                   | (~ 
                                                      (4U 
                                                       ^ (IData)(__Vfunc_cmp__6__i))))));
    vlSelfRef.__PVT__id_idr = __Vfunc_cmp__6__Vfuncout;
    __Vfunc_cmp__19__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__19__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x3fU 
                                                    | (~ 
                                                       (0x40U 
                                                        ^ (IData)(__Vfunc_cmp__19__i))))));
    vlSelfRef.__PVT__id_mov = __Vfunc_cmp__19__Vfuncout;
    __Vfunc_cmp__8__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__8__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x30U 
                                                   | (~ 
                                                      (9U 
                                                       ^ (IData)(__Vfunc_cmp__8__i))))));
    vlSelfRef.__PVT__id_dad = __Vfunc_cmp__8__Vfuncout;
    __Vfunc_cmp__7__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__7__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (6U 
                                                       ^ (IData)(__Vfunc_cmp__7__i))))));
    vlSelfRef.__PVT__id_mvi = __Vfunc_cmp__7__Vfuncout;
    __Vfunc_cmp__10__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__10__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (7U 
                                                        ^ (IData)(__Vfunc_cmp__10__i))))));
    vlSelfRef.__PVT__id_opa = __Vfunc_cmp__10__Vfuncout;
    __Vfunc_cmp__25__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__25__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xe3U 
                                                     ^ (IData)(__Vfunc_cmp__25__i)))));
    vlSelfRef.__PVT__id_xthl = __Vfunc_cmp__25__Vfuncout;
    __Vfunc_cmp__37__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__37__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc6U 
                                                        ^ (IData)(__Vfunc_cmp__37__i))))));
    vlSelfRef.__PVT__id_opi = __Vfunc_cmp__37__Vfuncout;
    __Vfunc_cmp__20__i = vlSelfRef.__PVT__i;
    __Vfunc_cmp__20__Vfuncout = (0x000000ffU == (0x000000ffU 
                                                 & (0x3fU 
                                                    | (~ 
                                                       (0x80U 
                                                        ^ (IData)(__Vfunc_cmp__20__i))))));
    vlSelfRef.__PVT__id_op = __Vfunc_cmp__20__Vfuncout;
    __Vtableidx1 = (((IData)(vlSelfRef.__PVT__tmp_c) 
                     << 9U) | (((IData)(vlSelfRef.acc) 
                                << 1U) | (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_29)));
    vlSelfRef.__PVT__daa_6x = Vcpm_top__ConstPool__TABLE_h6a3f4859_0
        [__Vtableidx1];
    vlSelfRef.__PVT__sy_inp = ((IData)(vlSelfRef.__PVT__id_in) 
                               & (IData)(vlSelfRef.m5));
    __VdfgRegularize_h11d02322_0_31 = ((IData)(vlSelfRef.__PVT__id_ret) 
                                       | (IData)(vlSelfRef.__PVT__id_rxx));
    vlSelfRef.__PVT__jmpflag = (((IData)(vlSelfRef.__PVT__psw_c) 
                                 & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_36)) 
                                | (((IData)(vlSelfRef.__PVT__psw_p) 
                                    & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_9)) 
                                   | (((IData)(vlSelfRef.__PVT__psw_z) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_13)) 
                                      | ((IData)(vlSelfRef.__PVT__psw_s) 
                                         & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_33)))));
    __VdfgRegularize_h11d02322_0_27 = ((IData)(vlSelfRef.__PVT__id_pop) 
                                       | (IData)(vlSelfRef.__PVT__id_push));
    vlSelfRef.__PVT__thalt = ((~ (IData)(vlSelfRef.m1)) 
                              & (IData)(vlSelfRef.__PVT__id_hlt));
    vlSelfRef.__PVT__m839 = (1U & ((~ (IData)(vlSelfRef.__PVT__t976)) 
                                   | (~ (IData)(vlSelfRef.__PVT__id_hlt))));
    vlSelfRef.__PVT__id_mvrm = (([&]() {
                vlSelfRef.__Vfunc_cmp__17__i = vlSelfRef.__PVT__i;
                vlSelfRef.__Vfunc_cmp__17__Vfuncout 
                    = (0x000000ffU == (0x000000ffU 
                                       & (0x38U | (~ 
                                                   (0x46U 
                                                    ^ (IData)(vlSelfRef.__Vfunc_cmp__17__i))))));
            }(), (IData)(vlSelfRef.__Vfunc_cmp__17__Vfuncout)) 
                                & (~ (IData)(vlSelfRef.__PVT__id_hlt)));
    vlSelfRef.__PVT__id_mvmr = (([&]() {
                vlSelfRef.__Vfunc_cmp__16__i = vlSelfRef.__PVT__i;
                vlSelfRef.__Vfunc_cmp__16__Vfuncout 
                    = (0x000000ffU == (0x000000ffU 
                                       & (7U | (~ (0x70U 
                                                   ^ (IData)(vlSelfRef.__Vfunc_cmp__16__i))))));
            }(), (IData)(vlSelfRef.__Vfunc_cmp__16__Vfuncout)) 
                                & (~ (IData)(vlSelfRef.__PVT__id_hlt)));
    vlSelfRef.__VdfgRegularize_h11d02322_0_26 = ((IData)(vlSelfRef.__PVT__id_dcx) 
                                                 | (IData)(__PVT__id_inx));
    vlSelfRef.__PVT__ready_int = ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_1_0) 
                                  & (IData)(vlSelfRef.__PVT__id_dad));
    vlSelfRef.__VdfgRegularize_h11d02322_0_32 = ((IData)(vlSelfRef.__PVT__id_lsax) 
                                                 | (IData)(vlSelfRef.__PVT__id_mvi));
    vlSelfRef.__PVT__id_sha = ((~ ((IData)(vlSelfRef.__PVT__i) 
                                   >> 5U)) & (IData)(vlSelfRef.__PVT__id_opa));
    vlSelfRef.__PVT__id_stc = (IData)(((0x30U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__PVT__id_opa)));
    __PVT__id_rar = (IData)(((0x18U == (0x38U & (IData)(vlSelfRef.__PVT__i))) 
                             & (IData)(vlSelfRef.__PVT__id_opa)));
    vlSelfRef.__PVT__id_daa = (IData)(((0x20U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__PVT__id_opa)));
    __PVT__id_rlc = (IData)(((0U == (0x38U & (IData)(vlSelfRef.__PVT__i))) 
                             & (IData)(vlSelfRef.__PVT__id_opa)));
    vlSelfRef.__PVT__id_rxc = (IData)(((8U == (0x28U 
                                               & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__PVT__id_opa)));
    vlSelfRef.__PVT__id_cma = (IData)(((0x28U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__PVT__id_opa)));
    vlSelfRef.__PVT__id03 = ((IData)(vlSelfRef.__PVT__id_rst) 
                             | ((IData)(vlSelfRef.__PVT__id_push) 
                                | ((IData)(vlSelfRef.__PVT__id_xthl) 
                                   | ((IData)(vlSelfRef.__PVT__id_call) 
                                      | (IData)(vlSelfRef.__PVT__id_cxx)))));
    vlSelfRef.__PVT__id00 = ((IData)(vlSelfRef.__PVT__id_xthl) 
                             | ((IData)(vlSelfRef.__PVT__id_pchl) 
                                | (IData)(vlSelfRef.__PVT__id_sphl)));
    __VdfgRegularize_h11d02322_0_37 = ((~ (IData)(vlSelfRef.__PVT__id_xthl)) 
                                       & (IData)(vlSelfRef.__PVT__t4f1));
    __VdfgRegularize_h11d02322_0_30 = ((IData)(vlSelfRef.__PVT__id_io) 
                                       | (IData)(vlSelfRef.__PVT__id_opi));
    vlSelfRef.__VdfgRegularize_h11d02322_0_15 = ((IData)(vlSelfRef.__PVT__id_op) 
                                                 | ((IData)(vlSelfRef.__PVT__id_mov) 
                                                    & (IData)(vlSelfRef.t4)));
    vlSelfRef.__PVT__id08 = ((IData)(vlSelfRef.__PVT__id_mov) 
                             | ((IData)(vlSelfRef.__PVT__id_mvi) 
                                | ((IData)(vlSelfRef.__PVT__id_idr) 
                                   | (IData)(vlSelfRef.__PVT__id_op))));
    vlSelfRef.__VdfgRegularize_h11d02322_0_25 = ((IData)(vlSelfRef.__PVT__id_op) 
                                                 | (IData)(vlSelfRef.__PVT__id_opi));
    vlSelfRef.__PVT__id01 = ((IData)(vlSelfRef.__PVT__id_pop) 
                             | (IData)(__VdfgRegularize_h11d02322_0_31));
    vlSelfRef.__PVT__start = (1U & ((~ (IData)(vlSelfRef.__PVT__m839)) 
                                    | ((IData)(vlSelfRef.__PVT__t953) 
                                       | (((~ ((IData)(vlSelfRef.__PVT__hold) 
                                               & (IData)(vlSelfRef.__PVT__t887))) 
                                           & (IData)(vlSelfRef.eom)) 
                                          | ((IData)(vlSymsp->TOP__cpm_top.f2) 
                                             & ((~ 
                                                 ((IData)(vlSelfRef.__PVT__t3f1) 
                                                  | ((IData)(vlSelfRef.__PVT__twf1) 
                                                     | (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_2)))) 
                                                & (((~ (IData)(vlSelfRef.__PVT__t382)) 
                                                    & (IData)(vlSelfRef.__PVT__hold)) 
                                                   | (IData)(vlSelfRef.__PVT__t383))))))));
    vlSelfRef.__VdfgRegularize_h11d02322_0_34 = ((~ (IData)(vlSelfRef.__PVT__reset)) 
                                                 & ((~ 
                                                     ((~ (IData)(vlSelfRef.__PVT__t1f1)) 
                                                      & (IData)(vlSelfRef.__PVT__sy_stack))) 
                                                    & (IData)(vlSelfRef.__PVT__m839)));
    vlSelfRef.__PVT__id10 = ((IData)(__VdfgRegularize_h11d02322_0_27) 
                             | ((IData)(vlSelfRef.__PVT__id_mvi) 
                                | (IData)(vlSelfRef.__PVT__id_mvrm)));
    vlSelfRef.__PVT__id07 = ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_26) 
                             | ((IData)(vlSelfRef.__PVT__id_dad) 
                                | (IData)(vlSelfRef.__PVT__id_lxi)));
    vlSelfRef.__PVT__sy_wo_n = ((IData)(vlSelfRef.m1) 
                                | ((IData)(vlSelfRef.m2) 
                                   | ((IData)(vlSelfRef.m3) 
                                      | ((~ (IData)(vlSelfRef.__PVT__ready_int)) 
                                         & (((~ ((IData)(vlSelfRef.__PVT__id_push) 
                                                 | ((IData)(vlSelfRef.__PVT__id_rst) 
                                                    | ((IData)(vlSelfRef.__PVT__id_cxx) 
                                                       | ((IData)(vlSelfRef.__PVT__id_xthl) 
                                                          | ((IData)(vlSelfRef.__PVT__id_call) 
                                                             | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                                                | ((IData)(vlSelfRef.__PVT__id_shld) 
                                                                   | ((~ 
                                                                       ((IData)(vlSelfRef.__PVT__i) 
                                                                        >> 3U)) 
                                                                      & ((IData)(vlSelfRef.__PVT__id_lsax) 
                                                                         | (IData)(vlSelfRef.__PVT__id_stlda))))))))))) 
                                             & (IData)(vlSelfRef.m4)) 
                                            | ((~ ((IData)(vlSelfRef.__PVT__id_push) 
                                                   | ((IData)(vlSelfRef.__PVT__id_idm) 
                                                      | ((IData)(vlSelfRef.__PVT__id_rst) 
                                                         | ((IData)(vlSelfRef.__PVT__id_cxx) 
                                                            | ((IData)(vlSelfRef.__PVT__id_xthl) 
                                                               | ((IData)(vlSelfRef.__PVT__id_call) 
                                                                  | ((IData)(vlSelfRef.__PVT__id_mvim) 
                                                                     | ((IData)(vlSelfRef.__PVT__id_shld) 
                                                                        | ((~ 
                                                                            ((IData)(vlSelfRef.__PVT__i) 
                                                                             >> 3U)) 
                                                                           & (IData)(vlSelfRef.__PVT__id_io))))))))))) 
                                               & (IData)(vlSelfRef.m5)))))));
    vlSelfRef.__PVT__daa = ((IData)(vlSelfRef.__PVT__id_daa) 
                            & (IData)(vlSelfRef.__PVT__t4f1));
    vlSelfRef.__PVT__id09 = ((IData)(vlSelfRef.__PVT__id03) 
                             | (IData)(vlSelfRef.__PVT__id_shld));
    vlSelfRef.__VdfgRegularize_h11d02322_0_18 = ((IData)(vlSelfRef.__PVT__id03) 
                                                 | (IData)(vlSelfRef.__PVT__id_sphl));
    __PVT__iad16 = (1U & ((~ ((IData)(vlSelfRef.__PVT__id00) 
                              & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_2))) 
                          & ((~ (IData)(vlSelfRef.__PVT__minta)) 
                             | ((IData)(vlSelfRef.__PVT__t3144) 
                                | (IData)(vlSelfRef.m5)))));
    __PVT__t1467 = ((IData)(vlSelfRef.__PVT__tree1) 
                    | ((IData)(vlSelfRef.__PVT__id03) 
                       & (IData)(__VdfgRegularize_h11d02322_0_37)));
    __PVT__t1519 = ((IData)(vlSelfRef.__PVT__tree2) 
                    | ((IData)(vlSelfRef.__PVT__id00) 
                       & (IData)(__VdfgRegularize_h11d02322_0_37)));
    vlSelfRef.__PVT__id02 = ((IData)(vlSelfRef.__PVT__id_mvi) 
                             | (IData)(__VdfgRegularize_h11d02322_0_30));
    vlSelfRef.__PVT__id82 = ((IData)(__VdfgRegularize_h11d02322_0_27) 
                             | ((IData)(vlSelfRef.__PVT__id_idm) 
                                | ((IData)(vlSelfRef.__PVT__id_opm) 
                                   | ((IData)(vlSelfRef.__PVT__id_dad) 
                                      | ((IData)(vlSelfRef.__PVT__id_rst) 
                                         | ((IData)(__VdfgRegularize_h11d02322_0_31) 
                                            | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                               | ((IData)(vlSelfRef.__PVT__id_mvrm) 
                                                  | ((IData)(vlSelfRef.__PVT__id_hlt) 
                                                     | ((IData)(vlSelfRef.__PVT__id_mvim) 
                                                        | ((IData)(__VdfgRegularize_h11d02322_0_30) 
                                                           | (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_32))))))))))));
    vlSelfRef.__PVT__acc_sel = ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_15)
                                 ? (7U == (7U & (IData)(vlSelfRef.__PVT__i)))
                                 : (7U == (7U & ((IData)(vlSelfRef.__PVT__i) 
                                                 >> 3U))));
    vlSelfRef.__PVT__alu_ard = ((IData)(vlSelfRef.__PVT__t1375) 
                                | ((IData)(vlSelfRef.__PVT__t1993) 
                                   & (((IData)(vlSelfRef.__PVT__t1994) 
                                       & (IData)(vlSelfRef.__PVT__id08)) 
                                      | ((IData)(vlSelfRef.__PVT__id_opa) 
                                         | ((IData)(vlSelfRef.__PVT__id_stlda) 
                                            | ((IData)(vlSelfRef.__PVT__id_io) 
                                               | (IData)(vlSelfRef.__PVT__id_lsax)))))));
    __VdfgRegularize_h11d02322_0_5 = ((IData)(vlSelfRef.__PVT__id08) 
                                      & (IData)(vlSelfRef.__PVT__t4f1));
    vlSelfRef.__PVT__id_add = (IData)(((0U == (0x38U 
                                               & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_adc = (IData)(((8U == (0x38U 
                                               & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_ana = (IData)(((0x20U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_ora = (IData)(((0x30U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_xra = (IData)(((0x28U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_sub = (IData)(((0x10U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_sbb = (IData)(((0x18U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id_cmp = (IData)(((0x38U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_25)));
    vlSelfRef.__PVT__id06 = ((IData)(vlSelfRef.__PVT__id01) 
                             | ((IData)(vlSelfRef.__PVT__id_dad) 
                                | ((IData)(vlSelfRef.__PVT__id_io) 
                                   | (IData)(vlSelfRef.__PVT__id_lhld))));
    __PVT__t1513 = (((IData)(vlSelfRef.__PVT__t4f1) 
                     & (IData)(vlSelfRef.__PVT__id07)) 
                    | (IData)(vlSelfRef.__PVT__t3335));
    vlSelfRef.__PVT__t1460 = ((~ ((~ (IData)(vlSelfRef.__PVT__jmptake)) 
                                  & ((IData)(vlSelfRef.__PVT__id_cxx) 
                                     & (IData)(vlSelfRef.__PVT__t5)))) 
                              & (((IData)(vlSelfRef.t1) 
                                  & ((((IData)(vlSelfRef.m2) 
                                       | (IData)(vlSelfRef.m3)) 
                                      & (IData)(vlSelfRef.__PVT__id00)) 
                                     | (((IData)(vlSelfRef.__PVT__id01) 
                                         | (IData)(vlSelfRef.__PVT__id03)) 
                                        & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_1_0)))) 
                                 | (((IData)(vlSelfRef.t2) 
                                     & (((IData)(vlSelfRef.m2) 
                                         & (IData)(vlSelfRef.__PVT__id00)) 
                                        | ((IData)(vlSelfRef.__PVT__id01) 
                                           & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_1_0)))) 
                                    | (((IData)(vlSelfRef.t3) 
                                        & ((IData)(vlSelfRef.m4) 
                                           & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_18))) 
                                       | ((IData)(vlSelfRef.__PVT__t5) 
                                          & ((IData)(vlSelfRef.m1) 
                                             & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_18)))))));
    __PVT__dec16 = ((IData)(__PVT__iad16) & (((IData)(vlSelfRef.__PVT__id03) 
                                              | (IData)(vlSelfRef.__PVT__id_dcx)) 
                                             & ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_2) 
                                                | ((IData)(vlSelfRef.__PVT__m4f1) 
                                                   | (IData)(vlSelfRef.__PVT__m5f1)))));
    vlSelfRef.__VdfgRegularize_h11d02322_0_14 = (1U 
                                                 & (~ 
                                                    ((IData)(vlSelfRef.__PVT__m1f1) 
                                                     & (IData)(vlSelfRef.__PVT__id82))));
    vlSelfRef.__PVT__mxrl = ((IData)(vlSelfRef.__PVT__t3047) 
                             | ((IData)(__VdfgRegularize_h11d02322_0_5) 
                                & (IData)(vlSelfRef.__PVT__i03)));
    vlSelfRef.__PVT__mxrh = ((IData)(vlSelfRef.__PVT__t2998) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(__VdfgRegularize_h11d02322_0_5)));
    __PVT__cl = ((~ (IData)(vlSelfRef.__PVT__id_daa)) 
                 & ((~ ((IData)(vlSelfRef.__PVT__id_xra) 
                        | ((IData)(vlSelfRef.__PVT__id_rxc) 
                           | ((IData)(__PVT__id_rlc) 
                              | (IData)(vlSelfRef.__PVT__id_ora))))) 
                    & (IData)(vlSelfRef.__PVT__tmp_c)));
    vlSelfRef.__PVT__x = (0x000000ffU & (((IData)(vlSelfRef.__PVT__id_sub) 
                                          | ((IData)(vlSelfRef.__PVT__id_sbb) 
                                             | ((IData)(vlSelfRef.__PVT__id_cmp) 
                                                | (IData)(vlSelfRef.__PVT__id_cma))))
                                          ? (~ (IData)(vlSelfRef.__PVT__xr))
                                          : (IData)(vlSelfRef.__PVT__xr)));
    vlSelfRef.__PVT__mxr4 = ((IData)(__PVT__t1467) 
                             | ((IData)(__PVT__t1513) 
                                & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_33)));
    __VdfgRegularize_h11d02322_0_7 = ((IData)(__PVT__t1513) 
                                      | (((IData)(vlSelfRef.__PVT__t4f1) 
                                          & (IData)(vlSelfRef.__PVT__id08)) 
                                         | (IData)(vlSelfRef.__PVT__t3361)));
    vlSelfRef.__PVT__mxi = (0x0000ffffU & (((~ (IData)(__PVT__dec16)) 
                                            & (IData)(__PVT__iad16))
                                            ? ((IData)(1U) 
                                               + (IData)(vlSelfRef.__PVT__a))
                                            : ((IData)(vlSelfRef.__PVT__a) 
                                               - (IData)(__PVT__dec16))));
    vlSelfRef.__PVT__ms0 = ((~ ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_14) 
                                & (IData)(vlSelfRef.eom))) 
                            & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_34));
    vlSelfRef.__PVT__ms1 = ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_34) 
                            & ((~ ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_14) 
                                   & ((IData)(vlSelfRef.__PVT__t789) 
                                      | ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_26) 
                                         | ((IData)(vlSelfRef.__PVT__id_sphl) 
                                            | ((IData)(vlSelfRef.__PVT__id_pchl) 
                                               | ((IData)(vlSelfRef.__PVT__id_xchg) 
                                                  | ((IData)(vlSelfRef.__PVT__id_eidi) 
                                                     | ((IData)(vlSelfRef.__PVT__id_nop) 
                                                        | ((IData)(vlSelfRef.__PVT__id_op) 
                                                           | ((IData)(vlSelfRef.__PVT__id_opa) 
                                                              | ((IData)(vlSelfRef.__PVT__id_mov) 
                                                                 | ((~ (IData)(vlSelfRef.__PVT__id82)) 
                                                                    & (IData)(vlSelfRef.__PVT__id_idr)))))))))))))) 
                               & (IData)(vlSelfRef.eom)));
    vlSelfRef.__PVT__c__BRA__3__KET__ = (1U & ((((IData)(vlSelfRef.__PVT__r) 
                                                 & (IData)(vlSelfRef.__PVT__x)) 
                                                >> 3U) 
                                               | (((((IData)(vlSelfRef.__PVT__r) 
                                                     & (IData)(vlSelfRef.__PVT__x)) 
                                                    >> 2U) 
                                                   | (((((IData)(vlSelfRef.__PVT__r) 
                                                         & (IData)(vlSelfRef.__PVT__x)) 
                                                        >> 1U) 
                                                       | ((((IData)(vlSelfRef.__PVT__r) 
                                                            & (IData)(vlSelfRef.__PVT__x)) 
                                                           | ((IData)(__PVT__cl) 
                                                              & ((IData)(vlSelfRef.__PVT__r) 
                                                                 | (IData)(vlSelfRef.__PVT__x)))) 
                                                          & (((IData)(vlSelfRef.__PVT__r) 
                                                              | (IData)(vlSelfRef.__PVT__x)) 
                                                             >> 1U))) 
                                                      & (((IData)(vlSelfRef.__PVT__r) 
                                                          | (IData)(vlSelfRef.__PVT__x)) 
                                                         >> 2U))) 
                                                  & (((IData)(vlSelfRef.__PVT__r) 
                                                      | (IData)(vlSelfRef.__PVT__x)) 
                                                     >> 3U))));
    vlSelfRef.__PVT__mxr3 = ((IData)(__VdfgRegularize_h11d02322_0_7) 
                             & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_13));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0 = ((IData)(__PVT__t1467) 
                                                | ((IData)(__VdfgRegularize_h11d02322_0_7) 
                                                   | ((IData)(__PVT__t1519) 
                                                      | (IData)(vlSelfRef.__PVT__tree0))));
    __VdfgRegularize_h11d02322_0_35 = ((IData)(__VdfgRegularize_h11d02322_0_7) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_36));
    __VdfgRegularize_h11d02322_0_10 = (((IData)(__VdfgRegularize_h11d02322_0_7) 
                                        & (IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_9)) 
                                       | (IData)(__PVT__t1519));
    vlSelfRef.__PVT__c__BRA__7__KET__ = (1U & ((((IData)(vlSelfRef.__PVT__r) 
                                                 & (IData)(vlSelfRef.__PVT__x)) 
                                                >> 7U) 
                                               | (((((IData)(vlSelfRef.__PVT__r) 
                                                     & (IData)(vlSelfRef.__PVT__x)) 
                                                    >> 6U) 
                                                   | (((((IData)(vlSelfRef.__PVT__r) 
                                                         & (IData)(vlSelfRef.__PVT__x)) 
                                                        >> 5U) 
                                                       | (((((IData)(vlSelfRef.__PVT__r) 
                                                             & (IData)(vlSelfRef.__PVT__x)) 
                                                            >> 4U) 
                                                           | ((IData)(vlSelfRef.__PVT__c__BRA__3__KET__) 
                                                              & (((IData)(vlSelfRef.__PVT__r) 
                                                                  | (IData)(vlSelfRef.__PVT__x)) 
                                                                 >> 4U))) 
                                                          & (((IData)(vlSelfRef.__PVT__r) 
                                                              | (IData)(vlSelfRef.__PVT__x)) 
                                                             >> 5U))) 
                                                      & (((IData)(vlSelfRef.__PVT__r) 
                                                          | (IData)(vlSelfRef.__PVT__x)) 
                                                         >> 6U))) 
                                                  & (((IData)(vlSelfRef.__PVT__r) 
                                                      | (IData)(vlSelfRef.__PVT__x)) 
                                                     >> 7U))));
    vlSelfRef.__PVT__mxr1 = (((IData)(vlSelfRef.__PVT__xchg_dh) 
                              & (IData)(__VdfgRegularize_h11d02322_0_10)) 
                             | ((~ (IData)(vlSelfRef.__PVT__xchg_dh)) 
                                & (IData)(__VdfgRegularize_h11d02322_0_35)));
    vlSelfRef.__PVT__mxr2 = (((IData)(vlSelfRef.__PVT__xchg_dh) 
                              & (IData)(__VdfgRegularize_h11d02322_0_35)) 
                             | ((~ (IData)(vlSelfRef.__PVT__xchg_dh)) 
                                & (IData)(__VdfgRegularize_h11d02322_0_10)));
    vlSelfRef.__PVT__s = (0x000000ffU & (((IData)(__PVT__id_rlc) 
                                          & (IData)(vlSelfRef.__PVT__c__BRA__7__KET__)) 
                                         | ((((IData)(vlSelfRef.__PVT__id_rxc) 
                                              | ((IData)(vlSelfRef.__PVT__id_ora) 
                                                 | ((IData)(vlSelfRef.__PVT__id_ana) 
                                                    | (IData)(vlSelfRef.__PVT__id_xra))))
                                              ? 0U : 
                                             ((IData)(vlSelfRef.__PVT__x) 
                                              + ((IData)(vlSelfRef.__PVT__r) 
                                                 + (IData)(__PVT__cl)))) 
                                            | (((IData)(vlSelfRef.__PVT__id_rxc)
                                                 ? 
                                                ((0x00000080U 
                                                  & ((((IData)(vlSelfRef.__PVT__tmp_c) 
                                                       & (IData)(__PVT__id_rar)) 
                                                      | ((~ (IData)(__PVT__id_rar)) 
                                                         & (IData)(vlSelfRef.__PVT__r))) 
                                                     << 7U)) 
                                                 | (0x0000007fU 
                                                    & ((IData)(vlSelfRef.__PVT__r) 
                                                       >> 1U)))
                                                 : 0U) 
                                               | (((IData)(vlSelfRef.__PVT__id_ora)
                                                    ? 
                                                   ((IData)(vlSelfRef.__PVT__x) 
                                                    | (IData)(vlSelfRef.__PVT__r))
                                                    : 0U) 
                                                  | (((IData)(vlSelfRef.__PVT__id_ana)
                                                       ? 
                                                      ((IData)(vlSelfRef.__PVT__x) 
                                                       & (IData)(vlSelfRef.__PVT__r))
                                                       : 0U) 
                                                     | ((IData)(vlSelfRef.__PVT__id_xra)
                                                         ? 
                                                        ((IData)(vlSelfRef.__PVT__x) 
                                                         ^ (IData)(vlSelfRef.__PVT__r))
                                                         : 0U)))))));
    vlSelfRef.__PVT__mxo = ((IData)(vlSelfRef.__PVT__tree0)
                             ? ((IData)(vlSelfRef.__PVT__mxr1)
                                 ? 0U : ((IData)(vlSelfRef.__PVT__mxr2)
                                          ? 0U : ((IData)(vlSelfRef.__PVT__mxr3)
                                                   ? 0U
                                                   : 
                                                  ((IData)(vlSelfRef.__PVT__mxr4)
                                                    ? 0U
                                                    : 
                                                   ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                                     ? (IData)(vlSelfRef.__PVT__r16_pc)
                                                     : 0U)))))
                             : ((IData)(vlSelfRef.__PVT__mxr1)
                                 ? ((IData)(vlSelfRef.__PVT__mxr2)
                                     ? 0U : ((IData)(vlSelfRef.__PVT__mxr3)
                                              ? 0U : 
                                             ((IData)(vlSelfRef.__PVT__mxr4)
                                               ? 0U
                                               : ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                                   ? (IData)(vlSelfRef.__PVT__r16_hl)
                                                   : 0U))))
                                 : ((IData)(vlSelfRef.__PVT__mxr2)
                                     ? ((IData)(vlSelfRef.__PVT__mxr3)
                                         ? 0U : ((IData)(vlSelfRef.__PVT__mxr4)
                                                  ? 0U
                                                  : 
                                                 ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                                   ? (IData)(vlSelfRef.__PVT__r16_de)
                                                   : 0U)))
                                     : ((IData)(vlSelfRef.__PVT__mxr3)
                                         ? ((IData)(vlSelfRef.__PVT__mxr4)
                                             ? 0U : 
                                            ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                              ? (IData)(vlSelfRef.__PVT__r16_bc)
                                              : 0U))
                                         : ((IData)(vlSelfRef.__PVT__mxr4)
                                             ? ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                                 ? (IData)(vlSelfRef.__PVT__r16_sp)
                                                 : 0U)
                                             : ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)
                                                 ? 0U
                                                 : (IData)(vlSelfRef.__PVT__r16_wz)))))));
    vlSelfRef.__PVT__d = (((((((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                               & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                   & ((IData)(vlSelfRef.__PVT__di) 
                                      >> 7U)) | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                  & ((IData)(vlSelfRef.__PVT__mxo) 
                                                     >> 7U)) 
                                                 | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                     & ((IData)(vlSelfRef.__PVT__mxo) 
                                                        >> 0x0000000fU)) 
                                                    | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                        & ((IData)(vlSelfRef.__PVT__sy_wo_n) 
                                                           & ((~ (IData)(vlSelfRef.__PVT__sy_inp)) 
                                                              & (~ (IData)(vlSelfRef.__PVT__minta))))) 
                                                       | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                           & ((IData)(vlSelfRef.__PVT__xr) 
                                                              >> 7U)) 
                                                          | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                              & ((IData)(vlSelfRef.acc) 
                                                                 >> 7U)) 
                                                             | (((IData)(vlSelfRef.__PVT__psw_s) 
                                                                 & (IData)(vlSelfRef.__PVT__t2046)) 
                                                                | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                   & ((IData)(vlSelfRef.__PVT__s) 
                                                                      >> 7U)))))))))) 
                              << 3U) | (((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                         & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                             & ((IData)(vlSelfRef.__PVT__di) 
                                                >> 6U)) 
                                            | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                & ((IData)(vlSelfRef.__PVT__mxo) 
                                                   >> 6U)) 
                                               | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                   & ((IData)(vlSelfRef.__PVT__mxo) 
                                                      >> 0x0000000eU)) 
                                                  | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                      & (IData)(vlSelfRef.__PVT__sy_inp)) 
                                                     | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                         & ((IData)(vlSelfRef.__PVT__xr) 
                                                            >> 6U)) 
                                                        | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                            & ((IData)(vlSelfRef.acc) 
                                                               >> 6U)) 
                                                           | (((IData)(vlSelfRef.__PVT__psw_z) 
                                                               & (IData)(vlSelfRef.__PVT__t2046)) 
                                                              | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                 & ((IData)(vlSelfRef.__PVT__s) 
                                                                    >> 6U)))))))))) 
                                        << 2U)) | (
                                                   (((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                                     & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                         & ((IData)(vlSelfRef.__PVT__di) 
                                                            >> 5U)) 
                                                        | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                            & ((IData)(vlSelfRef.__PVT__mxo) 
                                                               >> 5U)) 
                                                           | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                               & ((IData)(vlSelfRef.__PVT__mxo) 
                                                                  >> 0x0000000dU)) 
                                                              | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                                  & (IData)(vlSelfRef.m1)) 
                                                                 | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                                     & ((IData)(vlSelfRef.__PVT__xr) 
                                                                        >> 5U)) 
                                                                    | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                                        & ((IData)(vlSelfRef.acc) 
                                                                           >> 5U)) 
                                                                       | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                          & ((IData)(vlSelfRef.__PVT__s) 
                                                                             >> 5U))))))))) 
                                                    << 1U) 
                                                   | ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                                      & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                          & ((IData)(vlSelfRef.__PVT__di) 
                                                             >> 4U)) 
                                                         | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                             & ((IData)(vlSelfRef.__PVT__mxo) 
                                                                >> 4U)) 
                                                            | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                                & ((IData)(vlSelfRef.__PVT__mxo) 
                                                                   >> 0x0000000cU)) 
                                                               | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                                   & ((IData)(vlSelfRef.__PVT__id_out) 
                                                                      & (IData)(vlSelfRef.m5))) 
                                                                  | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                                      & ((IData)(vlSelfRef.__PVT__xr) 
                                                                         >> 4U)) 
                                                                     | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                                         & ((IData)(vlSelfRef.acc) 
                                                                            >> 4U)) 
                                                                        | (((IData)(vlSelfRef.__PVT__psw_ac) 
                                                                            & (IData)(vlSelfRef.__PVT__t2046)) 
                                                                           | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                              & ((IData)(vlSelfRef.__PVT__s) 
                                                                                >> 4U)))))))))))) 
                           << 4U) | (((((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                        & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                            & ((IData)(vlSelfRef.__PVT__di) 
                                               >> 3U)) 
                                           | (((IData)(vlSelfRef.__PVT__mxrl) 
                                               & ((IData)(vlSelfRef.__PVT__mxo) 
                                                  >> 3U)) 
                                              | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                  & ((IData)(vlSelfRef.__PVT__mxo) 
                                                     >> 0x0000000bU)) 
                                                 | (((IData)(vlSelfRef.__PVT__id_hlt) 
                                                     & (IData)(vlSelfRef.__PVT__t1f1)) 
                                                    | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                        & ((IData)(vlSelfRef.__PVT__xr) 
                                                           >> 3U)) 
                                                       | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                           & ((IData)(vlSelfRef.acc) 
                                                              >> 3U)) 
                                                          | ((IData)(vlSelfRef.__PVT__t1668) 
                                                             & ((IData)(vlSelfRef.__PVT__s) 
                                                                >> 3U))))))))) 
                                       << 3U) | (((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                                  & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                      & ((IData)(vlSelfRef.__PVT__di) 
                                                         >> 2U)) 
                                                     | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                         & ((IData)(vlSelfRef.__PVT__mxo) 
                                                            >> 2U)) 
                                                        | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                            & ((IData)(vlSelfRef.__PVT__mxo) 
                                                               >> 0x0000000aU)) 
                                                           | (((IData)(vlSelfRef.__PVT__sy_stack) 
                                                               & (IData)(vlSelfRef.__PVT__t1f1)) 
                                                              | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                                  & ((IData)(vlSelfRef.__PVT__xr) 
                                                                     >> 2U)) 
                                                                 | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                                     & ((IData)(vlSelfRef.acc) 
                                                                        >> 2U)) 
                                                                    | (((IData)(vlSelfRef.__PVT__psw_p) 
                                                                        & (IData)(vlSelfRef.__PVT__t2046)) 
                                                                       | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                          & ((IData)(vlSelfRef.__PVT__s) 
                                                                             >> 2U)))))))))) 
                                                 << 2U)) 
                                     | ((((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                          & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                              & ((IData)(vlSelfRef.__PVT__di) 
                                                 >> 1U)) 
                                             | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                 & ((IData)(vlSelfRef.__PVT__mxo) 
                                                    >> 1U)) 
                                                | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                    & ((IData)(vlSelfRef.__PVT__mxo) 
                                                       >> 9U)) 
                                                   | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                       & (IData)(vlSelfRef.__PVT__sy_wo_n)) 
                                                      | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                          & ((IData)(vlSelfRef.__PVT__xr) 
                                                             >> 1U)) 
                                                         | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                             & ((IData)(vlSelfRef.acc) 
                                                                >> 1U)) 
                                                            | ((IData)(vlSelfRef.__PVT__t2046) 
                                                               | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                  & ((IData)(vlSelfRef.__PVT__s) 
                                                                     >> 1U)))))))))) 
                                         << 1U) | ((IData)(vlSelfRef.__VdfgRegularize_h11d02322_0_1) 
                                                   & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                       & (IData)(vlSelfRef.__PVT__di)) 
                                                      | (((IData)(vlSelfRef.__PVT__mxrl) 
                                                          & (IData)(vlSelfRef.__PVT__mxo)) 
                                                         | (((IData)(vlSelfRef.__PVT__mxrh) 
                                                             & ((IData)(vlSelfRef.__PVT__mxo) 
                                                                >> 8U)) 
                                                            | (((IData)(vlSelfRef.__PVT__inta) 
                                                                & (IData)(vlSelfRef.__PVT__t1f1)) 
                                                               | (((IData)(vlSelfRef.__PVT__alu_xrd) 
                                                                   & (IData)(vlSelfRef.__PVT__xr)) 
                                                                  | (((IData)(vlSelfRef.__PVT__alu_ard) 
                                                                      & (IData)(vlSelfRef.acc)) 
                                                                     | (((IData)(vlSelfRef.__PVT__psw_c) 
                                                                         & (IData)(vlSelfRef.__PVT__t2046)) 
                                                                        | ((IData)(vlSelfRef.__PVT__t1668) 
                                                                           & (IData)(vlSelfRef.__PVT__s)))))))))))));
}

VL_ATTR_COLD void Vcpm_top_vm80a_core___ctor_var_reset(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___ctor_var_reset\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    const uint64_t __VscopeHash = VL_MURMUR64_HASH(vlSelf->name());
    vlSelf->__PVT__pin_clk = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9885974640071899480ull);
    vlSelf->__PVT__pin_f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5033350887352013743ull);
    vlSelf->__PVT__pin_f2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12320595998515123262ull);
    vlSelf->__PVT__pin_reset = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3197525454847968923ull);
    vlSelf->__PVT__pin_a = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 17044792951602958107ull);
    vlSelf->__PVT__pin_dout = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 14485575979277734305ull);
    vlSelf->__PVT__pin_din = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 16880459475761937707ull);
    vlSelf->__PVT__pin_aena = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9909417739006973134ull);
    vlSelf->__PVT__pin_dena = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 829522075223014530ull);
    vlSelf->__PVT__pin_hold = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 1811209489203702111ull);
    vlSelf->__PVT__pin_hlda = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7643423081414866258ull);
    vlSelf->__PVT__pin_ready = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15812086047896016760ull);
    vlSelf->__PVT__pin_wait = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17066534463358491014ull);
    vlSelf->__PVT__pin_int = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 145536010687912244ull);
    vlSelf->__PVT__pin_inte = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3804179168823994107ull);
    vlSelf->__PVT__pin_sync = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2262223085983599937ull);
    vlSelf->__PVT__pin_dbin = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8502044157852360597ull);
    vlSelf->__PVT__pin_wr_n = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15184215843184729054ull);
    vlSelf->__PVT__d = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 1720370409040345145ull);
    vlSelf->__PVT__db = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 3080549597580816932ull);
    vlSelf->__PVT__di = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 15530784800990054812ull);
    vlSelf->__PVT__a = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 510903276987443985ull);
    vlSelf->__PVT__db_stb = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9674803975620520557ull);
    vlSelf->__PVT__dbin_pin = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 1060125674546220095ull);
    vlSelf->__PVT__dbin_ext = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16846809554277749895ull);
    vlSelf->__PVT__reset = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9928399931838511862ull);
    vlSelf->__PVT__t404 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8858506694481804768ull);
    vlSelf->__PVT__t382 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13131745215295786307ull);
    vlSelf->__PVT__t383 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10721111138620336051ull);
    vlSelf->__PVT__hold = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14274422376466277814ull);
    vlSelf->__PVT__h889 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10035821874490856425ull);
    vlSelf->__PVT__wr_n = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9096275881558974566ull);
    vlSelf->__PVT__t1124 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11240565252269728970ull);
    vlSelf->__PVT__t1011 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13011708915566193497ull);
    vlSelf->__PVT__sync = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12204333248948247765ull);
    vlSelf->__PVT__ready_int = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4312507301442128314ull);
    vlSelf->__PVT__r16_pc = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 3064403739194900131ull);
    vlSelf->__PVT__r16_hl = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 17306816031158078540ull);
    vlSelf->__PVT__r16_de = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 16004786437104797333ull);
    vlSelf->__PVT__r16_bc = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 9170321493136810472ull);
    vlSelf->__PVT__r16_sp = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 17596486877713498555ull);
    vlSelf->__PVT__r16_wz = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 12932214912202583478ull);
    vlSelf->__PVT__mxo = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 8815360528899715982ull);
    vlSelf->__PVT__mxi = VL_SCOPED_RAND_RESET_I(16, __VscopeHash, 13222142187624909663ull);
    vlSelf->__PVT__mxr1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7915886939216358850ull);
    vlSelf->__PVT__mxr2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9607784622994884817ull);
    vlSelf->__PVT__mxr3 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15893504081581881040ull);
    vlSelf->__PVT__mxr4 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2048479949798772049ull);
    vlSelf->__PVT__mxwh = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 349447909079450183ull);
    vlSelf->__PVT__mxwl = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12496599599560434201ull);
    vlSelf->__PVT__mxrh = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8883640712113607501ull);
    vlSelf->__PVT__mxrl = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9626864893709666712ull);
    vlSelf->__PVT__xchg_dh = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5275251867605592726ull);
    vlSelf->__PVT__xchg_tt = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2159156650061010254ull);
    vlSelf->__PVT__t3144 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11697282004197107597ull);
    vlSelf->__PVT__t1460 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3090986163626241912ull);
    vlSelf->__PVT__sy_wo_n = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10125620152284145772ull);
    vlSelf->__PVT__sy_inp = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11787354420991846716ull);
    vlSelf->__PVT__sy_stack = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10011786768699247193ull);
    vlSelf->__PVT__thalt = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14179908079762865386ull);
    vlSelf->t1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7642289549351940138ull);
    vlSelf->t2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8826916864904923767ull);
    vlSelf->__PVT__tw = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2936254988300618171ull);
    vlSelf->t3 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17921168920384278852ull);
    vlSelf->t4 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8424512120239020648ull);
    vlSelf->__PVT__t5 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 636713507784156576ull);
    vlSelf->__PVT__t1f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5655380667804218904ull);
    vlSelf->__PVT__t2f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5232151025327340934ull);
    vlSelf->__PVT__twf1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 576929383251564041ull);
    vlSelf->__PVT__t3f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 6297168169794373233ull);
    vlSelf->__PVT__t4f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2919199679449581582ull);
    vlSelf->__PVT__t5f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7341543332589180615ull);
    vlSelf->m1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5428389874747182527ull);
    vlSelf->m2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4502822743263013197ull);
    vlSelf->m3 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15123813510401005367ull);
    vlSelf->m4 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4382427511513610131ull);
    vlSelf->m5 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 6024136505498539175ull);
    vlSelf->__PVT__m1f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9100469896249737011ull);
    vlSelf->__PVT__m2f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9795171193735758612ull);
    vlSelf->__PVT__m3f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12530688265489302820ull);
    vlSelf->__PVT__m4f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16492918621357035748ull);
    vlSelf->__PVT__m5f1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 18364136431360132420ull);
    vlSelf->__PVT__start = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9867861323841650631ull);
    vlSelf->__PVT__ms0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10168245781142354360ull);
    vlSelf->__PVT__ms1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5317481866217742452ull);
    vlSelf->__PVT__m839 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 954013640287038360ull);
    vlSelf->eom = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4659205314568820379ull);
    vlSelf->__PVT__t789 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12604501216035786775ull);
    vlSelf->__PVT__t887 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 6707431203003220856ull);
    vlSelf->__PVT__t953 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8498016309275262792ull);
    vlSelf->__PVT__t976 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14447325879970480579ull);
    vlSelf->__PVT__t980 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 134746668063389297ull);
    vlSelf->__PVT__intr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14971099311476308605ull);
    vlSelf->__PVT__inta = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8292538629238848545ull);
    vlSelf->__PVT__inte = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3449712689606890409ull);
    vlSelf->__PVT__mstart = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15160601293936300110ull);
    vlSelf->__PVT__minta = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4487148024845942666ull);
    vlSelf->__PVT__i = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 15817570140490810055ull);
    vlSelf->__PVT__i25 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10032507717578272377ull);
    vlSelf->__PVT__i14 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8081658195838513211ull);
    vlSelf->__PVT__i03 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 663170050752508946ull);
    vlSelf->__PVT__acc_sel = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 18021835869048579697ull);
    vlSelf->__PVT__id_op = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 305790421946157238ull);
    vlSelf->__PVT__id_io = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12270304891329545002ull);
    vlSelf->__PVT__id_in = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2417037724108067409ull);
    vlSelf->__PVT__id_popsw = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14899182093909578451ull);
    vlSelf->__PVT__id_pupsw = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10958033140896130641ull);
    vlSelf->__PVT__id_nop = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16837873020902342797ull);
    vlSelf->__PVT__id_lxi = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8844263882715998392ull);
    vlSelf->__PVT__id_inr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 884988764106142189ull);
    vlSelf->__PVT__id_dcr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7673645755736606932ull);
    vlSelf->__PVT__id_idr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12859334717665803224ull);
    vlSelf->__PVT__id_mvi = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8287934495335639028ull);
    vlSelf->__PVT__id_dad = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15256777087776497300ull);
    vlSelf->__PVT__id_dcx = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 6629211890505965956ull);
    vlSelf->__PVT__id_opa = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15458657784993240827ull);
    vlSelf->__PVT__id_idm = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2384013461079696142ull);
    vlSelf->__PVT__id_hlt = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 131661061458298192ull);
    vlSelf->__PVT__id_mov = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 1225235685923715777ull);
    vlSelf->__PVT__id_opm = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14306719269294626414ull);
    vlSelf->__PVT__id_pop = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 6148728967694083279ull);
    vlSelf->__PVT__id_rst = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9710778969644493753ull);
    vlSelf->__PVT__id_cxx = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15738102358921705251ull);
    vlSelf->__PVT__id_jxx = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4316348988174845564ull);
    vlSelf->__PVT__id_rxx = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13983801034241812776ull);
    vlSelf->__PVT__id_ret = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16183177089794486692ull);
    vlSelf->__PVT__id_jmp = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11448482771793135392ull);
    vlSelf->__PVT__id_opi = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3773808867941228766ull);
    vlSelf->__PVT__id_out = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8116181756627121401ull);
    vlSelf->__PVT__id_11x = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4945007504040289248ull);
    vlSelf->__PVT__id_rxc = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12528777523531590688ull);
    vlSelf->__PVT__id_sha = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10059990242272940155ull);
    vlSelf->__PVT__id_daa = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9853452906579901259ull);
    vlSelf->__PVT__id_cma = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4051298147233529379ull);
    vlSelf->__PVT__id_stc = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16827140030601170192ull);
    vlSelf->__PVT__id_add = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 1755204178108295709ull);
    vlSelf->__PVT__id_adc = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16613911879088892202ull);
    vlSelf->__PVT__id_sub = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7318105044521529239ull);
    vlSelf->__PVT__id_sbb = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11860894087752278989ull);
    vlSelf->__PVT__id_ana = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8861826108579471549ull);
    vlSelf->__PVT__id_xra = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17319352917704764374ull);
    vlSelf->__PVT__id_ora = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13437313347512695782ull);
    vlSelf->__PVT__id_cmp = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4759076305905721652ull);
    vlSelf->__PVT__id_lsax = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12588572343264762056ull);
    vlSelf->__PVT__id_mvim = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14511309994094385122ull);
    vlSelf->__PVT__id_shld = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14423619137106484542ull);
    vlSelf->__PVT__id_lhld = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4242173394671124698ull);
    vlSelf->__PVT__id_mvmr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9228756899570649370ull);
    vlSelf->__PVT__id_mvrm = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11925479025944934779ull);
    vlSelf->__PVT__id_push = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8403362885836137675ull);
    vlSelf->__PVT__id_xthl = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11973532394569750681ull);
    vlSelf->__PVT__id_sphl = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5805396219838715747ull);
    vlSelf->__PVT__id_pchl = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9363089950707046601ull);
    vlSelf->__PVT__id_xchg = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14453961135912857309ull);
    vlSelf->__PVT__id_call = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17644747171923251655ull);
    vlSelf->__PVT__id_eidi = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12255705068392856537ull);
    vlSelf->__PVT__id_stlda = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16057371269266960957ull);
    vlSelf->__PVT__id82 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12396490508924955598ull);
    vlSelf->__PVT__id00 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13466241733885051888ull);
    vlSelf->__PVT__id01 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 1688757111199786329ull);
    vlSelf->__PVT__id02 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2252722793770057704ull);
    vlSelf->__PVT__id03 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11160636028791551379ull);
    vlSelf->__PVT__id06 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11399759684176258469ull);
    vlSelf->__PVT__id07 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17690744799531012900ull);
    vlSelf->__PVT__id08 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9662043027682045732ull);
    vlSelf->__PVT__id09 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11410766702177342745ull);
    vlSelf->__PVT__id10 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11738468147853109979ull);
    vlSelf->__PVT__jmpflag = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9808880021191788181ull);
    vlSelf->__PVT__jmptake = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17473098624699002662ull);
    vlSelf->__PVT__tree0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4357888843402442053ull);
    vlSelf->__PVT__tree1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12754389567027358948ull);
    vlSelf->__PVT__tree2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2493663999810986031ull);
    vlSelf->__PVT__t2806 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11650921478140149114ull);
    vlSelf->__PVT__t2817 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17530062878604408888ull);
    vlSelf->__PVT__t2819 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15130444105454459178ull);
    vlSelf->__PVT__t3047 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15144722655912700408ull);
    vlSelf->__PVT__t2998 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17989912536098352804ull);
    vlSelf->__PVT__t3363 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16294009646758012246ull);
    vlSelf->__PVT__t3403 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 611311666571112159ull);
    vlSelf->__PVT__t3335 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 10561216455719684645ull);
    vlSelf->__PVT__t3361 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2635695828481529190ull);
    vlSelf->__PVT__xr = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 2011584425220147422ull);
    vlSelf->__PVT__r = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 16978132545290669629ull);
    vlSelf->acc = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 14651699267163694450ull);
    vlSelf->__PVT__x = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 9409450202036847209ull);
    vlSelf->__PVT__s = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 16562859848569467201ull);
    vlSelf->__PVT__c__BRA__7__KET__ = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9887400623527160087ull);
    vlSelf->__PVT__c__BRA__3__KET__ = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 18155321688603059846ull);
    vlSelf->__PVT__daa = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4348649762492540406ull);
    vlSelf->__PVT__daa_6x = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13269910206697905992ull);
    vlSelf->__PVT__a327 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13950222937845736588ull);
    vlSelf->__PVT__a357 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16379957312803919992ull);
    vlSelf->__PVT__a358 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13038833225164582932ull);
    vlSelf->__PVT__alu_xrd = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 18390780560987345789ull);
    vlSelf->__PVT__alu_ard = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2139282740259582831ull);
    vlSelf->__PVT__psw_z = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4544336807048440969ull);
    vlSelf->__PVT__psw_s = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16779710203597910056ull);
    vlSelf->__PVT__psw_p = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3959576241701132828ull);
    vlSelf->__PVT__psw_c = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13670874528983175217ull);
    vlSelf->__PVT__psw_ac = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16979015077336526900ull);
    vlSelf->__PVT__tmp_c = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15690043063267594562ull);
    vlSelf->__PVT__t2222 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11570040164532996812ull);
    vlSelf->__PVT__t1375 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12088253521407248747ull);
    vlSelf->__PVT__t1497 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9072980827118233004ull);
    vlSelf->__PVT__t1698 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2311234883766788860ull);
    vlSelf->__PVT__t1668 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15593127871364199429ull);
    vlSelf->__PVT__t1780 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14647281850136806335ull);
    vlSelf->__PVT__t1993 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 13255765697666081769ull);
    vlSelf->__PVT__t1994 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3539622446737501960ull);
    vlSelf->__PVT__psw_ld = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 12826889574199045919ull);
    vlSelf->__PVT__psw_wr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5642419378027533475ull);
    vlSelf->__PVT__t2046 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 7057891552615481243ull);
    vlSelf->__PVT__t2133 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14633044249167298272ull);
    vlSelf->__PVT__t2175 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16594220109333295862ull);
    vlSelf->__VdfgRegularize_h11d02322_0_1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16785066235267651294ull);
    vlSelf->__VdfgRegularize_h11d02322_0_2 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 4899442206707734378ull);
    vlSelf->__VdfgRegularize_h11d02322_0_9 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9346651505410159110ull);
    vlSelf->__VdfgRegularize_h11d02322_0_13 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 8326511565152085435ull);
    vlSelf->__VdfgRegularize_h11d02322_0_14 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17812558045931776763ull);
    vlSelf->__VdfgRegularize_h11d02322_0_15 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11256274215265120848ull);
    vlSelf->__VdfgRegularize_h11d02322_0_18 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15050508373238665418ull);
    vlSelf->__VdfgRegularize_h11d02322_0_25 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5143927245894665815ull);
    vlSelf->__VdfgRegularize_h11d02322_0_26 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5096992140307804304ull);
    vlSelf->__VdfgRegularize_h11d02322_0_29 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5949828078612962670ull);
    vlSelf->__VdfgRegularize_h11d02322_0_32 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15522262557276894136ull);
    vlSelf->__VdfgRegularize_h11d02322_0_33 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3180825536956589403ull);
    vlSelf->__VdfgRegularize_h11d02322_0_34 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 3133890431369733267ull);
    vlSelf->__VdfgRegularize_h11d02322_0_36 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 15888822182273052324ull);
    vlSelf->__VdfgRegularize_h11d02322_1_0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5956502083047417423ull);
    vlSelf->__Vfunc_cmp__16__Vfuncout = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 14943864380366553883ull);
    vlSelf->__Vfunc_cmp__16__i = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 10950170639079933160ull);
    vlSelf->__Vfunc_cmp__17__Vfuncout = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 2380401876304667061ull);
    vlSelf->__Vfunc_cmp__17__i = VL_SCOPED_RAND_RESET_I(8, __VscopeHash, 6817152072390820131ull);
    vlSelf->__VdfgRegularize_h6e95ff9d_0_0 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 5614032309088458142ull);
    vlSelf->__Vdly__twf1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 16674537334632243681ull);
    vlSelf->__Vdly__m1 = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 17632824459172990961ull);
    vlSelf->__Vdly__inta = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9616678598742321625ull);
}
