// test_top_wasm_diag.v — sdiag ROM テスト用トップレベル
//
// test_top_wasm.v と同一だが bootrom.v の代わりに bootrom_diag.v を使用する。
// これにより boot_diag モード（RAM テスト＋ UART 出力確認 ROM）が有効になる。
//
// ビルド: build-host-09.sh (pdp11_sdiag_sim ターゲット)

`define sim_time    1
`define fake_uart   1

`include "pdp11.v"
`include "ipl_below.v"
`include "add8.v"

`include "mmu.v"
`include "null_mmu.v"

`include "execute.v"
`include "mul1616.v"
`include "div3216.v"
`include "shift32.v"

`include "mmu_regs.v"
`include "clk_regs.v"
`include "sr_regs.v"
`include "psw_regs.v"

`include "rk_regs.v"
`include "ide.v"

`include "tt_regs.v"
`include "brg.v"

`include "wasm_uart.v"

`include "bus.v"
`include "bootrom_diag.v"   // boot_diag モード bootrom
`include "iopage.v"
`include "reset_btn.v"
`include "ram_async.v"

`include "sevensegdecode.v"
`include "display.v"
`include "top.v"

// wrap_ide / wrap_s3board_ram は test_top_wasm.v と同一

module wrap_ide(clk, ide_data_in, ide_data_out, ide_dior, ide_diow, ide_cs, ide_da);

   input clk;
   input [15:0] ide_data_in;
   output [15:0] ide_data_out;
   input 	 ide_dior;
   input 	 ide_diow;
   input [1:0] 	 ide_cs;
   input [2:0] 	 ide_da;

   import "DPI-C" function void dpi_ide(input integer data_in,
					output integer data_out,
				        input integer dior,
				        input integer diow,
				        input integer cs,
				        input integer da);

   integer dbi, dbo;
   wire [31:0] dboo;

   assign dbi  = {16'b0, ide_data_in};
   assign dboo = dbo;
   assign ide_data_out = dboo[15:0];

   always @(posedge clk)
     begin
	dpi_ide(dbi,
		dbo,
		{31'b0, ide_dior},
		{31'b0, ide_diow},
		{30'b0, ide_cs},
		{29'b0, ide_da});
     end

endmodule


module wrap_s3board_ram(clk,
			ram_a, ram_oe_n, ram_we_n,
			ram1_in, ram1_out, ram1_ce_n, ram1_ub_n, ram1_lb_n,
			ram2_in, ram2_out, ram2_ce_n, ram2_ub_n, ram2_lb_n);

   input clk;
   input [17:0] ram_a;
   input 	ram_oe_n, ram_we_n;
   input [15:0]  ram1_in;
   output [15:0] ram1_out;
   input 	 ram1_ce_n, ram1_ub_n, ram1_lb_n;
   input [15:0]  ram2_in;
   output [15:0] ram2_out;
   input 	 ram2_ce_n, ram2_ub_n, ram2_lb_n;

   wire [31:0] din;
   reg  [31:0] dout;

   wire [31:0] addr;
   wire rd, wr, ub, lb;

   assign addr = {14'b0, ram_a};
   assign din  = {16'b0, ram1_in};
   assign ram1_out = dout[15:0];
   assign ram2_out = 0;
   assign rd = ~ram_oe_n;
   assign wr = ~ram_we_n;
   assign ub = ~ram1_ub_n;
   assign lb = ~ram1_lb_n;

   import "DPI-C" function void dpi_ram(input integer a,
					input integer r,
					input integer w,
					input integer u,
					input integer l,
					input integer in,
					output integer out);

   always @(posedge clk or negedge clk)
     begin
	dpi_ram(addr,
		{31'b0, rd},
		{31'b0, wr},
		{31'b0, ub},
		{31'b0, lb},
		din,
		dout);
     end

endmodule


// ── test_top_wasm (diag variant) ───────────────────────────────────────────

module test_top_wasm;

   wire rs232_txd;
   reg  rs232_rxd;

   reg [3:0] button    /* verilator public_flat_rw */;
   wire [7:0] led;
   reg        sysclk   /* verilator public_flat_rw */;

   wire [7:0] sevenseg;
   wire [3:0] sevenseg_an;
   reg  [7:0] slideswitch;

   wire [17:0] ram_a;
   wire        ram_oe_n;
   wire        ram_we_n;

   wire [15:0] ram1_io;
   wire 	ram1_ce_n;
   wire 	ram1_ub_n;
   wire 	ram1_lb_n;

   wire [15:0] ram2_io;
   wire 	ram2_ce_n;
   wire 	ram2_ub_n;
   wire 	ram2_lb_n;

   wire [15:0] ide_data_bus;
   wire        ide_dior;
   wire        ide_diow;
   wire [1:0]  ide_cs;
   wire [2:0]  ide_da;

   initial begin
      button      = 0;
      slideswitch = 8'b0;
      sysclk      = 0;
      rs232_rxd   = 1;
   end

   top top(.rs232_txd(rs232_txd),
	   .rs232_rxd(rs232_rxd),
	   .button(button),
	   .led(led),
	   .sysclk(sysclk),
	   .sevenseg(sevenseg),
	   .sevenseg_an(sevenseg_an),
	   .slideswitch(slideswitch),
	   .ram_a(ram_a),
	   .ram_oe_n(ram_oe_n),
	   .ram_we_n(ram_we_n),
	   .ram1_io(ram1_io),
	   .ram1_ce_n(ram1_ce_n),
	   .ram1_ub_n(ram1_ub_n),
	   .ram1_lb_n(ram1_lb_n),
	   .ram2_io(ram2_io),
	   .ram2_ce_n(ram2_ce_n),
	   .ram2_ub_n(ram2_ub_n),
	   .ram2_lb_n(ram2_lb_n),
	   .ide_data_bus(ide_data_bus),
	   .ide_dior(ide_dior),
	   .ide_diow(ide_diow),
	   .ide_cs(ide_cs),
	   .ide_da(ide_da));

   wire [15:0] ide_data_in;
   wire [15:0] ide_data_out;

   assign ide_data_bus = ~ide_dior ? ide_data_out : 16'bz;
   assign ide_data_in  = ide_data_bus;

   wrap_ide wrap_ide(.clk(sysclk),
		     .ide_data_in(ide_data_in),
		     .ide_data_out(ide_data_out),
		     .ide_dior(ide_dior),
		     .ide_diow(ide_diow),
		     .ide_cs(ide_cs),
		     .ide_da(ide_da));

   wire [15:0] ram1_in;
   wire [15:0] ram1_out;
   assign ram1_io = ram_we_n ? ram1_out : 16'bz;
   assign ram1_in = ram1_io;

   wire [15:0] ram2_in;
   wire [15:0] ram2_out;
   assign ram2_io = 0;
   assign ram2_in = 0;

   wrap_s3board_ram wrap_s3board_ram(
      .clk(sysclk),
      .ram_a(ram_a),
      .ram_oe_n(ram_oe_n),
      .ram_we_n(ram_we_n),
      .ram1_in(ram1_in),
      .ram1_out(ram1_out),
      .ram1_ce_n(ram1_ce_n),
      .ram1_ub_n(ram1_ub_n),
      .ram1_lb_n(ram1_lb_n),
      .ram2_in(ram2_in),
      .ram2_out(ram2_out),
      .ram2_ce_n(ram2_ce_n),
      .ram2_ub_n(ram2_ub_n),
      .ram2_lb_n(ram2_lb_n));

   reg halted_once;
   initial halted_once = 0;
   always @(posedge sysclk)
     if (led[0] && !halted_once) begin
        halted_once <= 1;
        $display("cpu halted");
     end

   wire [15:0] obs_pc       /* verilator public_flat */;
   wire [15:0] obs_psw      /* verilator public_flat */;
   wire [21:0] obs_addr_p   /* verilator public_flat */;
   wire [15:0] obs_data     /* verilator public_flat */;
   wire        obs_wr       /* verilator public_flat */;
   wire [1:0]  obs_cpu_cm   /* verilator public_flat */;
   wire [4:0]  obs_rk_state /* verilator public_flat */;
   wire        obs_rd       /* verilator public_flat */;
   wire        obs_byte_op  /* verilator public_flat */;
   wire        obs_trapped  /* verilator public_flat */;
   wire        obs_halted   /* verilator public_flat */;
   wire        obs_bus_int  /* verilator public_flat */;
   wire [7:0]  obs_int_vec  /* verilator public_flat */;
   wire [7:0]  obs_int_ipl  /* verilator public_flat */;
   wire [15:0] obs_addr_v   /* verilator public_flat */;

   assign obs_pc       = top.pc;
   assign obs_psw      = top.psw;
   assign obs_addr_p   = top.bus_addr_p;
   assign obs_data     = top.bus_wr ? top.bus_data_in : top.bus_data_out;
   assign obs_wr       = top.bus_wr;
   assign obs_cpu_cm   = top.bus_cpu_cm;
   assign obs_rk_state = top.rk_state;
   assign obs_rd       = top.bus_rd;
   assign obs_byte_op  = top.bus_byte_op;
   assign obs_trapped  = top.trapped;
   assign obs_halted   = top.halted;
   assign obs_bus_int  = top.bus_int;
   assign obs_int_vec  = top.bus_int_vector;
   assign obs_int_ipl  = top.bus_int_ipl;
   assign obs_addr_v   = top.bus_addr_v;

   wire [15:0] obs_extra1 /* verilator public_flat */;
   wire [31:0] obs_word4  /* verilator public_flat */;

   assign obs_extra1 = {
       8'b0,
       top.cpu.trap_odd,
       top.cpu.trap_abort,
       top.cpu.trap_bus,
       top.bus1.iopage_access,
       top.bus1.nxm_access,
       top.waited,
       top.bus_error,
       1'b0
   };

   assign obs_word4 = {
       11'b0,
       top.cpu.isn,
       top.cpu.istate
   };

endmodule
