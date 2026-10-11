# 51. Apple-1 Integer BASIC Language Reference

## 1. Basic Structure

```basic
line_number statement
line_number statement : statement : statement    ← colon separates multiple statements (pitfall → §6)
```

- Line numbers: 1–32767
- Input without a line number runs in direct mode (immediate execution)

---

## 2. Variables

| Kind | Format | Examples |
|------|--------|---------|
| Integer variable | One letter, or a letter followed by a digit | `A`, `B3`, `Z9` |
| Array | `A(N)` — requires `DIM` declaration | `A(10)` |

- **Variable names are at most 2 characters** (`FLAGS` is interpreted as `F`)
- **Integers only** (-32768 to 32767) — no floating point

---

## 3. Declarations

```basic
DIM A(N)    ← allocates A(1) through A(N)
```

- Subscripts are **1-based**. `A(0)` causes `*** RANGE ERR`
- **Lazy allocation** — `DIM` does not allocate real memory at declaration time.
  Writing to an element for the first time inside a FOR loop expands and moves the variable table,
  invalidating FOR-NEXT stack variable addresses → `*** BAD NEXT ERR`
  - **Workaround**: Initialize arrays with a `GOTO`-based loop; use `FOR-NEXT` only after all elements are allocated

---

## 4. Assignment

```basic
LET A = expression    ← LET is optional
A = expression
```

---

## 5. Operators

| Kind | Operators |
|------|-----------|
| Arithmetic | `+` `-` `*` `/` `MOD` |
| Comparison | `=` `<` `>` `<=` `>=` `<>` |
| Logical | `AND` `OR` `NOT` |

- `/` is **integer division** (truncates toward zero)
- `MOD` returns the remainder

---

## 6. Control Flow

```basic
GOTO line_number
GOSUB line_number
RETURN
END
```

```basic
FOR variable = start TO end
  ...
NEXT variable          ← variable name is required

FOR variable = start TO end STEP increment
```

---

## 7. IF Statement

```basic
IF condition THEN statement
IF condition THEN GOTO line_number
```

**Pitfall — statements after a colon are always executed:**

```basic
IF A=1 THEN B=2 : C=3    ← C=3 executes unconditionally regardless of the condition
```

To make multiple statements conditional, jump to another line with `GOTO`.

```basic
100 IF A<>1 THEN GOTO 200
110 B=2
120 C=3
200 ...
```

---

## 8. Input and Output

```basic
PRINT expression
PRINT expression, expression        ← comma: advance to next tab stop
PRINT expression; expression        ← semicolon: concatenate without space
PRINT                               ← newline only
PRINT "string literal"             ← string literals (string variables not supported)

INPUT variable          ← no prompt; reads an integer
```

---

## 9. Built-in Functions

| Function | Description |
|----------|-------------|
| `ABS(X)` | Absolute value |
| `SGN(X)` | Sign (-1 / 0 / 1) |
| `RND(N)` | Random integer in range 0 to N-1 |

---

## 10. Program Management

```basic
LIST     ← list the program
RUN      ← run the program
NEW      ← erase the program
```

---

## 11. Memory Constraints

- Total of program text + variables + arrays must fit within **approximately 500 bytes**
- Practical array size guide: `N <= 100` (`DIM A(100)` = 200 bytes)
- `DIM A(999)` → `*** MEM FULL ERR`

---

## 12. Error Reference

| Error | Cause |
|-------|-------|
| `*** RANGE ERR` | Array subscript out of range (including 0) |
| `*** MEM FULL ERR` | Insufficient memory |
| `*** BAD NEXT ERR` | FOR-NEXT stack corruption (often caused by DIM lazy allocation) |
| `*** SYNTAX ERR` | Syntax error |
| `*** UNDEF'D STATEMENT` | GOTO/GOSUB to a non-existent line number |

---

## References

- [50-wozmon-使い方.md](50-wozmon-使い方.md) — Loading programs with Woz Monitor
- [12-integer-BASIC-動作検証サンプル.md](12-integer-BASIC-動作検証サンプル.md) — Collection of verified sample programs
