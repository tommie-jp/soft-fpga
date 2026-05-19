// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Symbol table internal header
//
// Internal details; most calling programs do not need this header,
// unless using verilator public meta comments.

#ifndef VERILATED_VCPM_TOP__SYMS_H_
#define VERILATED_VCPM_TOP__SYMS_H_  // guard

#include "verilated.h"

// INCLUDE MODEL CLASS

#include "Vcpm_top.h"

// INCLUDE MODULE CLASSES
#include "Vcpm_top___024root.h"
#include "Vcpm_top_cpm_top.h"
#include "Vcpm_top_vm80a_core.h"

// DPI TYPES for DPI Export callbacks (Internal use)

// SYMS CLASS (contains all model state)
class alignas(VL_CACHE_LINE_BYTES) Vcpm_top__Syms final : public VerilatedSyms {
  public:
    // INTERNAL STATE
    Vcpm_top* const __Vm_modelp;
    VlDeleter __Vm_deleter;
    bool __Vm_didInit = false;

    // MODULE INSTANCE STATE
    Vcpm_top___024root             TOP;
    Vcpm_top_cpm_top               TOP__cpm_top;
    Vcpm_top_vm80a_core            TOP__cpm_top__cpu;

    // SCOPE NAMES
    VerilatedScope* __Vscopep_cpm_top;
    VerilatedScope* __Vscopep_cpm_top__cpu;

    // CONSTRUCTORS
    Vcpm_top__Syms(VerilatedContext* contextp, const char* namep, Vcpm_top* modelp);
    ~Vcpm_top__Syms();

    // METHODS
    const char* name() const { return TOP.vlNamep; }
};

#endif  // guard
