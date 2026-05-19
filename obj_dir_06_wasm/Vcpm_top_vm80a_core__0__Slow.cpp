// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

extern const VlUnpacked<CData/*0:0*/, 512> Vcpm_top__ConstPool__TABLE_ha98b427f_0;

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
    CData/*0:0*/ __PVT__id_rlc;
    __PVT__id_rlc = 0;
    CData/*0:0*/ __PVT__id_rar;
    __PVT__id_rar = 0;
    CData/*0:0*/ __PVT__cl;
    __PVT__cl = 0;
    SData/*8:0*/ __Vtableidx1;
    __Vtableidx1 = 0;
    CData/*7:0*/ __VdfgRegularize_h6e95ff9d_0_1;
    __VdfgRegularize_h6e95ff9d_0_1 = 0;
    CData/*7:0*/ __VdfgRegularize_h6e95ff9d_0_2;
    __VdfgRegularize_h6e95ff9d_0_2 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_4;
    __VdfgRegularize_h6e95ff9d_0_4 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_7;
    __VdfgRegularize_h6e95ff9d_0_7 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_16;
    __VdfgRegularize_h6e95ff9d_0_16 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_25;
    __VdfgRegularize_h6e95ff9d_0_25 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_35;
    __VdfgRegularize_h6e95ff9d_0_35 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_36;
    __VdfgRegularize_h6e95ff9d_0_36 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_37;
    __VdfgRegularize_h6e95ff9d_0_37 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_38;
    __VdfgRegularize_h6e95ff9d_0_38 = 0;
    CData/*0:0*/ __VdfgRegularize_h6e95ff9d_0_40;
    __VdfgRegularize_h6e95ff9d_0_40 = 0;
    // Body
    vlSelfRef.__PVT__id_stc = (IData)(((0x30U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (7U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__PVT__h889 = ((IData)(vlSelfRef.__PVT__t2f1) 
                             | (IData)(vlSelfRef.__PVT__twf1));
    vlSelfRef.__PVT__thalt = ((~ (IData)(vlSelfRef.m1)) 
                              & (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x76U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__PVT__mxwh = ((IData)(vlSelfRef.__PVT__t2817) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    vlSelfRef.__PVT__mxwl = ((IData)(vlSelfRef.__PVT__t2819) 
                             | ((IData)(vlSelfRef.__PVT__i03) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    __Vtableidx1 = (((IData)(vlSelfRef.__PVT__tmp_c) 
                     << 8U) | (IData)(vlSelfRef.acc));
    vlSelfRef.__PVT__daa_6x = Vcpm_top__ConstPool__TABLE_ha98b427f_0
        [__Vtableidx1];
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_32 = ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x3fU 
                                                      | (~ 
                                                         (0x80U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | ((IData)(vlSelfRef.t4) 
                                                    & (0x000000ffU 
                                                       == 
                                                       (0x000000ffU 
                                                        & (0x3fU 
                                                           | (~ 
                                                              (0x40U 
                                                               ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__PVT__id01 = ((0x000000ffU == (0x000000ffU 
                                              & (0x30U 
                                                 | (~ 
                                                    (0xc1U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc0U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | (0x000000ffU == (0x000000ffU 
                                                   & (0x10U 
                                                      | (~ 
                                                         (0xc9U 
                                                          ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__PVT__alu_xrd = ((IData)(vlSelfRef.__PVT__t1698) 
                                | (IData)(vlSelfRef.__PVT__a358));
    vlSelfRef.__PVT__sy_inp = ((IData)(vlSelfRef.m5) 
                               & (0x000000ffU == (0x000000ffU 
                                                  & (~ 
                                                     (0xdbU 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3 = (1U 
                                                & (~ 
                                                   ((IData)(vlSelfRef.__PVT__reset) 
                                                    | ((IData)(vlSelfRef.__PVT__m1f1) 
                                                       & (IData)(vlSelfRef.__PVT__t3f1)))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_33 = ((IData)(vlSelfRef.__PVT__t976) 
                                                 & (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (~ 
                                                        (0x76U 
                                                         ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_28 = ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x18U 
                                                      | (~ 
                                                         (2U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x38U 
                                                        | (~ 
                                                           (6U 
                                                            ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_9 = ((0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (8U 
                                                     | (~ 
                                                        (0xd3U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                | (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x38U 
                                                       | (~ 
                                                          (0xc6U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__PVT__id_mvrm = ((~ (0x000000ffU == 
                                    (0x000000ffU & 
                                     (~ (0x76U ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                & (0x000000ffU == (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0x46U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))));
    __VdfgRegularize_h6e95ff9d_0_25 = ((0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x30U 
                                               | (~ 
                                                  (0xc1U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       | (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x30U 
                                                 | (~ 
                                                    (0xc5U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))));
    __PVT__id_rar = (IData)(((0x18U == (0x38U & (IData)(vlSelfRef.__PVT__i))) 
                             & (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (7U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6 = ((IData)(vlSelfRef.__PVT__t4f1) 
                                                | (IData)(vlSelfRef.__PVT__t5f1));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_21 = ((IData)(vlSelfRef.m2) 
                                                 | (IData)(vlSelfRef.m3));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5 = ((IData)(vlSelfRef.m4) 
                                                | (IData)(vlSelfRef.m5));
    vlSelfRef.__PVT__id_mvmr = ((~ (0x000000ffU == 
                                    (0x000000ffU & 
                                     (~ (0x76U ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                & (0x000000ffU == (0x000000ffU 
                                                   & (7U 
                                                      | (~ 
                                                         (0x70U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__PVT__id_daa = (IData)(((0x20U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (7U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))))));
    __PVT__id_rlc = (IData)(((0U == (0x38U & (IData)(vlSelfRef.__PVT__i))) 
                             & (0x000000ffU == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (7U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__PVT__id_sha = ((~ ((IData)(vlSelfRef.__PVT__i) 
                                   >> 5U)) & (0x000000ffU 
                                              == (0x000000ffU 
                                                  & (0x38U 
                                                     | (~ 
                                                        (7U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_19 = (1U 
                                                 & ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                    & (~ (IData)(vlSelfRef.__PVT__i25))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_39 = ((~ (IData)(vlSelfRef.__PVT__i25)) 
                                                 & (IData)(vlSelfRef.__PVT__i14));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_15 = ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                 & (IData)(vlSelfRef.__PVT__i25));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31 = ((IData)(vlSelfRef.__PVT__i14) 
                                                 & (IData)(vlSelfRef.__PVT__i25));
    vlSelfRef.__PVT__id_cma = (IData)(((0x28U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (7U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_27 = ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (~ 
                                                      (0xf9U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                 | (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (~ 
                                                        (0xe9U 
                                                         ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_8 = ((0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (~ 
                                                     (0xe3U 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                | ((0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x38U 
                                                        | (~ 
                                                           (0xc4U 
                                                            ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                   | (0x000000ffU 
                                                      == 
                                                      (0x000000ffU 
                                                       & (0x30U 
                                                          | (~ 
                                                             (0xcdU 
                                                              ^ (IData)(vlSelfRef.__PVT__i))))))));
    __VdfgRegularize_h6e95ff9d_0_40 = ((~ (0x000000ffU 
                                           == (0x000000ffU 
                                               & (~ 
                                                  (0xe3U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       & (IData)(vlSelfRef.__PVT__t4f1));
    vlSelfRef.__PVT__id08 = ((0x000000ffU == (0x000000ffU 
                                              & (0x3fU 
                                                 | (~ 
                                                    (0x40U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (6U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | ((0x000000ffU == 
                                    (0x000000ffU & 
                                     (0x39U | (~ (4U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                   | (0x000000ffU == 
                                      (0x000000ffU 
                                       & (0x3fU | (~ 
                                                   (0x80U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_29 = ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x30U 
                                                      | (~ 
                                                         (3U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x30U 
                                                        | (~ 
                                                           (0x0bU 
                                                            ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0 = ((0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (0x3fU 
                                                     | (~ 
                                                        (0x80U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                | (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x38U 
                                                       | (~ 
                                                          (0xc6U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__PVT__acc_sel = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_32)
                                 ? (7U == (7U & (IData)(vlSelfRef.__PVT__i)))
                                 : (7U == (7U & ((IData)(vlSelfRef.__PVT__i) 
                                                 >> 3U))));
    vlSelfRef.__PVT__id06 = ((IData)(vlSelfRef.__PVT__id01) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (9U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | ((0x000000ffU == 
                                    (0x000000ffU & 
                                     (~ (0x2aU ^ (IData)(vlSelfRef.__PVT__i))))) 
                                   | (0x000000ffU == 
                                      (0x000000ffU 
                                       & (8U | (~ (0xd3U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_34 = ((IData)(vlSelfRef.__PVT__reset) 
                                                 | (((~ (IData)(vlSelfRef.__PVT__t1f1)) 
                                                     & (IData)(vlSelfRef.__PVT__sy_stack)) 
                                                    | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_33)));
    vlSelfRef.__PVT__id02 = ((0x000000ffU == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (6U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                             | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_9));
    vlSelfRef.__PVT__id10 = ((IData)(__VdfgRegularize_h6e95ff9d_0_25) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (6U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | (IData)(vlSelfRef.__PVT__id_mvrm)));
    vlSelfRef.__PVT__start = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_33) 
                              | ((IData)(vlSelfRef.__PVT__t953) 
                                 | (((IData)(vlSymsp->TOP__cpm_top.f2) 
                                     & ((~ ((IData)(vlSelfRef.__PVT__twf1) 
                                            | ((IData)(vlSelfRef.__PVT__t3f1) 
                                               | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6)))) 
                                        & ((IData)(vlSelfRef.__PVT__t383) 
                                           | ((~ (IData)(vlSelfRef.__PVT__t382)) 
                                              & (IData)(vlSelfRef.__PVT__hold))))) 
                                    | ((~ ((IData)(vlSelfRef.__PVT__hold) 
                                           & (IData)(vlSelfRef.__PVT__t887))) 
                                       & (IData)(vlSelfRef.eom)))));
    vlSelfRef.__PVT__ready_int = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (0x30U | (~ (9U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__PVT__id82 = ((IData)(__VdfgRegularize_h6e95ff9d_0_25) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0x86U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | ((0x000000ffU == 
                                    (0x000000ffU & 
                                     (1U | (~ (0x34U 
                                               ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                   | ((0x000000ffU 
                                       == (0x000000ffU 
                                           & (0x30U 
                                              | (~ 
                                                 (9U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                      | ((0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (0xc7U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                         | ((0x000000ffU 
                                             == (0x000000ffU 
                                                 & (0x10U 
                                                    | (~ 
                                                       (0xc9U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                            | ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc0U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | ((IData)(vlSelfRef.__PVT__id_mvrm) 
                                                  | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                                     | ((0x000000ffU 
                                                         == 
                                                         (0x000000ffU 
                                                          & (~ 
                                                             (0x76U 
                                                              ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                        | ((0x000000ffU 
                                                            == 
                                                            (0x000000ffU 
                                                             & (~ 
                                                                (0x36U 
                                                                 ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                           | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_9) 
                                                              | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_28)))))))))))));
    vlSelfRef.__PVT__daa = ((IData)(vlSelfRef.__PVT__t4f1) 
                            & (IData)(vlSelfRef.__PVT__id_daa));
    vlSelfRef.__PVT__id_rxc = (((IData)(vlSelfRef.__PVT__i) 
                                >> 3U) & (IData)(vlSelfRef.__PVT__id_sha));
    vlSelfRef.__PVT__jmpflag = (((IData)(vlSelfRef.__PVT__psw_c) 
                                 & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_39)) 
                                | (((IData)(vlSelfRef.__PVT__psw_p) 
                                    & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_15)) 
                                   | (((IData)(vlSelfRef.__PVT__psw_s) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31)) 
                                      | ((IData)(vlSelfRef.__PVT__psw_z) 
                                         & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_19)))));
    vlSelfRef.__PVT__id00 = ((0x000000ffU == (0x000000ffU 
                                              & (~ 
                                                 (0xe3U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))) 
                             | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_27));
    vlSelfRef.__PVT__id03 = ((0x000000ffU == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (0xc7U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (0xc5U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_8)));
    vlSelfRef.__PVT__alu_ard = ((IData)(vlSelfRef.__PVT__t1375) 
                                | ((IData)(vlSelfRef.__PVT__t1993) 
                                   & ((0x000000ffU 
                                       == (0x000000ffU 
                                           & (0x38U 
                                              | (~ 
                                                 (7U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                      | ((0x000000ffU 
                                          == (0x000000ffU 
                                              & (8U 
                                                 | (~ 
                                                    (0x32U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                         | ((0x000000ffU 
                                             == (0x000000ffU 
                                                 & (0x18U 
                                                    | (~ 
                                                       (2U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                            | ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0xd3U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | ((IData)(vlSelfRef.__PVT__t1994) 
                                                  & (IData)(vlSelfRef.__PVT__id08))))))));
    __VdfgRegularize_h6e95ff9d_0_7 = ((IData)(vlSelfRef.__PVT__t4f1) 
                                      & (IData)(vlSelfRef.__PVT__id08));
    vlSelfRef.__PVT__id07 = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_29) 
                             | ((0x000000ffU == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (1U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                | (0x000000ffU == (0x000000ffU 
                                                   & (0x30U 
                                                      | (~ 
                                                         (9U 
                                                          ^ (IData)(vlSelfRef.__PVT__i))))))));
    vlSelfRef.__PVT__id_add = (IData)(((0U == (0x38U 
                                               & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__id_adc = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0) 
                               & (8U == (0x38U & (IData)(vlSelfRef.__PVT__i))));
    vlSelfRef.__PVT__id_ana = (IData)(((0x20U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__id_xra = (IData)(((0x28U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__id_ora = (IData)(((0x30U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__id_sub = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0) 
                               & (0x10U == (0x38U & (IData)(vlSelfRef.__PVT__i))));
    vlSelfRef.__PVT__id_sbb = (IData)(((0x18U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__id_cmp = (IData)(((0x38U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)));
    vlSelfRef.__PVT__sy_wo_n = ((IData)(vlSelfRef.m1) 
                                | (((~ (IData)(vlSelfRef.__PVT__ready_int)) 
                                    & (((~ ((0x000000ffU 
                                             == (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (0xc5U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                            | ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (1U 
                                                    | (~ 
                                                       (0x34U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | ((0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x38U 
                                                       | (~ 
                                                          (0xc7U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                  | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_8) 
                                                     | ((0x000000ffU 
                                                         == 
                                                         (0x000000ffU 
                                                          & (~ 
                                                             (0x36U 
                                                              ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                        | ((0x000000ffU 
                                                            == 
                                                            (0x000000ffU 
                                                             & (~ 
                                                                (0x22U 
                                                                 ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                           | ((~ 
                                                               ((IData)(vlSelfRef.__PVT__i) 
                                                                >> 3U)) 
                                                              & (0x000000ffU 
                                                                 == 
                                                                 (0x000000ffU 
                                                                  & (8U 
                                                                     | (~ 
                                                                        (0xd3U 
                                                                         ^ (IData)(vlSelfRef.__PVT__i)))))))))))))) 
                                        & (IData)(vlSelfRef.m5)) 
                                       | ((~ ((0x000000ffU 
                                               == (0x000000ffU 
                                                   & (0x30U 
                                                      | (~ 
                                                         (0xc5U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                              | ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0xc7U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_8) 
                                                    | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                                       | ((0x000000ffU 
                                                           == 
                                                           (0x000000ffU 
                                                            & (~ 
                                                               (0x22U 
                                                                ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                          | ((~ 
                                                              ((IData)(vlSelfRef.__PVT__i) 
                                                               >> 3U)) 
                                                             & ((0x000000ffU 
                                                                 == 
                                                                 (0x000000ffU 
                                                                  & (0x18U 
                                                                     | (~ 
                                                                        (2U 
                                                                         ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                                | (0x000000ffU 
                                                                   == 
                                                                   (0x000000ffU 
                                                                    & (8U 
                                                                       | (~ 
                                                                          (0x32U 
                                                                           ^ (IData)(vlSelfRef.__PVT__i)))))))))))))) 
                                          & (IData)(vlSelfRef.m4)))) 
                                   | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_21)));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_20 = (1U 
                                                 & (~ 
                                                    ((IData)(vlSelfRef.__PVT__m1f1) 
                                                     & (IData)(vlSelfRef.__PVT__id82))));
    __PVT__iad16 = (1U & ((~ ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6) 
                              & (IData)(vlSelfRef.__PVT__id00))) 
                          & ((IData)(vlSelfRef.m5) 
                             | ((~ (IData)(vlSelfRef.__PVT__minta)) 
                                | (IData)(vlSelfRef.__PVT__t3144)))));
    __PVT__t1519 = ((IData)(vlSelfRef.__PVT__tree2) 
                    | ((IData)(vlSelfRef.__PVT__id00) 
                       & (IData)(__VdfgRegularize_h6e95ff9d_0_40)));
    vlSelfRef.__PVT__id09 = ((0x000000ffU == (0x000000ffU 
                                              & (~ 
                                                 (0x22U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))) 
                             | (IData)(vlSelfRef.__PVT__id03));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_30 = ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (~ 
                                                      (0xf9U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                 | (IData)(vlSelfRef.__PVT__id03));
    __PVT__t1467 = ((IData)(vlSelfRef.__PVT__tree1) 
                    | ((IData)(vlSelfRef.__PVT__id03) 
                       & (IData)(__VdfgRegularize_h6e95ff9d_0_40)));
    vlSelfRef.__PVT__mxrl = ((IData)(vlSelfRef.__PVT__t3047) 
                             | ((IData)(vlSelfRef.__PVT__i03) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    vlSelfRef.__PVT__mxrh = ((IData)(vlSelfRef.__PVT__t2998) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    __PVT__t1513 = ((IData)(vlSelfRef.__PVT__t3335) 
                    | ((IData)(vlSelfRef.__PVT__t4f1) 
                       & (IData)(vlSelfRef.__PVT__id07)));
    __PVT__cl = ((~ ((IData)(vlSelfRef.__PVT__id_daa) 
                     | ((IData)(__PVT__id_rlc) | ((IData)(vlSelfRef.__PVT__id_ora) 
                                                  | ((IData)(vlSelfRef.__PVT__id_xra) 
                                                     | (IData)(vlSelfRef.__PVT__id_rxc)))))) 
                 & (IData)(vlSelfRef.__PVT__tmp_c));
    vlSelfRef.__PVT__x = (0x000000ffU & (((IData)(vlSelfRef.__PVT__id_sub) 
                                          | ((IData)(vlSelfRef.__PVT__id_sbb) 
                                             | ((IData)(vlSelfRef.__PVT__id_cmp) 
                                                | (IData)(vlSelfRef.__PVT__id_cma))))
                                          ? (~ (IData)(vlSelfRef.__PVT__xr))
                                          : (IData)(vlSelfRef.__PVT__xr)));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_11 = ((IData)(vlSelfRef.__PVT__t1f1) 
                                                 & (IData)(vlSelfRef.__PVT__sy_wo_n));
    vlSelfRef.__PVT__ms0 = (1U & (~ (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_20) 
                                      & (IData)(vlSelfRef.eom)) 
                                     | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_34))));
    vlSelfRef.__PVT__ms1 = ((~ (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_34)) 
                            & ((~ ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_20) 
                                   & ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_29) 
                                      | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_27) 
                                         | ((0x000000ffU 
                                             == (0x000000ffU 
                                                 & (~ 
                                                    (0xebU 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))) 
                                            | ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (8U 
                                                    | (~ 
                                                       (0xf3U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | ((0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x38U 
                                                       | (~ (IData)(vlSelfRef.__PVT__i))))) 
                                                  | ((0x000000ffU 
                                                      == 
                                                      (0x000000ffU 
                                                       & (0x38U 
                                                          | (~ 
                                                             (7U 
                                                              ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                     | ((0x000000ffU 
                                                         == 
                                                         (0x000000ffU 
                                                          & (0x3fU 
                                                             | (~ 
                                                                (0x80U 
                                                                 ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                        | ((0x000000ffU 
                                                            == 
                                                            (0x000000ffU 
                                                             & (0x3fU 
                                                                | (~ 
                                                                   (0x40U 
                                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                           | ((IData)(vlSelfRef.__PVT__t789) 
                                                              | ((~ (IData)(vlSelfRef.__PVT__id82)) 
                                                                 & (0x000000ffU 
                                                                    == 
                                                                    (0x000000ffU 
                                                                     & (0x39U 
                                                                        | (~ 
                                                                           (4U 
                                                                            ^ (IData)(vlSelfRef.__PVT__i)))))))))))))))))) 
                               & (IData)(vlSelfRef.eom)));
    __PVT__dec16 = ((IData)(__PVT__iad16) & (((0x000000ffU 
                                               == (0x000000ffU 
                                                   & (0x30U 
                                                      | (~ 
                                                         (0x0bU 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                              | (IData)(vlSelfRef.__PVT__id03)) 
                                             & ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6) 
                                                | ((IData)(vlSelfRef.__PVT__m4f1) 
                                                   | (IData)(vlSelfRef.__PVT__m5f1)))));
    vlSelfRef.__PVT__t1460 = ((~ ((0x000000ffU == (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0xc4U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                  & ((~ (IData)(vlSelfRef.__PVT__jmptake)) 
                                     & (IData)(vlSelfRef.__PVT__t5)))) 
                              & (((IData)(vlSelfRef.t1) 
                                  & (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_21) 
                                      & (IData)(vlSelfRef.__PVT__id00)) 
                                     | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5) 
                                        & ((IData)(vlSelfRef.__PVT__id01) 
                                           | (IData)(vlSelfRef.__PVT__id03))))) 
                                 | (((IData)(vlSelfRef.t2) 
                                     & (((IData)(vlSelfRef.m2) 
                                         & (IData)(vlSelfRef.__PVT__id00)) 
                                        | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5) 
                                           & (IData)(vlSelfRef.__PVT__id01)))) 
                                    | (((IData)(vlSelfRef.t3) 
                                        & ((IData)(vlSelfRef.m4) 
                                           & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_30))) 
                                       | ((IData)(vlSelfRef.__PVT__t5) 
                                          & ((IData)(vlSelfRef.m1) 
                                             & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_30)))))));
    vlSelfRef.__PVT__mxr4 = (((IData)(__PVT__t1513) 
                              & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31)) 
                             | (IData)(__PVT__t1467));
    __VdfgRegularize_h6e95ff9d_0_4 = ((IData)(__PVT__t1513) 
                                      | ((IData)(vlSelfRef.__PVT__t3361) 
                                         | (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    __VdfgRegularize_h6e95ff9d_0_2 = ((IData)(vlSelfRef.__PVT__r) 
                                      & (IData)(vlSelfRef.__PVT__x));
    __VdfgRegularize_h6e95ff9d_0_1 = ((IData)(vlSelfRef.__PVT__r) 
                                      | (IData)(vlSelfRef.__PVT__x));
    vlSelfRef.__PVT__mxi = (0x0000ffffU & (((~ (IData)(__PVT__dec16)) 
                                            & (IData)(__PVT__iad16))
                                            ? ((IData)(1U) 
                                               + (IData)(vlSelfRef.__PVT__a))
                                            : ((IData)(vlSelfRef.__PVT__a) 
                                               - (IData)(__PVT__dec16))));
    vlSelfRef.__PVT__mxr3 = ((IData)(__VdfgRegularize_h6e95ff9d_0_4) 
                             & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_19));
    __VdfgRegularize_h6e95ff9d_0_38 = ((IData)(__VdfgRegularize_h6e95ff9d_0_4) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_39));
    __VdfgRegularize_h6e95ff9d_0_16 = (((IData)(__VdfgRegularize_h6e95ff9d_0_4) 
                                        & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_15)) 
                                       | (IData)(__PVT__t1519));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10 = ((IData)(__PVT__t1467) 
                                                 | ((IData)(__VdfgRegularize_h6e95ff9d_0_4) 
                                                    | ((IData)(vlSelfRef.__PVT__tree0) 
                                                       | (IData)(__PVT__t1519))));
    vlSelfRef.__PVT__c__BRA__3__KET__ = (1U & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                >> 3U) 
                                               | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                   >> 3U) 
                                                  & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                      >> 2U) 
                                                     | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                         >> 2U) 
                                                        & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                            >> 1U) 
                                                           | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                               >> 1U) 
                                                              & (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                                  & (IData)(__PVT__cl)) 
                                                                 | (IData)(__VdfgRegularize_h6e95ff9d_0_2)))))))));
    vlSelfRef.__PVT__mxr1 = (((IData)(vlSelfRef.__PVT__xchg_dh) 
                              & (IData)(__VdfgRegularize_h6e95ff9d_0_16)) 
                             | ((~ (IData)(vlSelfRef.__PVT__xchg_dh)) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_38)));
    vlSelfRef.__PVT__mxr2 = (((~ (IData)(vlSelfRef.__PVT__xchg_dh)) 
                              & (IData)(__VdfgRegularize_h6e95ff9d_0_16)) 
                             | ((IData)(vlSelfRef.__PVT__xchg_dh) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_38)));
    __VdfgRegularize_h6e95ff9d_0_35 = ((~ (IData)(vlSelfRef.__PVT__mxr4)) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10));
    vlSelfRef.__PVT__c__BRA__7__KET__ = (1U & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                >> 7U) 
                                               | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                   >> 7U) 
                                                  & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                      >> 6U) 
                                                     | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                         >> 6U) 
                                                        & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                            >> 5U) 
                                                           | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                               >> 5U) 
                                                              & (((IData)(__VdfgRegularize_h6e95ff9d_0_2) 
                                                                  >> 4U) 
                                                                 | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                                     >> 4U) 
                                                                    & (IData)(vlSelfRef.__PVT__c__BRA__3__KET__))))))))));
    __VdfgRegularize_h6e95ff9d_0_36 = ((~ (IData)(vlSelfRef.__PVT__mxr3)) 
                                       & (IData)(__VdfgRegularize_h6e95ff9d_0_35));
    vlSelfRef.__PVT__s = (0x000000ffU & (((IData)(vlSelfRef.__PVT__c__BRA__7__KET__) 
                                          & (IData)(__PVT__id_rlc)) 
                                         | (((- (IData)(
                                                        (1U 
                                                         & (~ 
                                                            ((IData)(vlSelfRef.__PVT__id_rxc) 
                                                             | ((IData)(vlSelfRef.__PVT__id_ora) 
                                                                | ((IData)(vlSelfRef.__PVT__id_ana) 
                                                                   | (IData)(vlSelfRef.__PVT__id_xra)))))))) 
                                             & ((IData)(vlSelfRef.__PVT__x) 
                                                + ((IData)(vlSelfRef.__PVT__r) 
                                                   + (IData)(__PVT__cl)))) 
                                            | ((((0x00000080U 
                                                  & ((((IData)(vlSelfRef.__PVT__tmp_c) 
                                                       & (IData)(__PVT__id_rar)) 
                                                      | ((~ (IData)(__PVT__id_rar)) 
                                                         & (IData)(vlSelfRef.__PVT__r))) 
                                                     << 7U)) 
                                                 | (0x0000007fU 
                                                    & ((IData)(vlSelfRef.__PVT__r) 
                                                       >> 1U))) 
                                                & (- (IData)((IData)(vlSelfRef.__PVT__id_rxc)))) 
                                               | (((IData)(__VdfgRegularize_h6e95ff9d_0_1) 
                                                   & (- (IData)((IData)(vlSelfRef.__PVT__id_ora)))) 
                                                  | (((- (IData)((IData)(vlSelfRef.__PVT__id_xra))) 
                                                      & ((IData)(vlSelfRef.__PVT__r) 
                                                         ^ (IData)(vlSelfRef.__PVT__x))) 
                                                     | ((IData)(vlSelfRef.__PVT__x) 
                                                        & ((IData)(vlSelfRef.__PVT__r) 
                                                           & (- (IData)((IData)(vlSelfRef.__PVT__id_ana)))))))))));
    __VdfgRegularize_h6e95ff9d_0_37 = ((~ (IData)(vlSelfRef.__PVT__mxr2)) 
                                       & (IData)(__VdfgRegularize_h6e95ff9d_0_36));
    vlSelfRef.__PVT__mxo = ((IData)(vlSelfRef.__PVT__tree0)
                             ? ((IData)(vlSelfRef.__PVT__r16_pc) 
                                & (- (IData)(((~ (IData)(vlSelfRef.__PVT__mxr1)) 
                                              & (IData)(__VdfgRegularize_h6e95ff9d_0_37)))))
                             : ((IData)(vlSelfRef.__PVT__mxr1)
                                 ? ((IData)(vlSelfRef.__PVT__r16_hl) 
                                    & (- (IData)((IData)(__VdfgRegularize_h6e95ff9d_0_37))))
                                 : ((IData)(vlSelfRef.__PVT__mxr2)
                                     ? ((IData)(vlSelfRef.__PVT__r16_de) 
                                        & (- (IData)((IData)(__VdfgRegularize_h6e95ff9d_0_36))))
                                     : ((IData)(vlSelfRef.__PVT__mxr3)
                                         ? ((IData)(vlSelfRef.__PVT__r16_bc) 
                                            & (- (IData)((IData)(__VdfgRegularize_h6e95ff9d_0_35))))
                                         : ((IData)(vlSelfRef.__PVT__mxr4)
                                             ? ((IData)(vlSelfRef.__PVT__r16_sp) 
                                                & (- (IData)((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10))))
                                             : ((IData)(vlSelfRef.__PVT__r16_wz) 
                                                & (- (IData)(
                                                             (1U 
                                                              & (~ (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10)))))))))));
    vlSelfRef.__PVT__d = (((((((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                               & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                   & ((IData)(vlSelfRef.__PVT__di) 
                                      >> 7U)) | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                   >> 7U) 
                                                  & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                 | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                      >> 0x0000000fU) 
                                                     & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                    | (((~ 
                                                         ((IData)(vlSelfRef.__PVT__minta) 
                                                          | (IData)(vlSelfRef.__PVT__sy_inp))) 
                                                        & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_11)) 
                                                       | ((((IData)(vlSelfRef.__PVT__xr) 
                                                            >> 7U) 
                                                           & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                          | ((((IData)(vlSelfRef.acc) 
                                                               >> 7U) 
                                                              & (IData)(vlSelfRef.__PVT__alu_ard)) 
                                                             | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                 & ((IData)(vlSelfRef.__PVT__s) 
                                                                    >> 7U)) 
                                                                | ((IData)(vlSelfRef.__PVT__psw_s) 
                                                                   & (IData)(vlSelfRef.__PVT__t2046)))))))))) 
                              << 3U) | (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                         & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                             & ((IData)(vlSelfRef.__PVT__di) 
                                                >> 6U)) 
                                            | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                 >> 6U) 
                                                & (IData)(vlSelfRef.__PVT__mxrl)) 
                                               | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                    >> 0x0000000eU) 
                                                   & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                  | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                      & (IData)(vlSelfRef.__PVT__sy_inp)) 
                                                     | ((((IData)(vlSelfRef.__PVT__xr) 
                                                          >> 6U) 
                                                         & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                        | ((((IData)(vlSelfRef.acc) 
                                                             >> 6U) 
                                                            & (IData)(vlSelfRef.__PVT__alu_ard)) 
                                                           | (((IData)(vlSelfRef.__PVT__t1668) 
                                                               & ((IData)(vlSelfRef.__PVT__s) 
                                                                  >> 6U)) 
                                                              | ((IData)(vlSelfRef.__PVT__psw_z) 
                                                                 & (IData)(vlSelfRef.__PVT__t2046)))))))))) 
                                        << 2U)) | (
                                                   (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                                     & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                         & ((IData)(vlSelfRef.__PVT__di) 
                                                            >> 5U)) 
                                                        | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                             >> 5U) 
                                                            & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                           | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                                >> 0x0000000dU) 
                                                               & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                              | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                                  & (IData)(vlSelfRef.m1)) 
                                                                 | ((((IData)(vlSelfRef.__PVT__xr) 
                                                                      >> 5U) 
                                                                     & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                                    | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                        & ((IData)(vlSelfRef.__PVT__s) 
                                                                           >> 5U)) 
                                                                       | (((IData)(vlSelfRef.acc) 
                                                                           >> 5U) 
                                                                          & (IData)(vlSelfRef.__PVT__alu_ard))))))))) 
                                                    << 1U) 
                                                   | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                                      & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                          & ((IData)(vlSelfRef.__PVT__di) 
                                                             >> 4U)) 
                                                         | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                              >> 4U) 
                                                             & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                            | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                                 >> 0x0000000cU) 
                                                                & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                               | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                                   & ((IData)(vlSelfRef.m5) 
                                                                      & (0x000000ffU 
                                                                         == 
                                                                         (0x000000ffU 
                                                                          & (~ 
                                                                             (0xd3U 
                                                                              ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                                  | ((((IData)(vlSelfRef.__PVT__xr) 
                                                                       >> 4U) 
                                                                      & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                                     | ((((IData)(vlSelfRef.acc) 
                                                                          >> 4U) 
                                                                         & (IData)(vlSelfRef.__PVT__alu_ard)) 
                                                                        | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                            & ((IData)(vlSelfRef.__PVT__s) 
                                                                               >> 4U)) 
                                                                           | ((IData)(vlSelfRef.__PVT__psw_ac) 
                                                                              & (IData)(vlSelfRef.__PVT__t2046)))))))))))) 
                           << 4U) | (((((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                        & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                            & ((IData)(vlSelfRef.__PVT__di) 
                                               >> 3U)) 
                                           | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                >> 3U) 
                                               & (IData)(vlSelfRef.__PVT__mxrl)) 
                                              | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                   >> 0x0000000bU) 
                                                  & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                 | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                     & (0x000000ffU 
                                                        == 
                                                        (0x000000ffU 
                                                         & (~ 
                                                            (0x76U 
                                                             ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                    | ((((IData)(vlSelfRef.__PVT__xr) 
                                                         >> 3U) 
                                                        & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                       | (((IData)(vlSelfRef.__PVT__t1668) 
                                                           & ((IData)(vlSelfRef.__PVT__s) 
                                                              >> 3U)) 
                                                          | (((IData)(vlSelfRef.acc) 
                                                              >> 3U) 
                                                             & (IData)(vlSelfRef.__PVT__alu_ard))))))))) 
                                       << 3U) | (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                                  & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                      & ((IData)(vlSelfRef.__PVT__di) 
                                                         >> 2U)) 
                                                     | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                          >> 2U) 
                                                         & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                        | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                             >> 0x0000000aU) 
                                                            & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                           | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                               & (IData)(vlSelfRef.__PVT__sy_stack)) 
                                                              | ((((IData)(vlSelfRef.__PVT__xr) 
                                                                   >> 2U) 
                                                                  & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                                 | ((((IData)(vlSelfRef.acc) 
                                                                      >> 2U) 
                                                                     & (IData)(vlSelfRef.__PVT__alu_ard)) 
                                                                    | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                        & ((IData)(vlSelfRef.__PVT__s) 
                                                                           >> 2U)) 
                                                                       | ((IData)(vlSelfRef.__PVT__psw_p) 
                                                                          & (IData)(vlSelfRef.__PVT__t2046)))))))))) 
                                                 << 2U)) 
                                     | ((((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                          & ((IData)(vlSelfRef.__PVT__t2046) 
                                             | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_11) 
                                                | (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                    & ((IData)(vlSelfRef.__PVT__di) 
                                                       >> 1U)) 
                                                   | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                        >> 1U) 
                                                       & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                      | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                           >> 9U) 
                                                          & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                         | ((((IData)(vlSelfRef.__PVT__xr) 
                                                              >> 1U) 
                                                             & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                            | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                & ((IData)(vlSelfRef.__PVT__s) 
                                                                   >> 1U)) 
                                                               | (((IData)(vlSelfRef.acc) 
                                                                   >> 1U) 
                                                                  & (IData)(vlSelfRef.__PVT__alu_ard)))))))))) 
                                         << 1U) | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3) 
                                                   & (((IData)(vlSelfRef.__PVT__dbin_ext) 
                                                       & (IData)(vlSelfRef.__PVT__di)) 
                                                      | (((IData)(vlSelfRef.__PVT__mxo) 
                                                          & (IData)(vlSelfRef.__PVT__mxrl)) 
                                                         | ((((IData)(vlSelfRef.__PVT__mxo) 
                                                              >> 8U) 
                                                             & (IData)(vlSelfRef.__PVT__mxrh)) 
                                                            | (((IData)(vlSelfRef.__PVT__t1f1) 
                                                                & (IData)(vlSelfRef.__PVT__inta)) 
                                                               | (((IData)(vlSelfRef.__PVT__xr) 
                                                                   & (IData)(vlSelfRef.__PVT__alu_xrd)) 
                                                                  | (((IData)(vlSelfRef.acc) 
                                                                      & (IData)(vlSelfRef.__PVT__alu_ard)) 
                                                                     | (((IData)(vlSelfRef.__PVT__t1668) 
                                                                         & (IData)(vlSelfRef.__PVT__s)) 
                                                                        | ((IData)(vlSelfRef.__PVT__psw_c) 
                                                                           & (IData)(vlSelfRef.__PVT__t2046)))))))))))));
}

VL_ATTR_COLD void Vcpm_top_vm80a_core___ctor_var_reset(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___ctor_var_reset\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    const uint64_t __VscopeHash = VL_MURMUR64_HASH(vlSelf->vlNamep);
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
    vlSelf->__PVT__id_mvmr = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 9228756899570649370ull);
    vlSelf->__PVT__id_mvrm = VL_SCOPED_RAND_RESET_I(1, __VscopeHash, 11925479025944934779ull);
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
    vlSelf->__VdfgRegularize_h6e95ff9d_0_0 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_3 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_5 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_6 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_8 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_9 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_10 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_11 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_15 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_19 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_20 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_21 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_27 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_28 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_29 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_30 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_31 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_32 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_33 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_34 = 0;
    vlSelf->__VdfgRegularize_h6e95ff9d_0_39 = 0;
    vlSelf->__Vdly__twf1 = 0;
    vlSelf->__Vdly__m1 = 0;
    vlSelf->__Vdly__inta = 0;
}
