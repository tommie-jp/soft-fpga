module uart_rx #(
    parameter CLKS_PER_BIT = 16
) (
    input            clk,
    input            rst,
    input            rxd,
    output reg [7:0] rx_data,
    output reg       rx_valid,
    output reg       rx_error,
    output     [1:0] o_rx_state,
    output     [2:0] o_rx_bit
);
    localparam S_IDLE  = 2'd0;
    localparam S_START = 2'd1;
    localparam S_DATA  = 2'd2;
    localparam S_STOP  = 2'd3;

    localparam [15:0] FULL_CNT = CLKS_PER_BIT - 1;
    localparam [15:0] HALF_CNT = CLKS_PER_BIT / 2 - 1;

    reg [1:0]  state;
    reg [2:0]  bit_idx;
    reg [15:0] clk_cnt;
    reg [7:0]  data_buf;
    reg        rxd_r;

    assign o_rx_state = state;
    assign o_rx_bit   = bit_idx;

    always @(posedge clk) begin
        if (rst) begin
            state    <= S_IDLE;
            bit_idx  <= 3'd0;
            clk_cnt  <= 16'd0;
            data_buf <= 8'd0;
            rx_data  <= 8'd0;
            rx_valid <= 1'b0;
            rx_error <= 1'b0;
            rxd_r    <= 1'b1;
        end else begin
            rx_valid <= 1'b0;
            rxd_r    <= rxd;

            case (state)
                S_IDLE: begin
                    rx_error <= 1'b0;
                    if (rxd_r == 1'b1 && rxd == 1'b0) begin
                        clk_cnt <= HALF_CNT;
                        state   <= S_START;
                    end
                end
                S_START: begin
                    if (clk_cnt == 16'd0) begin
                        if (rxd == 1'b0) begin
                            clk_cnt <= FULL_CNT;
                            bit_idx <= 3'd0;
                            state   <= S_DATA;
                        end else begin
                            state <= S_IDLE;
                        end
                    end else begin
                        clk_cnt <= clk_cnt - 16'd1;
                    end
                end
                S_DATA: begin
                    if (clk_cnt == 16'd0) begin
                        data_buf[bit_idx] <= rxd;
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
                    if (clk_cnt == 16'd0) begin
                        if (rxd == 1'b1) begin
                            rx_data  <= data_buf;
                            rx_valid <= 1'b1;
                        end else begin
                            rx_error <= 1'b1;
                        end
                        state   <= S_IDLE;
                        bit_idx <= 3'd0;
                    end else begin
                        clk_cnt <= clk_cnt - 16'd1;
                    end
                end
                default: state <= S_IDLE;
            endcase
        end
    end
endmodule
