Z80ASM   := z80asm
BIOS_SRC := bios/bios.asm
BIOS_BIN := bios/bios.bin

.PHONY: all clean

all: $(BIOS_BIN)

$(BIOS_BIN): $(BIOS_SRC)
	$(Z80ASM) --output=$@ $<

clean:
	rm -f $(BIOS_BIN)
