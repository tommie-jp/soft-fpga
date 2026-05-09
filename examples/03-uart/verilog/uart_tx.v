module uart_tx #(
    parameter CLKS_PER_BIT = 16
) (
    input            clk,
    input            rst,
    input      [7:0] tx_data,
    input            tx_valid,
    output reg       txd,
    output           tx_ready,
    output     [1:0] o_tx_state,
    output     [2:0] o_tx_bit,
    output     [7:0] o_tx_data
);
    localparam S_IDLE  = 2'd0;
    localparam S_START = 2'd1;
    localparam S_DATA  = 2'd2;
    localparam S_STOP  = 2'd3;

    localparam [15:0] FULL_CNT = CLKS_PER_BIT - 1;

    reg [1:0]  state;
    reg [2:0]  bit_idx;
    reg [15:0] clk_cnt;
    reg [7:0]  data_buf;

    assign tx_ready   = (state == S_IDLE);
    assign o_tx_state = state;
    assign o_tx_bit   = bit_idx;
    assign o_tx_data  = data_buf;

    always @(posedge clk) begin
        if (rst) begin
            state    <= S_IDLE;
            txd      <= 1'b1;
            bit_idx  <= 3'd0;
            clk_cnt  <= 16'd0;
            data_buf <= 8'd0;
        end else begin
            case (state)
                S_IDLE: begin
                    txd <= 1'b1;
                    if (tx_valid) begin
                        data_buf <= tx_data;
                        clk_cnt  <= FULL_CNT;
                        state    <= S_START;
                    end
                end
                S_START: begin
                    txd <= 1'b0;
                    if (clk_cnt == 16'd0) begin
                        clk_cnt <= FULL_CNT;
                        bit_idx <= 3'd0;
                        state   <= S_DATA;
                    end else begin
                        clk_cnt <= clk_cnt - 16'd1;
                    end
                end
                S_DATA: begin
                    txd <= data_buf[bit_idx];
                    if (clk_cnt == 16'd0) begin
                        clk_cnt <= FULL_CNT;
                        if (bit_idx == 3'd7) begin
                            state <= S_STOP;
                        end else begin
                            bit_idx <= bit_idx + 3'd1;
                        end
                    end else begin
                        clk_cnt <= clk_cnt - 16'd1;
                    end
                end
                S_STOP: begin
                    txd <= 1'b1;
                    if (clk_cnt == 16'd0) begin
                        state   <= S_IDLE;
                        bit_idx <= 3'd0;
                    end else begin
                        clk_cnt <= clk_cnt - 16'd1;
                    end
                end
                default: begin
                    state <= S_IDLE;
                    txd   <= 1'b1;
                end
            endcase
        end
    end
endmodule
