# 18. How to Use the BDS C Compiler

BDS C v1.60 (by Leor Zolman, freeware) — a C compiler targeting Intel 8080/Z80 + CP/M 2.2.
It generates `.COM` files directly.

---

## 1. Disk Layout (BDS C Disk)

Select **BDS C (CC + CLINK + DEFF)** in the simulator's disk selector
to boot with a disk containing the following files.

| File | Role |
|------|------|
| `CC.COM` | C compiler (source → .CRL intermediate code) |
| `CC2.COM` | Compiler second pass (for large sources) |
| `CLINK.COM` | Linker (.CRL → .COM) |
| `DEFF.CRL` | Standard library (printf / malloc / string functions etc.) |
| `DEFF2.CRL` | Extended library (floating point etc.) |
| `C.CCC` | SUBMIT script that runs CC + CC2 + CLINK in one step |
| `ED.COM` | Text editor (for editing source files) |
| `HELLO.C` | Sample source |

---

## 2. Compilation Procedure

### 2.1 Basic (3 Steps)

```text
A>CC HELLO.C       ← compile source → generates HELLO.CRL
A>CLINK HELLO      ← link → generates HELLO.COM
A>HELLO            ← run
```

`CC2` is only needed for advanced features. For simple programs `CC → CLINK` is enough.

### 2.2 When CC2 Is Needed

```text
A>CC HELLO.C
A>CC2 HELLO        ← optional, but required for complex expressions or large sources
A>CLINK HELLO
```

### 2.3 Linking with DEFF2.CRL (floating point etc.)

```text
A>CLINK HELLO,DEFF2
```

### 2.4 Full Example (compiling HELLO.C as-is)

```text
A>CC HELLO.C
BD Software C Compiler   v1.60

A>CLINK HELLO
BD Software C Linker   v1.60

Last code address: 0E48
Writing output...
  45K link space remaining

A>HELLO
Hello, CP/M!
```

---

## 3. Sample Programs

### 3.1 Hello, CP/M! (included on the disk)

```c
/* HELLO.C */
main()
{
    printf("Hello, CP/M!\n");
}
```

> BDS C allows omitting the return type of a function (defaults to `int`).

### 3.2 Character I/O

```c
/* INPUT.C */
main()
{
    int c;
    printf("Name: ");
    while ((c = getchar()) != '\n')   /* BDS C getchar() returns '\n', not '\r' */
        putchar(c);
    putchar('\n');
}
```

### 3.3 String Manipulation

```c
/* STRING.C */
main()
{
    char buf[64];
    int i, len;

    strcpy(buf, "CP/M-80");
    len = strlen(buf);
    printf("Length: %d\n", len);

    for (i = 0; i < len; i++)
        buf[i] = toupper(buf[i]);
    printf("Upper: %s\n", buf);
}
```

### 3.4 Command-Line Arguments

```c
/* ARGS.C */
main(argc, argv)
int argc;
char *argv[];
{
    int i;
    printf("%d args:\n", argc);
    for (i = 0; i < argc; i++)
        printf("  [%d] %s\n", i, argv[i]);
}
```

### 3.5 Simple Calculator

```c
/* CALC.C */
main()
{
    int a, b;
    printf("a b: ");
    scanf("%d %d", &a, &b);
    printf("%d + %d = %d\n", a, b, a + b);
    printf("%d * %d = %d\n", a, b, a * b);
}
```

---

## 4. Key Library Functions (DEFF.CRL)

| Category | Functions |
|----------|-----------|
| Output | `printf(fmt, ...)` `putchar(c)` `puts(s)` |
| Input | `scanf(fmt, ...)` `getchar()` `gets(buf)` |
| String | `strlen` `strcpy` `strcat` `strcmp` `strchr` |
| Character | `toupper` `tolower` `isalpha` `isdigit` |
| Memory | `malloc(n)` `free(p)` `memcpy` `memset` |
| Conversion | `atoi` `itoa` |
| Exit | `exit(code)` |

---

## 5. Main Differences from Standard C

| Item | BDS C v1.60 |
|------|-------------|
| Headers | No `#include <stdio.h>`. For file I/O use `#include "bdscio.h"` |
| Prototypes | Function declarations can be omitted (K&R style) |
| `char` | **unsigned** by default |
| Floating point | Requires DEFF2.CRL; precision is equivalent to single precision |
| Line endings | CP/M uses `\r\n`. `getchar()` goes through BDOS fn10 and returns `\n` (0x0A) (`\r` is stripped) |
| Stack | Approximately 4 KB. Deep recursion is not supported |
| `int` size | 16-bit (−32768 to 32767) |

---

## 6. Editing Source Files (ED.COM)

ED.COM is a line-oriented editor. Its operation differs from vi/Emacs.

```text
A>ED HELLO.C         ← open existing file (creates a new file if not found)

#I                   ← Insert mode (type text where there is no colon)
main()
{
    printf("test\n");
}
^Z                   ← exit Insert mode (Ctrl+Z)

#E                   ← save and exit
```

Basic commands:

| Command | Action |
|---------|--------|
| `nT` | Display n lines (`0T` = entire file) |
| `nD` | Delete n lines |
| `S/old/new/` | String substitution |
| `#E` | Save and exit |
| `#Q` | Exit without saving |

---

## 7. Common Errors

| Error message | Cause and remedy |
|---------------|-----------------|
| `Error writing: 0/A:HELLO.COM` | Disk nearly full. Delete unnecessary files (e.g. `ERA *.CRL`) and try again |
| `Can't open DEFF.CRL` | CLINK cannot find the library. Check the current drive |
| `? on line N` | Syntax error. Check around line N (write in K&R syntax) |
| `Link ABORTED` | Link failed. If intermediate files (.CRL) are corrupted, restart from CC |

---

## 8. Disk Space Considerations

The BDS C disk uses **IBM 3740 SSSD (256 KB)**. Intermediate compile files (`.CRL`)
accumulate quickly and can fill the disk.

```text
A>ERA *.CRL          ← delete intermediate files after compiling
A>ERA HELLO.COM      ← delete old executables
```

Approximate sizes of generated files:

| File | Size |
|------|------|
| `HELLO.CRL` (intermediate) | Depends on source size, a few KB |
| `HELLO.COM` (final) | Usually 1–20 KB |
