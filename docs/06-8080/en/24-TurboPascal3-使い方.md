# 24. Turbo Pascal 3 — User Guide

> ⚠️ **Turbo Pascal 3 does not work on this simulator (Intel 8080 / vm80a).**
> TURBO.COM and TURBO.OVR make heavy use of Z80-specific instructions
> (`LDIR` = `ED B0`, etc.) that cannot be correctly executed on an 8080 CPU
> (`B>TURBO` returns to the CCP immediately after launch).
> Consider using a Z80-based CP/M simulator such as RunCPM or MEMU.

## 1. Overview

**Turbo Pascal 3** (Borland, 1984) is a fast Pascal compiler for CP/M.
The `TurboPascal3.dsk` in this simulator is the **Turbo Tutor** disk (sample code collection).
TURBO.COM (the IDE) is included but cannot run on the 8080 due to Z80-specific code.

| File | Role |
|------|------|
| `TURBO.COM` | IDE / compiler |
| `TURBO.OVR` | Editor overlay (required) |
| `TURBO.MSG` | Error messages |
| `TINST.COM` | Terminal configuration installer |

---

## 2. Launch Procedure

### 2-1. Mount the disk

Select `TurboPascal3.dsk` with **B: Load** in the simulator UI.

```text
A>B:
B>TURBO
```

### 2-2. Main screen

```text
Logged drive: B
Active directory:
Work file:
Main file:

Edit        Compile     Run         Save
eXecute     Dir         Quit        compiler Options
```

| Key | Action |
|-----|--------|
| `E`  | Open editor |
| `C`  | Compile (to memory) |
| `R`  | Compile and run immediately |
| `S`  | Save source file |
| `D`  | Display directory |
| `Q`  | Quit (return to CP/M) |

---

## 3. First Program (HELLO.PAS)

### 3-1. Specify a work file and run

At the main screen:

```text
Work file name? HELLO    <- .PAS extension may be omitted
```

Press `R` (Run).

```text
Compiling...
Running...
Hello, world!
```

### 3-2. Compile and generate a .COM file

Go to `O` (compiler Options) → `C` (Compile to COM file), then press `C` (Compile).
`HELLO.COM` is generated and can be run directly with `B>HELLO`.

---

## 4. Editor Key Bindings (WordStar-compatible)

Open the editor with `E`. The `^C` / `^D` / `^S` / `^X` / `^E` buttons in this simulator work here.

### Cursor Movement

| Key | Action |
|-----|--------|
| `^E` | Up |
| `^X` | Down |
| `^S` | Left |
| `^D` | Right |
| `^A` | Word left |
| `^F` | Word right |
| `^W` | Scroll up 1 line |
| `^Z` | Scroll down 1 line |
| `^R` | Page up |
| `^C` | Page down |

### Editing

| Key | Action |
|-----|--------|
| `^G` | Delete character at cursor |
| `^Y` | Delete line |
| `^N` | Insert newline |
| `^V` | Toggle insert / overwrite |
| `^I` | Tab |

### File Operations (^K prefix)

| Key | Action |
|-----|--------|
| `^K S` | Save and continue editing |
| `^K D` | Save and return to main screen |
| `^K Q` | Return to main screen without saving |
| `^K B` | Set block start mark |
| `^K K` | Set block end mark |
| `^K C` | Copy block |
| `^K Y` | Delete block |

### Search and Replace (^Q prefix)

| Key | Action |
|-----|--------|
| `^Q F` | Search |
| `^Q A` | Search and replace |

---

## 5. Writing a New Program

At the main screen:

```text
Work file name? MYTEST    <- new file name
```

Press `E` to open the editor (blank).

```pascal
program MyTest;
begin
  writeln('Hello from 8080!');
end.
```

Press `^K D` to save and return to the main screen. Press `R` to compile and run.

---

## 6. Sample Programs (included on Turbo Tutor disk)

| File | Description |
|------|-------------|
| `HELLO.PAS` | Minimal sample |
| `MYNAME.PAS` | Name input example |
| `GAME1.PAS` | Simple game |
| `RANDOM.PAS` | Random numbers |
| `CPMDIR.PAS` | Read CP/M directory |
| `CPMSTAT.PAS` | Get CP/M system status |
| `LISTT.PAS` | Source lister (large sample) |

---

## 7. Troubleshooting

| Symptom | Cause and Fix |
|---------|---------------|
| `TURBO` exits immediately after launch | `TURBO.OVR` is missing from the disk → re-run `doCopyAllToDisk.sh` |
| Only error numbers displayed | `TURBO.MSG` is missing → same fix |
| Screen corruption | Terminal type mismatch → reconfigure with `TINST` |
| `Disk full` during compile | Switch working drive to A:, or prepare another disk |

---

## 8. See Also

- [18-BDS-C-使い方.md](18-BDS-C-使い方.md) — Another CP/M C compiler
- [15-ファイル構成とファイル交換.md](15-ファイル構成とファイル交換.md) — Adding files to disk images
- [03-開発ツール.md](03-開発ツール.md) — Disk operations with cpmtools
