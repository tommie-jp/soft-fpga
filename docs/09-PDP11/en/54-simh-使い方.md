# 54. SIMH — PDP-11 Simulator <a class="qr-link" href="../../../docs/09-PDP11/img/54-en-QR.png">QR</a>

SIMH is a collection of software simulators that recreate historical computers from Digital Equipment Corporation.
It can run PDP-11/Unix V6 in its entirety.

If `cc` does not work in the **WASM build**, SIMH allows `cc hello.c` to compile normally.

---

## 1. Installation (Ubuntu / WSL2)

```bash
sudo apt install simh
```

This makes the `pdp11` command available.

---

## 2. Starting the Simulator

```bash
pdp11
```

After launching, enter the following:

```text
PDP-11 simulator V3.8-1
sim> set cpu 11/40
Disabling XQ
sim> attach rk0 examples/09-pdp11/disk/unix_v6_rk05.dsk
sim> boot rk0
```

When the bootrom `@` prompt appears:

```text
@rkunix

login: root
#
```

---

## 3. Compiling with cc

In SIMH, `cc` works correctly (unaffected by the WASM build bug described in `41-cc-コンパイル-バグ調査.md`).

```text
# ed
a
main()
{
    printf("Hello, Unix V6!\n");
}
.
w hello.c
q
# cc hello.c
# ./a.out
Hello, Unix V6!
```

---

## 4. Exiting SIMH

Run `sync` twice inside Unix V6 before quitting the simulator.

```text
# sync
# sync
```

Then press `Ctrl-E` to return to the SIMH prompt:

```text
Simulation stopped, PC: 015670 (...)
sim> quit
```

---

## 5. Commonly Used SIMH Commands

Commands available at the SIMH prompt (`sim>`):

| Command | Description |
|---------|-------------|
| `set cpu 11/40` | Select the PDP-11/40 |
| `attach rk0 <file>` | Attach an RK05 disk image |
| `boot rk0` | Boot from RK05 |
| `quit` | Exit SIMH |
| `examine 0` | Display the value at address 0 |
| `deposit 0 177777` | Write a value to address 0 |
| `show cpu` | Display CPU configuration |
| `Ctrl-E` | Interrupt execution and return to the SIMH prompt |

---

## 6. Comparison: SIMH vs. soft-FPGA

| Item | SIMH | soft-FPGA (WASM build) |
|------|------|------------------------|
| cc support | **Works** | Fails (MMU bug) |
| Boot speed | ~10 seconds | ~30–60 seconds |
| Bus waveforms | Not visible | Observable in Logic Analyzer |
| MMU internal state | Not visible | Real-time display in panel |
| Use case | Development / testing | Education / visualization demo |

---

## 7. Sharing the Disk Image

soft-FPGA and SIMH can use the same `unix_v6_rk05.dsk` — files written in SIMH are also accessible in soft-FPGA.

```bash
# Copy the disk image edited in SIMH to the WASM build
cp examples/09-pdp11/disk/unix_v6_rk05.dsk examples/09-pdp11/web/disk/
```

---

## 8. References

- [41 cc Compile Bug Investigation](?doc=41-cc-コンパイル-バグ調査.md) — Details on the WASM build cc bug
- [53 References](?doc=53-参考資料.md) — Link to the official SIMH website
- [SIMH Official Site](http://simh.trailing-edge.com/)
