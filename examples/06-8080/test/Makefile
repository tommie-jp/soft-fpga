Z80ASM  := z80asm
CPM_COM_DIR := ../sw/cpm
DSK_A   := ../sw/cpm/disks/cpm22.dsk
DSK_FMT := ibm-3740

TESTS   := test_all.bin
CPM_COMS := $(CPM_COM_DIR)/8080PRE.COM

.PHONY: all disk clean

all: $(TESTS)

disk: $(CPM_COMS)
	-cpmrm -f $(DSK_FMT) $(DSK_A) 0:8080PRE.COM 2>/dev/null
	cpmcp -f $(DSK_FMT) $(DSK_A) $(CPM_COM_DIR)/8080PRE.COM 0:8080PRE.COM

%.bin: %.asm
	$(Z80ASM) --output=$@ $<

$(CPM_COM_DIR)/8080PRE.COM: $(CPM_COM_DIR)/8080pre_cpm.asm
	$(Z80ASM) --output=$@ $<

clean:
	rm -f $(TESTS) $(CPM_COMS)
