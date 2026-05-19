// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vcpm_top.h for the primary calling header

#include "Vcpm_top__pch.h"

void Vcpm_top___024root___ctor_var_reset(Vcpm_top___024root* vlSelf);

Vcpm_top___024root::Vcpm_top___024root(Vcpm_top__Syms* symsp, const char* namep)
 {
    vlSymsp = symsp;
    vlNamep = strdup(namep);
    // Reset structure values
    Vcpm_top___024root___ctor_var_reset(this);
}

void Vcpm_top___024root::__Vconfigure(bool first) {
    (void)first;  // Prevent unused variable warning
}

Vcpm_top___024root::~Vcpm_top___024root() {
    VL_DO_DANGLING(std::free(const_cast<char*>(vlNamep)), vlNamep);
}
