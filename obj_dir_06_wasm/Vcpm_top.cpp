// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Model implementation (design independent parts)

#include "Vcpm_top__pch.h"

//============================================================
// Constructors

Vcpm_top::Vcpm_top(VerilatedContext* _vcontextp__, const char* _vcname__)
    : VerilatedModel{*_vcontextp__}
    , vlSymsp{new Vcpm_top__Syms(contextp(), _vcname__, this)}
    , clk{vlSymsp->TOP.clk}
    , reset{vlSymsp->TOP.reset}
    , io_req{vlSymsp->TOP.io_req}
    , io_wr{vlSymsp->TOP.io_wr}
    , io_addr{vlSymsp->TOP.io_addr}
    , io_dout{vlSymsp->TOP.io_dout}
    , io_din{vlSymsp->TOP.io_din}
    , io_dbin{vlSymsp->TOP.io_dbin}
    , io_active{vlSymsp->TOP.io_active}
    , io_port{vlSymsp->TOP.io_port}
    , dbg_a{vlSymsp->TOP.dbg_a}
    , dbg_f{vlSymsp->TOP.dbg_f}
    , dbg_pc{vlSymsp->TOP.dbg_pc}
    , cpm_top{vlSymsp->TOP.cpm_top}
    , rootp{&(vlSymsp->TOP)}
{
    // Register model with the context
    contextp()->addModel(this);
}

Vcpm_top::Vcpm_top(const char* _vcname__)
    : Vcpm_top(Verilated::threadContextp(), _vcname__)
{
}

//============================================================
// Destructor

Vcpm_top::~Vcpm_top() {
    delete vlSymsp;
}

//============================================================
// Evaluation function

#ifdef VL_DEBUG
void Vcpm_top___024root___eval_debug_assertions(Vcpm_top___024root* vlSelf);
#endif  // VL_DEBUG
void Vcpm_top___024root___eval_static(Vcpm_top___024root* vlSelf);
void Vcpm_top___024root___eval_initial(Vcpm_top___024root* vlSelf);
void Vcpm_top___024root___eval_settle(Vcpm_top___024root* vlSelf);
void Vcpm_top___024root___eval(Vcpm_top___024root* vlSelf);

void Vcpm_top::eval_step() {
    VL_DEBUG_IF(VL_DBG_MSGF("+++++TOP Evaluate Vcpm_top::eval_step\n"); );
#ifdef VL_DEBUG
    // Debug assertions
    Vcpm_top___024root___eval_debug_assertions(&(vlSymsp->TOP));
#endif  // VL_DEBUG
    vlSymsp->__Vm_deleter.deleteAll();
    if (VL_UNLIKELY(!vlSymsp->__Vm_didInit)) {
        VL_DEBUG_IF(VL_DBG_MSGF("+ Initial\n"););
        Vcpm_top___024root___eval_static(&(vlSymsp->TOP));
        Vcpm_top___024root___eval_initial(&(vlSymsp->TOP));
        Vcpm_top___024root___eval_settle(&(vlSymsp->TOP));
        vlSymsp->__Vm_didInit = true;
    }
    VL_DEBUG_IF(VL_DBG_MSGF("+ Eval\n"););
    Vcpm_top___024root___eval(&(vlSymsp->TOP));
    // Evaluate cleanup
    Verilated::endOfEval(vlSymsp->__Vm_evalMsgQp);
}

//============================================================
// Events and timing
bool Vcpm_top::eventsPending() { return false; }

uint64_t Vcpm_top::nextTimeSlot() {
    VL_FATAL_MT(__FILE__, __LINE__, "", "No delays in the design");
    return 0;
}

//============================================================
// Utilities

const char* Vcpm_top::name() const {
    return vlSymsp->name();
}

//============================================================
// Invoke final blocks

void Vcpm_top___024root___eval_final(Vcpm_top___024root* vlSelf);

VL_ATTR_COLD void Vcpm_top::final() {
    contextp()->executingFinal(true);
    Vcpm_top___024root___eval_final(&(vlSymsp->TOP));
    contextp()->executingFinal(false);
}

//============================================================
// Implementations of abstract methods from VerilatedModel

const char* Vcpm_top::hierName() const { return vlSymsp->name(); }
const char* Vcpm_top::modelName() const { return "Vcpm_top"; }
unsigned Vcpm_top::threads() const { return 1; }
void Vcpm_top::prepareClone() const { contextp()->prepareClone(); }
void Vcpm_top::atClone() const {
    contextp()->threadPoolpOnClone();
}
