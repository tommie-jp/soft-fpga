// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

void Vcpm_top_vm80a_core___ctor_var_reset(Vcpm_top_vm80a_core* vlSelf);

Vcpm_top_vm80a_core::Vcpm_top_vm80a_core(Vcpm_top__Syms* symsp, const char* v__name)
    : VerilatedModule{v__name}
    , vlSymsp{symsp}
 {
    // Reset structure values
    Vcpm_top_vm80a_core___ctor_var_reset(this);
}

void Vcpm_top_vm80a_core::__Vconfigure(bool first) {
    (void)first;  // Prevent unused variable warning
}

Vcpm_top_vm80a_core::~Vcpm_top_vm80a_core() {
}
