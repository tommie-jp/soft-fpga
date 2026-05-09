module uart_top #(
    parameter CLKS_PER_BIT = 16
) (
    input        clk,
    input        rst,
    input  [7:0] tx_data,
    input        tx_valid,
    output       tx_ready,
    output [7:0] o_rx_data,
    output       o_rx_valid,
    output       o_rx_error,
    output [1:0] o_tx_state,
    output [1:0] o_rx_state,
    output [2:0] o_tx_bit,
    output [2:0] o_rx_bit,
    output [7:0] o_tx_data,
    output       o_txd,
    output       o_rxd
);
    wire txd;
    assign o_txd = txd;
    assign o_rxd = txd;  // ループバック

    uart_tx #(.CLKS_PER_BIT(CLKS_PER_BIT)) u_tx (
        .clk      (clk),
        .rst      (rst),
        .tx_data  (tx_data),
        .tx_valid (tx_valid),
        .txd      (txd),
        .tx_ready (tx_ready),
        .o_tx_state(o_tx_state),
        .o_tx_bit  (o_tx_bit),
        .o_tx_data (o_tx_data)
    );

    uart_rx #(.CLKS_PER_BIT(CLKS_PER_BIT)) u_rx (
        .clk      (clk),
        .rst      (rst),
        .rxd      (txd),
        .rx_data  (o_rx_data),
        .rx_valid (o_rx_valid),
        .rx_error (o_rx_error),
        .o_rx_state(o_rx_state),
        .o_rx_bit  (o_rx_bit)
    );
endmodule
