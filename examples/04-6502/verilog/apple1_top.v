module apple1_top (
    input         clk,
    input         reset,
    output [15:0] o_ab,
    input  [7:0]  i_di,
    output [7:0]  o_do,
    output        o_we,
    output        o_sync,
    input         i_irq,
    input         i_nmi,
    input         i_rdy,
    // observation outputs
    output [7:0]  o_a,
    output [7:0]  o_x,
    output [7:0]  o_y,
    output [7:0]  o_sp,
    output [15:0] o_pc,
    output [7:0]  o_p,
    output [5:0]  o_state
);
    cpu_65c02 u_cpu (
        .clk    (clk),
        .reset  (reset),
        .AB     (o_ab),
        .DI     (i_di),
        .DO     (o_do),
        .WE     (o_we),
        .SYNC   (o_sync),
        .IRQ    (i_irq),
        .NMI    (i_nmi),
        .RDY    (i_rdy),
        .o_a    (o_a),
        .o_x    (o_x),
        .o_y    (o_y),
        .o_sp   (o_sp),
        .o_pc   (o_pc),
        .o_p    (o_p),
        .o_state(o_state)
    );
endmodule
