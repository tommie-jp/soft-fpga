Z80ASM      := z80asm
BIOS_DIR    := bios
BIOS_SRC    := $(BIOS_DIR)/bios.asm
BIOS_BIN    := $(BIOS_DIR)/bios.bin
SIGNON_INC  := $(BIOS_DIR)/signon.inc

SIGNON_LINUX := 64K CP/M VERS 2.2 for vm80a soft-FPGA Linux
SIGNON_WASM  := 64K CP/M VERS 2.2 for vm80a soft-FPGA WASM

.PHONY: all linux wasm clean

all: linux

linux:
	printf "defm '%s'\n" "$(SIGNON_LINUX)" > $(SIGNON_INC)
	$(Z80ASM) -I $(BIOS_DIR) --output=$(BIOS_BIN) $(BIOS_SRC)

wasm:
	printf "defm '%s'\n" "$(SIGNON_WASM)" > $(SIGNON_INC)
	$(Z80ASM) -I $(BIOS_DIR) --output=$(BIOS_BIN) $(BIOS_SRC)

clean:
	rm -f $(BIOS_BIN) $(SIGNON_INC)
