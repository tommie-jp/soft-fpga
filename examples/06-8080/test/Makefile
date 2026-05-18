Z80ASM  := z80asm
TESTS   := test_all.bin

.PHONY: all clean

all: $(TESTS)

%.bin: %.asm
	$(Z80ASM) --output=$@ $<

clean:
	rm -f $(TESTS)
