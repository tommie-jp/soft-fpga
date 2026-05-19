// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Symbol table implementation internals

#include "Vcpm_top__pch.h"

Vcpm_top__Syms::Vcpm_top__Syms(VerilatedContext* contextp, const char* namep, Vcpm_top* modelp)
    : VerilatedSyms{contextp}
    // Setup internal state of the Syms class
    , __Vm_modelp{modelp}
    // Setup top module instance
    , TOP{this, namep}
{
    // Check resources
    Verilated::stackCheck(366);
    // Setup sub module instances
    TOP__cpm_top.ctor(this, "cpm_top");
    TOP__cpm_top__cpu.ctor(this, "cpm_top.cpu");
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
    __Vscopep_cpm_top = new VerilatedScope{this, "cpm_top", "cpm_top", "<null>", 0, VerilatedScope::SCOPE_OTHER};
    __Vscopep_cpm_top__cpu = new VerilatedScope{this, "cpm_top.cpu", "cpu", "<null>", 0, VerilatedScope::SCOPE_OTHER};
    // Setup export functions - final: 0
    // Setup export functions - final: 1
    // Setup public variables
    __Vscopep_cpm_top->varInsert("f1", &(TOP__cpm_top.f1), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top->varInsert("f2", &(TOP__cpm_top.f2), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top->varInsert("ram", &(TOP__cpm_top.ram), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 1, 1 ,0,65535 ,7,0);
    __Vscopep_cpm_top__cpu->varInsert("acc", &(TOP__cpm_top__cpu.acc), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 1 ,7,0);
    __Vscopep_cpm_top__cpu->varInsert("eom", &(TOP__cpm_top__cpu.eom), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("m1", &(TOP__cpm_top__cpu.m1), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("m2", &(TOP__cpm_top__cpu.m2), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("m3", &(TOP__cpm_top__cpu.m3), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("m4", &(TOP__cpm_top__cpu.m4), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("m5", &(TOP__cpm_top__cpu.m5), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("t1", &(TOP__cpm_top__cpu.t1), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("t2", &(TOP__cpm_top__cpu.t2), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("t3", &(TOP__cpm_top__cpu.t3), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
    __Vscopep_cpm_top__cpu->varInsert("t4", &(TOP__cpm_top__cpu.t4), false, VLVT_UINT8, VLVD_NODIR|VLVF_PUB_RW, 0, 0);
}

Vcpm_top__Syms::~Vcpm_top__Syms() {
    // Tear down scopes
    VL_DO_CLEAR(delete __Vscopep_cpm_top, __Vscopep_cpm_top = nullptr);
    VL_DO_CLEAR(delete __Vscopep_cpm_top__cpu, __Vscopep_cpm_top__cpu = nullptr);
    // Tear down sub module instances
    TOP__cpm_top__cpu.dtor();
    TOP__cpm_top.dtor();
}
