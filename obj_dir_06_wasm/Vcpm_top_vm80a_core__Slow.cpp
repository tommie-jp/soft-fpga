// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

void Vcpm_top_vm80a_core___ctor_var_reset(Vcpm_top_vm80a_core* vlSelf);

Vcpm_top_vm80a_core::Vcpm_top_vm80a_core() = default;
Vcpm_top_vm80a_core::~Vcpm_top_vm80a_core() = default;

void Vcpm_top_vm80a_core::ctor(Vcpm_top__Syms* symsp, const char* namep) {
    vlSymsp = symsp;
    vlNamep = strdup(Verilated::catName(vlSymsp->name(), namep));
    // Reset structure values
    Vcpm_top_vm80a_core___ctor_var_reset(this);
}

void Vcpm_top_vm80a_core::__Vconfigure(bool first) {
    (void)first;  // Prevent unused variable warning
}

void Vcpm_top_vm80a_core::dtor() {
    VL_DO_DANGLING(std::free(const_cast<char*>(vlNamep)), vlNamep);
}
