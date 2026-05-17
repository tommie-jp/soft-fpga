CC65   := cc65
CA65   := ca65
LD65   := ld65
CFG    := apple1.cfg

SRCS    := $(wildcard *.c)
BINS    := $(SRCS:.c=.bin)
GENSRCS := $(SRCS:.c=.s)   # .c から生成される .s（手書き .s は含まない）
RTOBJS  := crt0.o runtime.o

LOAD_ADDR := 768   # $0300

.PHONY: all dump clean

all: $(BINS)

# built-in %.o: %.c を上書き（make が cc を呼ばないよう明示）
%.o: %.c
	$(CC65) -t none -O $< -o $*.s
	$(CA65) $*.s -o $@

crt0.o: crt0.s
	$(CA65) crt0.s -o crt0.o

runtime.o: runtime.s
	$(CA65) runtime.s -o runtime.o

%.bin: %.o $(RTOBJS) $(CFG)
	$(LD65) -C $(CFG) $(RTOBJS) $< -o $@

dump: $(BINS)
	@for bin in $(BINS); do \
	    echo "=== $$bin (paste into Woz Monitor, then 0300R) ==="; \
	    xxd -c 8 -g 1 $$bin | awk -v base=$(LOAD_ADDR) \
	        '{addr=base+strtonum("0x"$$1); printf "%04X:", addr; \
	          for(i=2;i<=9&&$$i!="";i++) printf " %s", toupper($$i); print ""}'; \
	done

clean:
	rm -f $(GENSRCS) *.o *.bin
