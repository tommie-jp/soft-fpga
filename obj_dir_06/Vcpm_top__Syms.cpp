// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Symbol table implementation internals

#include "Vcpm_top__pch.h"
#include "Vcpm_top.h"
#include "Vcpm_top___024root.h"
#include "Vcpm_top_cpm_top.h"
#include "Vcpm_top_vm80a_core.h"

// FUNCTIONS
Vcpm_top__Syms::~Vcpm_top__Syms()
{
}

Vcpm_top__Syms::Vcpm_top__Syms(VerilatedContext* contextp, const char* namep, Vcpm_top* modelp)
    : VerilatedSyms{contextp}
    // Setup internal state of the Syms class
    , __Vm_modelp{modelp}
    // Setup module instances
    , TOP{this, namep}
    , TOP__cpm_top{this, Verilated::catName(namep, "cpm_top")}
    , TOP__cpm_top__cpu{this, Verilated::catName(namep, "cpm_top.cpu")}
{
    // Check resources
    Verilated::stackCheck(686);
    // Configure time unit / time precision
    _vm_contextp__->timeunit(-12);
    _vm_contextp__->timeprecision(-12);
    // Setup each module's pointers to their submodules
    TOP.cpm_top = &TOP__cpm_top;
    TOP__cpm_top.cpu = &TOP__cpm_top__cpu;
    // Setup each module's pointer back to symbol table (for public functions)
    TOP.__Vconfigure(true);
    TOP__cpm_top.__Vconfigure(true);
    TOP__cpm_top__cpu.__Vconfigure(true);
    // Setup scopes
    __Vscope_cpm_top.configure(this, name(), "cpm_top", "cpm_top", "<null>", 0, VerilatedScope::SCOPE_OTHER);
    __Vscope_cpm_top__cpu.configure(this, name(), "cpm_top.cpu", "cpu", "<null>", 0, VerilatedScope::SCOPE_OTHER);
    // Setup export functions
    for (int __Vfinal = 0; __Vfinal < 2; ++__Vfinal) {
        __Vscope_cpm_top.varInsert(__Vfinal,"f1", &(TOP__cpm_top.f1), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top.varInsert(__Vfinal,"f2", &(TOP__cpm_top.f2), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top.varInsert(__Vfinal,"ram", &(TOP__cpm_top.ram), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,1,1 ,0,65535 ,7,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"acc", &(TOP__cpm_top__cpu.acc), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,1 ,7,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"eom", &(TOP__cpm_top__cpu.eom), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"m1", &(TOP__cpm_top__cpu.m1), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"m2", &(TOP__cpm_top__cpu.m2), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"m3", &(TOP__cpm_top__cpu.m3), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"m4", &(TOP__cpm_top__cpu.m4), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"m5", &(TOP__cpm_top__cpu.m5), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"t1", &(TOP__cpm_top__cpu.t1), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"t2", &(TOP__cpm_top__cpu.t2), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"t3", &(TOP__cpm_top__cpu.t3), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
        __Vscope_cpm_top__cpu.varInsert(__Vfinal,"t4", &(TOP__cpm_top__cpu.t4), false, VLVT_UINT8,VLVD_NODIR|VLVF_PUB_RW,0,0);
    }
}
