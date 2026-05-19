// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

extern const VlUnpacked<CData/*0:0*/, 512> Vcpm_top__ConstPool__TABLE_ha98b427f_0;

void Vcpm_top_vm80a_core___ico_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___ico_sequent__TOP__cpm_top__cpu__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __PVT__dec16;
    __PVT__dec16 = 0;
    CData/*0:0*/ __PVT__iad16;
    __PVT__iad16 = 0;
    SData/*8:0*/ __Vtableidx1;
    __Vtableidx1 = 0;
    // Body
    vlSelfRef.__PVT__thalt = ((~ (IData)(vlSelfRef.m1)) 
                              & (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x76U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__PVT__ms0 = (1U & (~ (((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_20) 
                                      & (IData)(vlSelfRef.eom)) 
                                     | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_34))));
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
    __PVT__iad16 = (1U & ((~ ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6) 
                              & (IData)(vlSelfRef.__PVT__id00))) 
                          & ((IData)(vlSelfRef.m5) 
                             | ((~ (IData)(vlSelfRef.__PVT__minta)) 
                                | (IData)(vlSelfRef.__PVT__t3144)))));
    vlSelfRef.__PVT__sy_inp = ((IData)(vlSelfRef.m5) 
                               & (0x000000ffU == (0x000000ffU 
                                                  & (~ 
                                                     (0xdbU 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_21 = ((IData)(vlSelfRef.m2) 
                                                 | (IData)(vlSelfRef.m3));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5 = ((IData)(vlSelfRef.m4) 
                                                | (IData)(vlSelfRef.m5));
    vlSelfRef.__PVT__acc_sel = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_32)
                                 ? (7U == (7U & (IData)(vlSelfRef.__PVT__i)))
                                 : (7U == (7U & ((IData)(vlSelfRef.__PVT__i) 
                                                 >> 3U))));
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
    vlSelfRef.__PVT__ready_int = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (0x30U | (~ (9U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))));
    vlSelfRef.__PVT__mxi = (0x0000ffffU & (((~ (IData)(__PVT__dec16)) 
                                            & (IData)(__PVT__iad16))
                                            ? ((IData)(1U) 
                                               + (IData)(vlSelfRef.__PVT__a))
                                            : ((IData)(vlSelfRef.__PVT__a) 
                                               - (IData)(__PVT__dec16))));
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
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_11 = ((IData)(vlSelfRef.__PVT__t1f1) 
                                                 & (IData)(vlSelfRef.__PVT__sy_wo_n));
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

void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    SData/*8:0*/ __Vtableidx1;
    __Vtableidx1 = 0;
    CData/*0:0*/ __Vdly__m2;
    __Vdly__m2 = 0;
    CData/*0:0*/ __Vdly__m3;
    __Vdly__m3 = 0;
    CData/*0:0*/ __Vdly__m4;
    __Vdly__m4 = 0;
    CData/*0:0*/ __Vdly__m5;
    __Vdly__m5 = 0;
    CData/*0:0*/ __Vdly__tmp_c;
    __Vdly__tmp_c = 0;
    CData/*0:0*/ __Vdly__psw_ac;
    __Vdly__psw_ac = 0;
    // Body
    vlSelfRef.__Vdly__twf1 = vlSelfRef.__PVT__twf1;
    __Vdly__m3 = vlSelfRef.m3;
    __Vdly__m2 = vlSelfRef.m2;
    vlSelfRef.__Vdly__m1 = vlSelfRef.m1;
    __Vdly__m4 = vlSelfRef.m4;
    __Vdly__m5 = vlSelfRef.m5;
    __Vdly__tmp_c = vlSelfRef.__PVT__tmp_c;
    __Vdly__psw_ac = vlSelfRef.__PVT__psw_ac;
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.__PVT__t383 = (((~ (IData)(vlSelfRef.__PVT__t382)) 
                                  & (IData)(vlSelfRef.__PVT__hold)) 
                                 | (IData)(vlSelfRef.__PVT__t383));
    }
    if ((1U & (~ (IData)(vlSymsp->TOP__cpm_top.f2)))) {
        vlSelfRef.__PVT__t383 = 0U;
    }
    vlSelfRef.__PVT__xchg_dh = (1U & ((~ (IData)(vlSelfRef.__PVT__reset)) 
                                      & (((IData)(vlSelfRef.__PVT__xchg_tt) 
                                          & (~ ((0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (~ 
                                                     (0xebU 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                & (IData)(vlSelfRef.t2))))
                                          ? (~ (IData)(vlSelfRef.__PVT__xchg_dh))
                                          : (IData)(vlSelfRef.__PVT__xchg_dh))));
    if (vlSelfRef.__PVT__inta) {
        vlSelfRef.__PVT__minta = 1U;
    }
    if ((((IData)(vlSymsp->TOP__cpm_top.f1) & (IData)(vlSelfRef.t1)) 
         & (IData)(vlSelfRef.m1))) {
        vlSelfRef.__PVT__minta = 0U;
    }
    vlSelfRef.__PVT__dbin_ext = (((IData)(vlSymsp->TOP__cpm_top.f2) 
                                  | (IData)(vlSelfRef.__PVT__dbin_pin)) 
                                 & (((IData)(vlSelfRef.__PVT__t1124) 
                                     & ((IData)(vlSelfRef.__PVT__m1f1) 
                                        | (~ (0x000000ffU 
                                              == (0x000000ffU 
                                                  & (~ 
                                                     (0x76U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                    | (IData)(vlSelfRef.__PVT__dbin_ext)));
    if (vlSelfRef.__PVT__dbin_pin) {
        vlSelfRef.__PVT__di = vlSymsp->TOP__cpm_top.__PVT__cpu_din;
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.__Vdly__m1 = (1U & (((~ (IData)(vlSelfRef.__PVT__ms0)) 
                                       & (~ (IData)(vlSelfRef.__PVT__ms1))) 
                                      | ((~ (IData)(vlSelfRef.__PVT__ms1)) 
                                         & (IData)(vlSelfRef.__PVT__m1f1))));
        __Vdly__m2 = (((~ (IData)(vlSelfRef.__PVT__ms0)) 
                       | (~ (IData)(vlSelfRef.__PVT__ms1))) 
                      & (((IData)(vlSelfRef.__PVT__ms0) 
                          & (IData)(vlSelfRef.__PVT__m2f1)) 
                         | ((IData)(vlSelfRef.__PVT__ms1) 
                            & (IData)(vlSelfRef.__PVT__m1f1))));
        __Vdly__m3 = (((IData)(vlSelfRef.__PVT__ms0) 
                       & (IData)(vlSelfRef.__PVT__m3f1)) 
                      | ((IData)(vlSelfRef.__PVT__ms1) 
                         & (IData)(vlSelfRef.__PVT__m2f1)));
        __Vdly__m4 = ((((IData)(vlSelfRef.__PVT__ms0) 
                        & (IData)(vlSelfRef.__PVT__m4f1)) 
                       | ((IData)(vlSelfRef.__PVT__ms1) 
                          & (IData)(vlSelfRef.__PVT__m3f1))) 
                      | ((IData)(vlSelfRef.__PVT__ms0) 
                         & (IData)(vlSelfRef.__PVT__ms1)));
        __Vdly__m5 = (((IData)(vlSelfRef.__PVT__ms0) 
                       & (IData)(vlSelfRef.__PVT__m5f1)) 
                      | ((IData)(vlSelfRef.__PVT__ms1) 
                         & (IData)(vlSelfRef.__PVT__m4f1)));
        if (vlSelfRef.__PVT__t2175) {
            __Vdly__tmp_c = vlSelfRef.__PVT__psw_c;
        }
        if (vlSelfRef.__PVT__t4f1) {
            if (vlSelfRef.__PVT__id_sbb) {
                __Vdly__tmp_c = (1U & (~ (IData)(vlSelfRef.__PVT__psw_c)));
            }
            if (((((((0x000000ffU == (0x000000ffU & 
                                      (0x38U | (~ (4U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                     | (IData)(vlSelfRef.__PVT__id_ora)) 
                    | (IData)(vlSelfRef.__PVT__id_xra)) 
                   | (IData)(vlSelfRef.__PVT__id_ana)) 
                  | (IData)(vlSelfRef.__PVT__id_cmp)) 
                 | (IData)(vlSelfRef.__PVT__id_sub))) {
                __Vdly__tmp_c = 1U;
            }
            if ((((((0x000000ffU == (0x000000ffU & 
                                     (0x30U | (~ (9U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                    | (IData)(vlSelfRef.__PVT__id_cma)) 
                   | (0x000000ffU == (0x000000ffU & 
                                      (0x38U | (~ (5U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))) 
                  | (IData)(vlSelfRef.__PVT__id_add)) 
                 | (IData)(vlSelfRef.__PVT__id_stc))) {
                __Vdly__tmp_c = 0U;
            }
        }
        if (vlSelfRef.__PVT__psw_ld) {
            __Vdly__psw_ac = (1U & ((IData)(vlSelfRef.__PVT__d) 
                                    >> 4U));
            vlSelfRef.__PVT__psw_p = (1U & ((IData)(vlSelfRef.__PVT__d) 
                                            >> 2U));
            vlSelfRef.__PVT__psw_z = (1U & ((IData)(vlSelfRef.__PVT__d) 
                                            >> 6U));
            vlSelfRef.__PVT__psw_s = (1U & ((IData)(vlSelfRef.__PVT__d) 
                                            >> 7U));
            vlSelfRef.__PVT__psw_c = (1U & (IData)(vlSelfRef.__PVT__d));
        }
        if (vlSelfRef.__PVT__psw_wr) {
            __Vdly__psw_ac = (((((IData)(vlSelfRef.__PVT__c__BRA__3__KET__) 
                                 & (~ (IData)(vlSelfRef.__PVT__id_xra))) 
                                & (~ (IData)(vlSelfRef.__PVT__id_ora))) 
                               & (~ (IData)(vlSelfRef.__PVT__id_rxc))) 
                              | ((IData)(vlSelfRef.__PVT__id_ana) 
                                 & (((IData)(vlSelfRef.__PVT__x) 
                                     | (IData)(vlSelfRef.__PVT__r)) 
                                    >> 3U)));
            vlSelfRef.__PVT__psw_p = (1U & (~ VL_REDXOR_8(vlSelfRef.__PVT__s)));
            vlSelfRef.__PVT__psw_z = (1U & (~ (0U != (IData)(vlSelfRef.__PVT__s))));
            vlSelfRef.__PVT__psw_s = (1U & ((IData)(vlSelfRef.__PVT__s) 
                                            >> 7U));
        }
        vlSelfRef.__PVT__dbin_pin = ((IData)(vlSelfRef.__PVT__t1124) 
                                     & ((IData)(vlSelfRef.__PVT__m1f1) 
                                        | (~ (0x000000ffU 
                                              == (0x000000ffU 
                                                  & (~ 
                                                     (0x76U 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))))));
        if (vlSelfRef.__PVT__t3403) {
            if (vlSelfRef.__PVT__mxr1) {
                vlSelfRef.__PVT__r16_hl = vlSelfRef.__PVT__mxi;
            }
            if (vlSelfRef.__PVT__mxr2) {
                vlSelfRef.__PVT__r16_de = vlSelfRef.__PVT__mxi;
            }
            if (vlSelfRef.__PVT__mxr3) {
                vlSelfRef.__PVT__r16_bc = vlSelfRef.__PVT__mxi;
            }
            if (vlSelfRef.__PVT__mxr4) {
                vlSelfRef.__PVT__r16_sp = vlSelfRef.__PVT__mxi;
            }
            if ((1U & (~ (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10)))) {
                vlSelfRef.__PVT__r16_wz = vlSelfRef.__PVT__mxi;
            }
            if (vlSelfRef.__PVT__tree0) {
                vlSelfRef.__PVT__r16_pc = vlSelfRef.__PVT__mxi;
            }
        } else {
            if (vlSelfRef.__PVT__mxwl) {
                if (vlSelfRef.__PVT__mxr1) {
                    vlSelfRef.__PVT__r16_hl = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_hl)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
                if (vlSelfRef.__PVT__mxr2) {
                    vlSelfRef.__PVT__r16_de = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_de)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
                if (vlSelfRef.__PVT__mxr3) {
                    vlSelfRef.__PVT__r16_bc = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_bc)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
                if (vlSelfRef.__PVT__mxr4) {
                    vlSelfRef.__PVT__r16_sp = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_sp)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
                if ((1U & (~ (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10)))) {
                    vlSelfRef.__PVT__r16_wz = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_wz)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
                if (vlSelfRef.__PVT__tree0) {
                    vlSelfRef.__PVT__r16_pc = ((0xff00U 
                                                & (IData)(vlSelfRef.__PVT__r16_pc)) 
                                               | (IData)(vlSelfRef.__PVT__d));
                }
            }
            if (vlSelfRef.__PVT__mxwh) {
                if (vlSelfRef.__PVT__mxr1) {
                    vlSelfRef.__PVT__r16_hl = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_hl)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
                if (vlSelfRef.__PVT__mxr2) {
                    vlSelfRef.__PVT__r16_de = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_de)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
                if (vlSelfRef.__PVT__mxr3) {
                    vlSelfRef.__PVT__r16_bc = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_bc)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
                if (vlSelfRef.__PVT__mxr4) {
                    vlSelfRef.__PVT__r16_sp = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_sp)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
                if ((1U & (~ (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_10)))) {
                    vlSelfRef.__PVT__r16_wz = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_wz)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
                if (vlSelfRef.__PVT__tree0) {
                    vlSelfRef.__PVT__r16_pc = ((0x00ffU 
                                                & (IData)(vlSelfRef.__PVT__r16_pc)) 
                                               | ((IData)(vlSelfRef.__PVT__d) 
                                                  << 8U));
                }
            }
        }
        if (((IData)(vlSelfRef.__PVT__a327) | ((IData)(vlSelfRef.__PVT__t4f1) 
                                               & ((0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x38U 
                                                       | (~ 
                                                          (0xc7U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                  | ((~ 
                                                      (0x000000ffU 
                                                       == 
                                                       (0x000000ffU 
                                                        & (0x3fU 
                                                           | (~ 
                                                              (0xc0U 
                                                               ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                     | (0x000000ffU 
                                                        == 
                                                        (0x000000ffU 
                                                         & (~ 
                                                            (0xd3U 
                                                             ^ (IData)(vlSelfRef.__PVT__i)))))))))) {
            vlSelfRef.__PVT__xr = ((0x000000ffU == 
                                    (0x000000ffU & 
                                     (0x38U | (~ (0xc7U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))))
                                    ? (0x38U & (IData)(vlSelfRef.__PVT__i))
                                    : (IData)(vlSelfRef.__PVT__d));
        }
        if (((IData)(vlSelfRef.__PVT__t3363) | ((~ 
                                                 ((0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x30U 
                                                       | (~ 
                                                          (9U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                  | (0x000000ffU 
                                                     == 
                                                     (0x000000ffU 
                                                      & (~ 
                                                         (0x76U 
                                                          ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                & (IData)(vlSelfRef.__PVT__t4f1)))) {
            vlSelfRef.__PVT__a = vlSelfRef.__PVT__mxo;
        }
        vlSelfRef.__PVT__sync = ((~ (IData)(vlSelfRef.__PVT__ready_int)) 
                                 & (IData)(vlSelfRef.__PVT__t1f1));
        if (vlSelfRef.__PVT__t2222) {
            if ((((((IData)(vlSelfRef.__PVT__id_xra) 
                    | (IData)(vlSelfRef.__PVT__id_stc)) 
                   | (IData)(vlSelfRef.__PVT__id_ora)) 
                  | (IData)(vlSelfRef.__PVT__id_ana)) 
                 | (IData)(((0x38U == (0x38U & (IData)(vlSelfRef.__PVT__i))) 
                            & (0x000000ffU == (0x000000ffU 
                                               & (0x38U 
                                                  | (~ 
                                                     (7U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))))) {
                vlSelfRef.__PVT__psw_c = (1U & (~ (IData)(vlSelfRef.__PVT__tmp_c)));
            }
            if ((((IData)(vlSelfRef.__PVT__id_cmp) 
                  | (IData)(vlSelfRef.__PVT__id_sbb)) 
                 | (IData)(vlSelfRef.__PVT__id_sub))) {
                vlSelfRef.__PVT__psw_c = (1U & (~ ((IData)(vlSelfRef.__PVT__t2133) 
                                                   | ((IData)(vlSelfRef.__PVT__id_rxc) 
                                                      & (IData)(vlSelfRef.__PVT__x)))));
            }
            if (((((0x000000ffU == (0x000000ffU & (0x30U 
                                                   | (~ 
                                                      (9U 
                                                       ^ (IData)(vlSelfRef.__PVT__i)))))) 
                   | (IData)(vlSelfRef.__PVT__id_sha)) 
                  | (IData)(vlSelfRef.__PVT__id_adc)) 
                 | (IData)(vlSelfRef.__PVT__id_add))) {
                vlSelfRef.__PVT__psw_c = ((IData)(vlSelfRef.__PVT__t2133) 
                                          | ((IData)(vlSelfRef.__PVT__id_rxc) 
                                             & (IData)(vlSelfRef.__PVT__x)));
            }
        }
        if (((IData)(vlSelfRef.__PVT__daa) & (IData)(vlSelfRef.__PVT__daa_6x))) {
            vlSelfRef.__PVT__psw_c = 1U;
        }
        if (((IData)(vlSelfRef.__PVT__t4f1) & ((IData)(vlSelfRef.__PVT__id_sha) 
                                               | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_0)))) {
            vlSelfRef.__PVT__r = vlSelfRef.acc;
        }
        if (vlSelfRef.__PVT__t1780) {
            vlSelfRef.__PVT__r = vlSelfRef.__PVT__d;
        }
        if (((IData)(vlSelfRef.__PVT__t4f1) & (0x000000ffU 
                                               == (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (5U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))))) {
            vlSelfRef.__PVT__r = 0xffU;
        }
        if (vlSelfRef.__PVT__daa) {
            vlSelfRef.__PVT__r = ((0xf9U & (IData)(vlSelfRef.__PVT__r)) 
                                  | (6U & ((- (IData)(
                                                      ((IData)(vlSelfRef.__PVT__psw_ac) 
                                                       | (((IData)(vlSelfRef.acc) 
                                                           >> 3U) 
                                                          & (0U 
                                                             != 
                                                             (3U 
                                                              & ((IData)(vlSelfRef.acc) 
                                                                 >> 1U))))))) 
                                           << 1U)));
            vlSelfRef.__PVT__r = ((0x9fU & (IData)(vlSelfRef.__PVT__r)) 
                                  | (0x00000060U & 
                                     ((- (IData)((IData)(vlSelfRef.__PVT__daa_6x))) 
                                      << 5U)));
        }
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__Vdly__twf1 = vlSelfRef.__PVT__tw;
        vlSelfRef.__PVT__t1994 = vlSelfRef.__PVT__acc_sel;
        vlSelfRef.__PVT__t976 = ((IData)(vlSelfRef.__PVT__t980) 
                                 & (IData)(vlSelfRef.m4));
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.__PVT__t980 = vlSelfRef.__PVT__inta;
        if (((IData)(vlSelfRef.__PVT__t1497) | (IData)(vlSelfRef.__PVT__a357))) {
            vlSelfRef.acc = vlSelfRef.__PVT__d;
        }
        if (((IData)(vlSelfRef.__PVT__t2222) & ((IData)(vlSelfRef.__PVT__id_adc) 
                                                | ((IData)(vlSelfRef.__PVT__id_add) 
                                                   | ((IData)(vlSelfRef.__PVT__id_daa) 
                                                      | ((IData)(vlSelfRef.__PVT__id_xra) 
                                                         | ((IData)(vlSelfRef.__PVT__id_sbb) 
                                                            | ((IData)(vlSelfRef.__PVT__id_sub) 
                                                               | ((IData)(vlSelfRef.__PVT__id_ana) 
                                                                  | ((IData)(vlSelfRef.__PVT__id_ora) 
                                                                     | ((IData)(vlSelfRef.__PVT__id_sha) 
                                                                        | (IData)(vlSelfRef.__PVT__id_cma)))))))))))) {
            vlSelfRef.acc = vlSelfRef.__PVT__s;
        }
    }
    if (((IData)(vlSymsp->TOP__cpm_top.f2) & (IData)(vlSelfRef.__PVT__db_stb))) {
        vlSelfRef.__PVT__db = vlSelfRef.__PVT__d;
    }
    vlSelfRef.__PVT__xchg_tt = ((0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0xebU 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))) 
                                & (IData)(vlSelfRef.t2));
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t953 = vlSelfRef.__PVT__reset;
        vlSelfRef.__PVT__tree1 = vlSelfRef.__PVT__t1460;
        vlSelfRef.__PVT__t887 = vlSelfRef.__PVT__hold;
        vlSelfRef.__PVT__t1993 = ((IData)(vlSelfRef.t4) 
                                  & (IData)(vlSelfRef.m1));
        vlSelfRef.__PVT__t5f1 = vlSelfRef.__PVT__t5;
        vlSelfRef.__PVT__t3144 = (((IData)(vlSelfRef.t4) 
                                   | (IData)(vlSelfRef.__PVT__t5)) 
                                  | ((IData)(vlSelfRef.m4) 
                                     & (~ (IData)(vlSelfRef.__PVT__id02))));
        vlSelfRef.__PVT__t2806 = ((IData)(vlSelfRef.__PVT__id08) 
                                  & (((IData)(vlSelfRef.t3) 
                                      & (IData)(vlSelfRef.m4)) 
                                     | ((IData)(vlSelfRef.__PVT__t5) 
                                        & (IData)(vlSelfRef.m1))));
        vlSelfRef.__PVT__t3335 = ((IData)(vlSelfRef.__PVT__id07) 
                                  & ((((IData)(vlSelfRef.t1) 
                                       & ((IData)(vlSelfRef.m4) 
                                          | (IData)(vlSelfRef.m5))) 
                                      | ((IData)(vlSelfRef.t3) 
                                         & ((IData)(vlSelfRef.m2) 
                                            | (IData)(vlSelfRef.m3)))) 
                                     | (IData)(vlSelfRef.__PVT__t5)));
        vlSelfRef.__PVT__t789 = (((((0x000000ffU == 
                                     (0x000000ffU & 
                                      (0x30U | (~ (1U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                    | ((0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x38U 
                                               | (~ 
                                                  (0xc2U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       | (0x000000ffU 
                                          == (0x000000ffU 
                                              & (8U 
                                                 | (~ 
                                                    (0xc3U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                   & (IData)(vlSelfRef.m3)) 
                                  | ((((0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x38U 
                                               | (~ 
                                                  (0x86U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       | ((0x000000ffU 
                                           == (0x000000ffU 
                                               & (8U 
                                                  | (~ 
                                                     (0x32U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                          | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                             | ((IData)(vlSelfRef.__PVT__id_mvrm) 
                                                | ((0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x38U 
                                                        | (~ 
                                                           (0xc6U 
                                                            ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                   | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_28)))))) 
                                      & (~ (0x000000ffU 
                                            == (0x000000ffU 
                                                & (~ 
                                                   (0x36U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                     & (IData)(vlSelfRef.m4))) 
                                 | (IData)(vlSelfRef.m5));
        vlSelfRef.__PVT__a358 = (((IData)(vlSelfRef.t2) 
                                  & (~ (IData)(vlSelfRef.__PVT__sy_wo_n))) 
                                 & (((((0x000000ffU 
                                        == (0x000000ffU 
                                            & (8U | 
                                               (~ (0xd3U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       | (0x000000ffU 
                                          == (0x000000ffU 
                                              & (~ 
                                                 (0x36U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                      | (0x000000ffU 
                                         == (0x000000ffU 
                                             & (8U 
                                                | (~ 
                                                   (0x32U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                     | (0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x18U 
                                               | (~ 
                                                  (2U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                    | (IData)(vlSelfRef.__PVT__id_mvmr)));
        vlSelfRef.__PVT__t1375 = (((IData)(vlSelfRef.t2) 
                                   & (IData)(vlSelfRef.m4)) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (~ (0xf5U ^ (IData)(vlSelfRef.__PVT__i))))));
        vlSelfRef.__PVT__t2046 = (((IData)(vlSelfRef.t2) 
                                   & (IData)(vlSelfRef.m5)) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (~ (0xf5U ^ (IData)(vlSelfRef.__PVT__i))))));
        vlSelfRef.__PVT__t3047 = (((((IData)(vlSelfRef.t1) 
                                     | (IData)(vlSelfRef.t2)) 
                                    & (IData)(vlSelfRef.m4)) 
                                   & (0x000000ffU == 
                                      (0x000000ffU 
                                       & (0x30U | (~ 
                                                   (9U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                  | ((IData)(vlSelfRef.t2) 
                                     & (((IData)(vlSelfRef.m4) 
                                         & (0x000000ffU 
                                            == (0x000000ffU 
                                                & (~ 
                                                   (0x22U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                        | ((IData)(vlSelfRef.m5) 
                                           & (IData)(vlSelfRef.__PVT__id03)))));
        vlSelfRef.__PVT__t2998 = (((((IData)(vlSelfRef.t1) 
                                     | (IData)(vlSelfRef.t2)) 
                                    & (IData)(vlSelfRef.m5)) 
                                   & (0x000000ffU == 
                                      (0x000000ffU 
                                       & (0x30U | (~ 
                                                   (9U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                  | ((IData)(vlSelfRef.t2) 
                                     & (((IData)(vlSelfRef.m5) 
                                         & (0x000000ffU 
                                            == (0x000000ffU 
                                                & (~ 
                                                   (0x22U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                        | ((IData)(vlSelfRef.m4) 
                                           & (IData)(vlSelfRef.__PVT__id03)))));
        vlSelfRef.__PVT__t2819 = ((IData)(vlSelfRef.__PVT__reset) 
                                  | ((IData)(vlSelfRef.t3) 
                                     & (((IData)(vlSelfRef.m2) 
                                         | ((IData)(vlSelfRef.m4) 
                                            & (IData)(vlSelfRef.__PVT__id06))) 
                                        | ((IData)(vlSelfRef.m5) 
                                           & (0x000000ffU 
                                              == (0x000000ffU 
                                                  & (0x38U 
                                                     | (~ 
                                                        (0xc7U 
                                                         ^ (IData)(vlSelfRef.__PVT__i))))))))));
        vlSelfRef.__PVT__t2817 = ((IData)(vlSelfRef.__PVT__reset) 
                                  | ((IData)(vlSelfRef.t3) 
                                     & ((((IData)(vlSelfRef.m1) 
                                          | (IData)(vlSelfRef.m3)) 
                                         | ((IData)(vlSelfRef.m4) 
                                            & (0x000000ffU 
                                               == (0x000000ffU 
                                                   & (8U 
                                                      | (~ 
                                                         (0xd3U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                        | ((IData)(vlSelfRef.m5) 
                                           & (IData)(vlSelfRef.__PVT__id06)))));
        vlSelfRef.__PVT__t1698 = (((((IData)(vlSelfRef.__PVT__t5) 
                                     & (IData)(vlSelfRef.m1)) 
                                    & (~ (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (4U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                   & (~ (0x000000ffU 
                                         == (0x000000ffU 
                                             & (0x38U 
                                                | (~ 
                                                   (5U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                  | (((IData)(vlSelfRef.t3) 
                                      & (IData)(vlSelfRef.m5)) 
                                     & (0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x38U 
                                               | (~ 
                                                  (0xc7U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))));
    }
    vlSelfRef.__PVT__alu_xrd = ((IData)(vlSelfRef.__PVT__t1698) 
                                | (IData)(vlSelfRef.__PVT__a358));
    vlSelfRef.__PVT__tmp_c = __Vdly__tmp_c;
    vlSelfRef.__PVT__psw_ac = __Vdly__psw_ac;
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t1668 = ((((((IData)(vlSelfRef.t2) 
                                      & (IData)(vlSelfRef.m5)) 
                                     & ((0x000000ffU 
                                         == (0x000000ffU 
                                             & (0x38U 
                                                | (~ 
                                                   (4U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                        | (0x000000ffU 
                                           == (0x000000ffU 
                                               & (0x38U 
                                                  | (~ 
                                                     (5U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                    | (((IData)(vlSelfRef.t3) 
                                        & (IData)(vlSelfRef.m5)) 
                                       & (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x30U 
                                                 | (~ 
                                                    (9U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                   | (((IData)(vlSelfRef.t3) 
                                       & (IData)(vlSelfRef.m4)) 
                                      & (0x000000ffU 
                                         == (0x000000ffU 
                                             & (0x30U 
                                                | (~ 
                                                   (9U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                  | (((IData)(vlSelfRef.__PVT__t5) 
                                      & (IData)(vlSelfRef.m1)) 
                                     & ((0x000000ffU 
                                         == (0x000000ffU 
                                             & (0x38U 
                                                | (~ 
                                                   (4U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                        | (0x000000ffU 
                                           == (0x000000ffU 
                                               & (0x38U 
                                                  | (~ 
                                                     (5U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))));
        vlSelfRef.eom = ((((((IData)(vlSelfRef.__PVT__t5) 
                             | (((IData)(vlSelfRef.t4) 
                                 & (IData)(vlSelfRef.m1)) 
                                & ((0x000000ffU == 
                                    (0x000000ffU & 
                                     (0x30U | (~ (1U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                   | ((0x000000ffU 
                                       == (0x000000ffU 
                                           & (0x30U 
                                              | (~ 
                                                 (0xc1U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                      | ((0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (0x86U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                         | ((0x000000ffU 
                                             == (0x000000ffU 
                                                 & (1U 
                                                    | (~ 
                                                       (0x34U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                            | ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (9U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | ((0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (~ 
                                                       (0xe3U 
                                                        ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                  | ((0x000000ffU 
                                                      == 
                                                      (0x000000ffU 
                                                       & (~ 
                                                          (0xebU 
                                                           ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                     | ((0x000000ffU 
                                                         == 
                                                         (0x000000ffU 
                                                          & (0x38U 
                                                             | (~ 
                                                                (0xc2U 
                                                                 ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                        | ((0x000000ffU 
                                                            == 
                                                            (0x000000ffU 
                                                             & (0x10U 
                                                                | (~ 
                                                                   (0xc9U 
                                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
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
                                                                      & (8U 
                                                                         | (~ 
                                                                            (0x32U 
                                                                             ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                                    | ((IData)(vlSelfRef.__PVT__id_mvmr) 
                                                                       | ((IData)(vlSelfRef.__PVT__id_mvrm) 
                                                                          | ((0x000000ffU 
                                                                              == 
                                                                              (0x000000ffU 
                                                                               & (~ 
                                                                                (0x76U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i))))) 
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
                                                                                & (~ 
                                                                                (0x36U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                                                | ((0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (8U 
                                                                                | (~ 
                                                                                (0xc3U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                                                | ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_9) 
                                                                                | ((0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (0x38U 
                                                                                | (~ 
                                                                                (6U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                                                | ((0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (0x18U 
                                                                                | (~ 
                                                                                (2U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                                                | ((0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (~ 
                                                                                (0x2aU 
                                                                                ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                                                | ((0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (~ 
                                                                                (0x22U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                                                | (0x000000ffU 
                                                                                == 
                                                                                (0x000000ffU 
                                                                                & (0x3fU 
                                                                                | (~ 
                                                                                (0x80U 
                                                                                ^ (IData)(vlSelfRef.__PVT__i))))))))))))))))))))))))))))))) 
                            | ((IData)(vlSelfRef.t3) 
                               & (IData)(vlSelfRef.m2))) 
                           | ((IData)(vlSelfRef.t3) 
                              & (IData)(vlSelfRef.m3))) 
                          | ((IData)(vlSelfRef.t3) 
                             & (IData)(vlSelfRef.m4))) 
                         | (((IData)(vlSelfRef.t3) 
                             & (IData)(vlSelfRef.m5)) 
                            & (~ (0x000000ffU == (0x000000ffU 
                                                  & (~ 
                                                     (0xe3U 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))))));
        vlSelfRef.__PVT__tree2 = (((((IData)(vlSelfRef.t1) 
                                     & (((IData)(vlSelfRef.m4) 
                                         & (((0x000000ffU 
                                              == (0x000000ffU 
                                                  & (0x3fU 
                                                     | (~ 
                                                        (0x40U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                             | (0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x39U 
                                                    | (~ 
                                                       (4U 
                                                        ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                            | (0x000000ffU 
                                               == (0x000000ffU 
                                                   & (0x3fU 
                                                      | (~ 
                                                         (0x80U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                        | ((IData)(vlSelfRef.m5) 
                                           & (IData)(vlSelfRef.__PVT__id08)))) 
                                    | ((IData)(vlSelfRef.t2) 
                                       & (((IData)(vlSelfRef.m4) 
                                           & (((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (~ 
                                                    (0x22U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))) 
                                               | (IData)(vlSelfRef.__PVT__id00)) 
                                              | (0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (0x30U 
                                                     | (~ 
                                                        (9U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                          | ((IData)(vlSelfRef.m5) 
                                             & (((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (~ 
                                                      (0x22U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))) 
                                                 | (IData)(vlSelfRef.__PVT__id00)) 
                                                | (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x30U 
                                                       | (~ 
                                                          (9U 
                                                           ^ (IData)(vlSelfRef.__PVT__i))))))))))) 
                                   | ((IData)(vlSelfRef.t3) 
                                      & (((IData)(vlSelfRef.m4) 
                                          & ((0x000000ffU 
                                              == (0x000000ffU 
                                                  & (~ 
                                                     (0x2aU 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))) 
                                             | (0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x30U 
                                                    | (~ 
                                                       (9U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                         | ((IData)(vlSelfRef.m5) 
                                            & ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (~ 
                                                    (0x2aU 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))) 
                                               | (0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x30U 
                                                      | (~ 
                                                         (9U 
                                                          ^ (IData)(vlSelfRef.__PVT__i))))))))))) 
                                  | ((IData)(vlSelfRef.__PVT__t5) 
                                     & (IData)(vlSelfRef.m5)));
        vlSelfRef.__PVT__t3361 = ((((((IData)(vlSelfRef.t1) 
                                      & (IData)(vlSelfRef.m4)) 
                                     & (0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x18U 
                                               | (~ 
                                                  (2U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                    | (((IData)(vlSelfRef.t2) 
                                        & (IData)(vlSelfRef.__PVT__id10)) 
                                       & (~ (IData)(vlSelfRef.__PVT__sy_wo_n)))) 
                                   | ((((IData)(vlSelfRef.t3) 
                                        & (IData)(vlSelfRef.__PVT__id10)) 
                                       & (IData)(vlSelfRef.__PVT__sy_wo_n)) 
                                      & ((IData)(vlSelfRef.m4) 
                                         | (IData)(vlSelfRef.m5)))) 
                                  | (((IData)(vlSelfRef.__PVT__t5) 
                                      & (IData)(vlSelfRef.__PVT__id08)) 
                                     & (IData)(vlSelfRef.m1)));
        vlSelfRef.__PVT__sy_stack = ((((IData)(vlSelfRef.t1) 
                                       & (IData)(vlSelfRef.__PVT__t1460)) 
                                      | ((((IData)(vlSelfRef.t3) 
                                           & (IData)(vlSelfRef.m3)) 
                                          & (0x000000ffU 
                                             == (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc4U 
                                                        ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                         & (~ (IData)(vlSelfRef.__PVT__jmptake)))) 
                                     | ((((IData)(vlSelfRef.__PVT__t5) 
                                          & (IData)(vlSelfRef.m1)) 
                                         & (0x000000ffU 
                                            == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (0xc0U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                        & (~ (IData)(vlSelfRef.__PVT__jmptake))));
        vlSelfRef.__PVT__wr_n = (1U & (((~ ((IData)(vlSelfRef.t3) 
                                            | (IData)(vlSelfRef.__PVT__tw))) 
                                        | (IData)(vlSelfRef.__PVT__ready_int)) 
                                       | (IData)(vlSelfRef.__PVT__sy_wo_n)));
        vlSelfRef.__PVT__m3f1 = vlSelfRef.m3;
        vlSelfRef.__PVT__m2f1 = vlSelfRef.m2;
        vlSelfRef.__PVT__m4f1 = vlSelfRef.m4;
        vlSelfRef.__PVT__m5f1 = vlSelfRef.m5;
        vlSelfRef.__PVT__t2175 = (((IData)(vlSelfRef.t3) 
                                   & (IData)(vlSelfRef.m1)) 
                                  | (((IData)(vlSelfRef.t2) 
                                      & (IData)(vlSelfRef.m5)) 
                                     & (0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x30U 
                                               | (~ 
                                                  (9U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))));
        vlSelfRef.__PVT__m1f1 = vlSelfRef.m1;
        vlSelfRef.__PVT__t1124 = (((IData)(vlSelfRef.t2) 
                                   | (IData)(vlSelfRef.__PVT__tw)) 
                                  & (IData)(vlSelfRef.__PVT__sy_wo_n));
        vlSelfRef.__PVT__psw_wr = (((IData)(vlSelfRef.t2) 
                                    & (IData)(vlSelfRef.m1)) 
                                   & (((((0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (0xc6U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                         | (0x000000ffU 
                                            == (0x000000ffU 
                                                & (0x38U 
                                                   | (~ 
                                                      (4U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                        | (0x000000ffU 
                                           == (0x000000ffU 
                                               & (0x38U 
                                                  | (~ 
                                                     (5U 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                       | (IData)(vlSelfRef.__PVT__id_daa)) 
                                      | (0x000000ffU 
                                         == (0x000000ffU 
                                             & (0x3fU 
                                                | (~ 
                                                   (0x80U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))));
        vlSelfRef.__PVT__a327 = ((((IData)(vlSelfRef.t3) 
                                   & (IData)(vlSelfRef.m4)) 
                                  & (~ (((0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x30U 
                                                 | (~ 
                                                    (9U 
                                                     ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                         | (0x000000ffU 
                                            == (0x000000ffU 
                                                & (~ 
                                                   (0xd3U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                        | (0x000000ffU 
                                           == (0x000000ffU 
                                               & (0x38U 
                                                  | (~ 
                                                     (0xc7U 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))))))) 
                                 | (((IData)(vlSelfRef.t2) 
                                     & ((IData)(vlSelfRef.m4) 
                                        | (IData)(vlSelfRef.m5))) 
                                    & (0x000000ffU 
                                       == (0x000000ffU 
                                           & (0x30U 
                                              | (~ 
                                                 (9U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))))));
        vlSelfRef.__PVT__t3403 = ((((IData)(vlSelfRef.t2) 
                                    & ((((IData)(vlSelfRef.m1) 
                                         | (IData)(vlSelfRef.m2)) 
                                        | ((IData)(vlSelfRef.m3) 
                                           & (~ (0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (~ 
                                                     (0xe3U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                       | ((((IData)(vlSelfRef.m4) 
                                            | (IData)(vlSelfRef.m5)) 
                                           & (~ (0x000000ffU 
                                                 == 
                                                 (0x000000ffU 
                                                  & (0x30U 
                                                     | (~ 
                                                        (9U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                          & (~ (IData)(vlSelfRef.__PVT__id09))))) 
                                   | (((IData)(vlSelfRef.t3) 
                                       & (IData)(vlSelfRef.m4)) 
                                      & (IData)(vlSelfRef.__PVT__id09))) 
                                  | ((IData)(vlSelfRef.__PVT__t5) 
                                     & ((IData)(vlSelfRef.m5) 
                                        | ((IData)(vlSelfRef.m1) 
                                           & (~ (IData)(vlSelfRef.__PVT__id08))))));
        vlSelfRef.__PVT__tree0 = (((((IData)(vlSelfRef.t1) 
                                     & (((((IData)(vlSelfRef.m1) 
                                           & (~ ((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0xc7U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | ((0x000000ffU 
                                                     == 
                                                     (0x000000ffU 
                                                      & (8U 
                                                         | (~ 
                                                            (0xc3U 
                                                             ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                    | (((IData)(vlSelfRef.__PVT__jmptake) 
                                                        & ((0x000000ffU 
                                                            == 
                                                            (0x000000ffU 
                                                             & (0x38U 
                                                                | (~ 
                                                                   (0xc4U 
                                                                    ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                           | (0x000000ffU 
                                                              == 
                                                              (0x000000ffU 
                                                               & (0x38U 
                                                                  | (~ 
                                                                     (0xc2U 
                                                                      ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                                       | (0x000000ffU 
                                                          == 
                                                          (0x000000ffU 
                                                           & (0x30U 
                                                              | (~ 
                                                                 (0xcdU 
                                                                  ^ (IData)(vlSelfRef.__PVT__i))))))))))) 
                                          | ((IData)(vlSelfRef.m2) 
                                             & (~ (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (~ 
                                                       (0xe3U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                         | ((IData)(vlSelfRef.m3) 
                                            & (~ (0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (~ 
                                                      (0xe3U 
                                                       ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                        | ((IData)(vlSelfRef.m4) 
                                           & (IData)(vlSelfRef.__PVT__id02)))) 
                                    | ((IData)(vlSelfRef.t2) 
                                       & (((((IData)(vlSelfRef.m1) 
                                             | ((IData)(vlSelfRef.m2) 
                                                & (~ 
                                                   (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (~ 
                                                        (0xe3U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                            | ((IData)(vlSelfRef.m3) 
                                               & (~ 
                                                  (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (~ 
                                                       (0xe3U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                           | ((IData)(vlSelfRef.m4) 
                                              & ((((IData)(vlSelfRef.__PVT__id02) 
                                                   | (0x000000ffU 
                                                      == 
                                                      (0x000000ffU 
                                                       & (0x38U 
                                                          | (~ 
                                                             (0xc7U 
                                                              ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                  | (0x000000ffU 
                                                     == 
                                                     (0x000000ffU 
                                                      & (0x38U 
                                                         | (~ 
                                                            (0xc4U 
                                                             ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                 | (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x30U 
                                                        | (~ 
                                                           (0xcdU 
                                                            ^ (IData)(vlSelfRef.__PVT__i))))))))) 
                                          | ((IData)(vlSelfRef.m5) 
                                             & (((0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0xc7U 
                                                          ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                                 | (0x000000ffU 
                                                    == 
                                                    (0x000000ffU 
                                                     & (0x38U 
                                                        | (~ 
                                                           (0xc4U 
                                                            ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                                | (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (0x30U 
                                                       | (~ 
                                                          (0xcdU 
                                                           ^ (IData)(vlSelfRef.__PVT__i))))))))))) 
                                   | ((IData)(vlSelfRef.t3) 
                                      & (((IData)(vlSelfRef.m4) 
                                          & ((0x000000ffU 
                                              == (0x000000ffU 
                                                  & (0x10U 
                                                     | (~ 
                                                        (0xc9U 
                                                         ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                             | (0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x38U 
                                                    | (~ 
                                                       (0xc0U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))))) 
                                         | ((IData)(vlSelfRef.m5) 
                                            & ((0x000000ffU 
                                                == 
                                                (0x000000ffU 
                                                 & (0x10U 
                                                    | (~ 
                                                       (0xc9U 
                                                        ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                               | (0x000000ffU 
                                                  == 
                                                  (0x000000ffU 
                                                   & (0x38U 
                                                      | (~ 
                                                         (0xc0U 
                                                          ^ (IData)(vlSelfRef.__PVT__i))))))))))) 
                                  | ((IData)(vlSelfRef.__PVT__t5) 
                                     & (0x000000ffU 
                                        == (0x000000ffU 
                                            & (~ (0xe9U 
                                                  ^ (IData)(vlSelfRef.__PVT__i)))))));
        vlSelfRef.__PVT__t3363 = ((IData)(vlSelfRef.t1) 
                                  & ((((IData)(vlSelfRef.m1) 
                                       | (IData)(vlSelfRef.m2)) 
                                      | (IData)(vlSelfRef.m3)) 
                                     | ((((IData)(vlSelfRef.m4) 
                                          | (IData)(vlSelfRef.m5)) 
                                         & (~ (0x000000ffU 
                                               == (0x000000ffU 
                                                   & (~ 
                                                      (0x76U 
                                                       ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                        & (~ (0x000000ffU 
                                              == (0x000000ffU 
                                                  & (0x30U 
                                                     | (~ 
                                                        (9U 
                                                         ^ (IData)(vlSelfRef.__PVT__i))))))))));
    }
    vlSelfRef.m3 = __Vdly__m3;
    vlSelfRef.m2 = __Vdly__m2;
    if (((IData)(vlSymsp->TOP__cpm_top.f2) & (IData)(vlSelfRef.__PVT__t4f1))) {
        vlSelfRef.__PVT__jmptake = (1U & ((IData)(vlSelfRef.__PVT__i03)
                                           ? (IData)(vlSelfRef.__PVT__jmpflag)
                                           : (~ (IData)(vlSelfRef.__PVT__jmpflag))));
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__db_stb = ((IData)(vlSelfRef.t1) 
                                   | ((~ (IData)(vlSelfRef.__PVT__sy_wo_n)) 
                                      & (IData)(vlSelfRef.t2)));
        vlSelfRef.__PVT__t2133 = ((~ (IData)(vlSelfRef.__PVT__id_rxc)) 
                                  & (IData)(vlSelfRef.__PVT__c__BRA__7__KET__));
        vlSelfRef.__PVT__psw_ld = (((IData)(vlSelfRef.t3) 
                                    & (IData)(vlSelfRef.m4)) 
                                   & (0x000000ffU == 
                                      (0x000000ffU 
                                       & (~ (0xf1U 
                                             ^ (IData)(vlSelfRef.__PVT__i))))));
        vlSelfRef.__PVT__t1780 = (((IData)(vlSelfRef.t3) 
                                   & (IData)(vlSelfRef.m1)) 
                                  | (((IData)(vlSelfRef.t1) 
                                      & ((IData)(vlSelfRef.m4) 
                                         | (IData)(vlSelfRef.m5))) 
                                     & (0x000000ffU 
                                        == (0x000000ffU 
                                            & (0x30U 
                                               | (~ 
                                                  (9U 
                                                   ^ (IData)(vlSelfRef.__PVT__i))))))));
        vlSelfRef.__PVT__t2222 = (((IData)(vlSelfRef.t2) 
                                   & (IData)(vlSelfRef.m1)) 
                                  | ((IData)(vlSelfRef.t1) 
                                     & (IData)(vlSelfRef.m5)));
        vlSelfRef.__PVT__t1497 = (((IData)(vlSelfRef.t3) 
                                   & (IData)(vlSelfRef.m5)) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (~ (0xf1U ^ (IData)(vlSelfRef.__PVT__i))))));
        vlSelfRef.__PVT__a357 = ((((((IData)(vlSelfRef.t3) 
                                     & (IData)(vlSelfRef.m5)) 
                                    & ((0x000000ffU 
                                        == (0x000000ffU 
                                            & (8U | 
                                               (~ (0xd3U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       | (0x000000ffU 
                                          == (0x000000ffU 
                                              & (~ 
                                                 (0x36U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                   | (((IData)(vlSelfRef.t3) 
                                       & (IData)(vlSelfRef.m4)) 
                                      & (((0x000000ffU 
                                           == (0x000000ffU 
                                               & (8U 
                                                  | (~ 
                                                     (0x32U 
                                                      ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                          | (0x000000ffU 
                                             == (0x000000ffU 
                                                 & (0x18U 
                                                    | (~ 
                                                       (2U 
                                                        ^ (IData)(vlSelfRef.__PVT__i))))))) 
                                         | (IData)(vlSelfRef.__PVT__id_mvmr)))) 
                                  & (IData)(vlSelfRef.__PVT__sy_wo_n)) 
                                 | (((IData)(vlSelfRef.__PVT__acc_sel) 
                                     & (IData)(vlSelfRef.__PVT__id08)) 
                                    & (((IData)(vlSelfRef.__PVT__t5) 
                                        & (IData)(vlSelfRef.m1)) 
                                       | ((IData)(vlSelfRef.t3) 
                                          & (IData)(vlSelfRef.m4)))));
        if (vlSelfRef.__VdfgRegularize_h6e95ff9d_0_32) {
            vlSelfRef.__PVT__i25 = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                          >> 2U));
            vlSelfRef.__PVT__i14 = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                          >> 1U));
            vlSelfRef.__PVT__i03 = (1U & (IData)(vlSelfRef.__PVT__i));
        } else {
            vlSelfRef.__PVT__i25 = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                          >> 5U));
            vlSelfRef.__PVT__i14 = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                          >> 4U));
            vlSelfRef.__PVT__i03 = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                          >> 3U));
        }
    }
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_21 = ((IData)(vlSelfRef.m2) 
                                                 | (IData)(vlSelfRef.m3));
    __Vtableidx1 = (((IData)(vlSelfRef.__PVT__tmp_c) 
                     << 8U) | (IData)(vlSelfRef.acc));
    vlSelfRef.__PVT__daa_6x = Vcpm_top__ConstPool__TABLE_ha98b427f_0
        [__Vtableidx1];
    vlSelfRef.m4 = __Vdly__m4;
    vlSelfRef.m5 = __Vdly__m5;
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5 = ((IData)(vlSelfRef.m4) 
                                                | (IData)(vlSelfRef.m5));
    vlSelfRef.__PVT__mxwh = ((IData)(vlSelfRef.__PVT__t2817) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    vlSelfRef.__PVT__mxwl = ((IData)(vlSelfRef.__PVT__t2819) 
                             | ((IData)(vlSelfRef.__PVT__i03) 
                                & (IData)(vlSelfRef.__PVT__t2806)));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_19 = (1U 
                                                 & ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                    & (~ (IData)(vlSelfRef.__PVT__i25))));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_39 = ((~ (IData)(vlSelfRef.__PVT__i25)) 
                                                 & (IData)(vlSelfRef.__PVT__i14));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_15 = ((~ (IData)(vlSelfRef.__PVT__i14)) 
                                                 & (IData)(vlSelfRef.__PVT__i25));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31 = ((IData)(vlSelfRef.__PVT__i14) 
                                                 & (IData)(vlSelfRef.__PVT__i25));
    vlSelfRef.__PVT__jmpflag = (((IData)(vlSelfRef.__PVT__psw_c) 
                                 & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_39)) 
                                | (((IData)(vlSelfRef.__PVT__psw_p) 
                                    & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_15)) 
                                   | (((IData)(vlSelfRef.__PVT__psw_s) 
                                       & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31)) 
                                      | ((IData)(vlSelfRef.__PVT__psw_z) 
                                         & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_19)))));
}

void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__1(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__1\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__Vdly__inta = vlSelfRef.__PVT__inta;
    if (vlSelfRef.__PVT__reset) {
        vlSelfRef.__Vdly__inta = 0U;
        vlSelfRef.__PVT__inte = 0U;
    } else {
        if (vlSymsp->TOP__cpm_top.f1) {
            if ((((IData)(vlSelfRef.__PVT__intr) & 
                  ((~ (IData)(vlSelfRef.__PVT__reset)) 
                   & ((~ (IData)(vlSelfRef.__PVT__hold)) 
                      & (IData)(vlSelfRef.__PVT__inte)))) 
                 & (((IData)(vlSelfRef.__PVT__tw) & 
                     (0x000000ffU == (0x000000ffU & 
                                      (~ (0x76U ^ (IData)(vlSelfRef.__PVT__i)))))) 
                    | ((IData)(vlSelfRef.__PVT__mstart) 
                       & (~ (0x000000ffU == (0x000000ffU 
                                             & (8U 
                                                | (~ 
                                                   (0xf3U 
                                                    ^ (IData)(vlSelfRef.__PVT__i))))))))))) {
                vlSelfRef.__Vdly__inta = 1U;
            }
            if ((1U & (((~ (IData)(vlSelfRef.__PVT__intr)) 
                        | (0x000000ffU == (0x000000ffU 
                                           & (8U | 
                                              (~ (0xf3U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))))) 
                       | ((IData)(vlSelfRef.__PVT__t5) 
                          & (0x000000ffU == (0x000000ffU 
                                             & (0x38U 
                                                | (~ 
                                                   (0xc7U 
                                                    ^ (IData)(vlSelfRef.__PVT__i)))))))))) {
                vlSelfRef.__Vdly__inta = 0U;
            }
        }
        if (vlSymsp->TOP__cpm_top.f2) {
            if (((IData)(vlSelfRef.__PVT__t1f1) & (0x000000ffU 
                                                   == 
                                                   (0x000000ffU 
                                                    & (8U 
                                                       | (~ 
                                                          (0xf3U 
                                                           ^ (IData)(vlSelfRef.__PVT__i)))))))) {
                vlSelfRef.__PVT__inte = (1U & ((IData)(vlSelfRef.__PVT__i) 
                                               >> 3U));
            }
            if (((IData)(vlSelfRef.__PVT__t1f1) & (IData)(vlSelfRef.__PVT__inta))) {
                vlSelfRef.__PVT__inte = 0U;
            }
        }
    }
}

void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__2(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__2\n"); );
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
    if (vlSelfRef.__PVT__reset) {
        vlSelfRef.__PVT__hold = 0U;
    } else if (vlSymsp->TOP__cpm_top.f2) {
        if (vlSelfRef.__PVT__t382) {
            if (((~ (IData)(vlSelfRef.__PVT__inta)) 
                 & (IData)(vlSelfRef.__PVT__h889))) {
                vlSelfRef.__PVT__hold = 1U;
            }
        } else {
            vlSelfRef.__PVT__hold = 0U;
        }
    }
    if (((~ (IData)(vlSymsp->TOP__cpm_top.f2)) & ((IData)(vlSelfRef.__PVT__reset) 
                                                  | ((IData)(vlSelfRef.m1) 
                                                     & (IData)(vlSelfRef.t3))))) {
        vlSelfRef.__PVT__i = vlSymsp->TOP__cpm_top.__PVT__cpu_din;
    }
    vlSelfRef.m1 = vlSelfRef.__Vdly__m1;
    if ((1U & (~ (IData)(vlSymsp->TOP__cpm_top.f2)))) {
        vlSelfRef.__PVT__t382 = 0U;
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.__PVT__intr = 0U;
        vlSelfRef.__PVT__mstart = (1U & ((~ (IData)(vlSelfRef.__PVT__ms0)) 
                                         & (~ (IData)(vlSelfRef.__PVT__ms1))));
        vlSelfRef.__PVT__t5 = ((((~ (IData)(vlSelfRef.__PVT__start)) 
                                 & (IData)(vlSelfRef.__PVT__t4f1)) 
                                & (IData)(vlSelfRef.__PVT__ms0)) 
                               & (~ (IData)(vlSelfRef.__PVT__ms1)));
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t4f1 = vlSelfRef.t4;
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.t4 = ((((~ (IData)(vlSelfRef.__PVT__start)) 
                          & (IData)(vlSelfRef.__PVT__t3f1)) 
                         & (IData)(vlSelfRef.__PVT__ms0)) 
                        & (~ (IData)(vlSelfRef.__PVT__ms1)));
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t3f1 = vlSelfRef.t3;
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.__PVT__tw = (((~ (IData)(vlSelfRef.__PVT__start)) 
                                & ((IData)(vlSelfRef.__PVT__t2f1) 
                                   | (IData)(vlSelfRef.__PVT__twf1))) 
                               & (IData)(vlSelfRef.__PVT__thalt));
        vlSelfRef.t3 = (((~ (IData)(vlSelfRef.__PVT__start)) 
                         & ((IData)(vlSelfRef.__PVT__t2f1) 
                            | (IData)(vlSelfRef.__PVT__twf1))) 
                        & (~ (IData)(vlSelfRef.__PVT__thalt)));
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t2f1 = vlSelfRef.t2;
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.t2 = ((~ (IData)(vlSelfRef.__PVT__start)) 
                        & (IData)(vlSelfRef.__PVT__t1f1));
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t1f1 = ((IData)(vlSelfRef.t1) 
                                 & (~ (IData)(vlSelfRef.__PVT__reset)));
    }
    if (vlSymsp->TOP__cpm_top.f2) {
        vlSelfRef.t1 = vlSelfRef.__PVT__start;
        vlSelfRef.__PVT__reset = vlSelfRef.__PVT__t404;
    }
    if (vlSymsp->TOP__cpm_top.f1) {
        vlSelfRef.__PVT__t404 = vlSymsp->TOP.reset;
    }
    vlSelfRef.__PVT__id_stc = (IData)(((0x30U == (0x38U 
                                                  & (IData)(vlSelfRef.__PVT__i))) 
                                       & (0x000000ffU 
                                          == (0x000000ffU 
                                              & (0x38U 
                                                 | (~ 
                                                    (7U 
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
    vlSelfRef.__PVT__sy_inp = ((IData)(vlSelfRef.m5) 
                               & (0x000000ffU == (0x000000ffU 
                                                  & (~ 
                                                     (0xdbU 
                                                      ^ (IData)(vlSelfRef.__PVT__i))))));
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
    vlSelfRef.__PVT__ready_int = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_5) 
                                  & (0x000000ffU == 
                                     (0x000000ffU & 
                                      (0x30U | (~ (9U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))));
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
    vlSelfRef.__PVT__id_rxc = (((IData)(vlSelfRef.__PVT__i) 
                                >> 3U) & (IData)(vlSelfRef.__PVT__id_sha));
    vlSelfRef.__PVT__id00 = ((0x000000ffU == (0x000000ffU 
                                              & (~ 
                                                 (0xe3U 
                                                  ^ (IData)(vlSelfRef.__PVT__i))))) 
                             | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_27));
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
    vlSelfRef.__PVT__daa = ((IData)(vlSelfRef.__PVT__t4f1) 
                            & (IData)(vlSelfRef.__PVT__id_daa));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6 = ((IData)(vlSelfRef.__PVT__t4f1) 
                                                | (IData)(vlSelfRef.__PVT__t5f1));
    __VdfgRegularize_h6e95ff9d_0_7 = ((IData)(vlSelfRef.__PVT__t4f1) 
                                      & (IData)(vlSelfRef.__PVT__id08));
    __VdfgRegularize_h6e95ff9d_0_40 = ((~ (0x000000ffU 
                                           == (0x000000ffU 
                                               & (~ 
                                                  (0xe3U 
                                                   ^ (IData)(vlSelfRef.__PVT__i)))))) 
                                       & (IData)(vlSelfRef.__PVT__t4f1));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_20 = (1U 
                                                 & (~ 
                                                    ((IData)(vlSelfRef.__PVT__m1f1) 
                                                     & (IData)(vlSelfRef.__PVT__id82))));
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
    __PVT__iad16 = (1U & ((~ ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_6) 
                              & (IData)(vlSelfRef.__PVT__id00))) 
                          & ((IData)(vlSelfRef.m5) 
                             | ((~ (IData)(vlSelfRef.__PVT__minta)) 
                                | (IData)(vlSelfRef.__PVT__t3144)))));
    vlSelfRef.__PVT__mxrl = ((IData)(vlSelfRef.__PVT__t3047) 
                             | ((IData)(vlSelfRef.__PVT__i03) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    vlSelfRef.__PVT__mxrh = ((IData)(vlSelfRef.__PVT__t2998) 
                             | ((~ (IData)(vlSelfRef.__PVT__i03)) 
                                & (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    __PVT__t1519 = ((IData)(vlSelfRef.__PVT__tree2) 
                    | ((IData)(vlSelfRef.__PVT__id00) 
                       & (IData)(__VdfgRegularize_h6e95ff9d_0_40)));
    __PVT__t1467 = ((IData)(vlSelfRef.__PVT__tree1) 
                    | ((IData)(vlSelfRef.__PVT__id03) 
                       & (IData)(__VdfgRegularize_h6e95ff9d_0_40)));
    __VdfgRegularize_h6e95ff9d_0_4 = ((IData)(__PVT__t1513) 
                                      | ((IData)(vlSelfRef.__PVT__t3361) 
                                         | (IData)(__VdfgRegularize_h6e95ff9d_0_7)));
    __VdfgRegularize_h6e95ff9d_0_2 = ((IData)(vlSelfRef.__PVT__r) 
                                      & (IData)(vlSelfRef.__PVT__x));
    __VdfgRegularize_h6e95ff9d_0_1 = ((IData)(vlSelfRef.__PVT__r) 
                                      | (IData)(vlSelfRef.__PVT__x));
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
    vlSelfRef.__PVT__mxr4 = (((IData)(__PVT__t1513) 
                              & (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_31)) 
                             | (IData)(__PVT__t1467));
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
    vlSelfRef.__PVT__mxi = (0x0000ffffU & (((~ (IData)(__PVT__dec16)) 
                                            & (IData)(__PVT__iad16))
                                            ? ((IData)(1U) 
                                               + (IData)(vlSelfRef.__PVT__a))
                                            : ((IData)(vlSelfRef.__PVT__a) 
                                               - (IData)(__PVT__dec16))));
    vlSelfRef.__PVT__acc_sel = ((IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_32)
                                 ? (7U == (7U & (IData)(vlSelfRef.__PVT__i)))
                                 : (7U == (7U & ((IData)(vlSelfRef.__PVT__i) 
                                                 >> 3U))));
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
    vlSelfRef.__PVT__thalt = ((~ (IData)(vlSelfRef.m1)) 
                              & (0x000000ffU == (0x000000ffU 
                                                 & (~ 
                                                    (0x76U 
                                                     ^ (IData)(vlSelfRef.__PVT__i))))));
    vlSelfRef.__PVT__twf1 = vlSelfRef.__Vdly__twf1;
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
    vlSelfRef.__PVT__h889 = ((IData)(vlSelfRef.__PVT__t2f1) 
                             | (IData)(vlSelfRef.__PVT__twf1));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_11 = ((IData)(vlSelfRef.__PVT__t1f1) 
                                                 & (IData)(vlSelfRef.__PVT__sy_wo_n));
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
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_34 = ((IData)(vlSelfRef.__PVT__reset) 
                                                 | (((~ (IData)(vlSelfRef.__PVT__t1f1)) 
                                                     & (IData)(vlSelfRef.__PVT__sy_stack)) 
                                                    | (IData)(vlSelfRef.__VdfgRegularize_h6e95ff9d_0_33)));
    vlSelfRef.__VdfgRegularize_h6e95ff9d_0_3 = (1U 
                                                & (~ 
                                                   ((IData)(vlSelfRef.__PVT__reset) 
                                                    | ((IData)(vlSelfRef.__PVT__m1f1) 
                                                       & (IData)(vlSelfRef.__PVT__t3f1)))));
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
}

void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__3(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__3\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
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
}

void Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__4(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_sequent__TOP__cpm_top__cpu__4\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__PVT__inta = vlSelfRef.__Vdly__inta;
}

void Vcpm_top_vm80a_core___nba_comb__TOP__cpm_top__cpu__0(Vcpm_top_vm80a_core* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+          Vcpm_top_vm80a_core___nba_comb__TOP__cpm_top__cpu__0\n"); );
    Vcpm_top__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
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
