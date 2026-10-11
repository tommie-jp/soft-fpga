# 12. Integer BASIC Verification Sample Programs

A collection of programs for verifying the behavior of Apple-1 Integer BASIC.

> - BASIC is uppercase-only and supports integer arithmetic only. Integer division truncates (`7/2` → `3`).
> - **Array subscripts are 1-based.** `DIM A(N)` makes `A(1)` through `A(N)` valid. `A(0)` causes `*** RANGE ERR`.
> - `NEW` is not supported (`*** SYNTAX ERR`). To clear a program, overwrite it line by line or restart the simulator.
> - If a program runs to the end without `END`, `*** END ERR` is displayed — this indicates normal termination.
> - **In `IF cond THEN stmt1 : stmt2`, `stmt2` always executes regardless of the condition.**
>   To conditionally execute multiple statements, use `THEN GOTO` to jump to another line.

---

## 1. PRINT / Arithmetic

Verify string output with PRINT, arithmetic expressions, and truncating integer division.

```basic
10 PRINT "HELLO, APPLE-1"
20 PRINT "2*3+4=";2*3+4
30 PRINT "100/7=";100/7
40 PRINT "DONE"
RUN
```

Expected output:

```text
HELLO, APPLE-1
2*3+4=10
100/7=14
DONE
*** END ERR
```

---

## 2. FOR-NEXT Loop (Sum of 1 to 10)

Verify FOR-NEXT loops, variable assignment, and accumulation.

```basic
10 S=0
20 FOR I=1 TO 10
30 S=S+I
40 NEXT I
50 PRINT "SUM=";S
60 END
RUN
```

Expected output:

```text
SUM=55
```

---

## 3. GOTO / Conditional Branch (Greatest Common Divisor)

Verify IF-THEN, GOTO, END, and integer remainder via `A-A/B*B`.

```basic
10 A=252
20 B=105
30 IF B=0 THEN GOTO 80
40 C=A-A/B*B
50 A=B
60 B=C
70 GOTO 30
80 PRINT "GCD=";A
RUN
```

Expected output:

```text
GCD=21
```

---

## 4. GOSUB / RETURN (3×3 Multiplication Table)

Verify nested FOR-NEXT, GOSUB/RETURN, and `PRINT ;` (no newline).

```basic
10 FOR I=1 TO 3
20 FOR J=1 TO 3
30 GOSUB 100
40 NEXT J
50 PRINT
60 NEXT I
70 END
100 PRINT I*J;" ";
110 RETURN
RUN
```

Expected output:

```text
1  2  3
2  4  6
3  6  9
```

---

## 5. Prime Enumeration (2 to 30)

Verify multi-path RETURN from GOSUB and divisibility testing via integer division `N/D*D=N`.

```basic
10 FOR N=2 TO 30
20 GOSUB 200
30 IF F=1 THEN PRINT N
40 NEXT N
50 END
200 F=1
210 IF N<4 THEN RETURN
220 D=2
230 IF D*D>N THEN RETURN
240 IF N/D*D=N THEN F=0
245 IF F=0 THEN RETURN
250 D=D+1
260 GOTO 230
RUN
```

Expected output:

```text
2
3
5
7
11
13
17
19
23
29
```

---

## 6. INPUT (Interactive Input)

Verify the INPUT statement, the `?` prompt, and reading values interactively.

```basic
10 INPUT N
20 S=0
30 FOR I=1 TO N
40 S=S+I
50 NEXT I
60 PRINT "SUM 1-";N;"=";S
70 END
RUN
```

Expected output when `10` is entered at the `?` prompt:

```text
SUM 1-10=55
```

---

## 7. Fibonacci Sequence (Medium Scale)

Verify a GOTO loop, two-variable swap, and conditional termination. Enumerates Fibonacci numbers up to 1000.

```basic
10 A=1
20 B=1
30 IF A>1000 THEN END
40 PRINT A
50 C=A+B
60 A=B
70 B=C
80 GOTO 30
RUN
```

Expected output (16 values):

```text
1
1
2
3
5
8
13
21
34
55
89
144
233
377
610
987
```

> The `>` in `IF A>1000 THEN END` is a comparison operator within the line. It is unrelated to the BASIC prompt `>`.

---

## 8. Bubble Sort (Large Scale)

Verify array `DIM`, nested FOR-NEXT, and adjacent-element swapping.
Sorts 10 elements using bubble sort and prints them in ascending order.

```basic
10 DIM A(10)
20 A(1)=5
30 A(2)=3
40 A(3)=8
50 A(4)=1
60 A(5)=9
70 A(6)=2
80 A(7)=7
90 A(8)=4
100 A(9)=6
110 A(10)=10
120 FOR I=1 TO 9
130 FOR J=1 TO 10-I
140 IF A(J)<=A(J+1) THEN GOTO 180
150 T=A(J)
160 A(J)=A(J+1)
170 A(J+1)=T
180 NEXT J
190 NEXT I
200 FOR I=1 TO 10
210 PRINT A(I)
220 NEXT I
RUN
```

Expected output:

```text
1
2
3
4
5
6
7
8
9
10
*** END ERR
```

---

## 9. Multiplication Table 9×9 (Medium Scale)

Verify a double loop, conditional space insertion, and formatted `PRINT ;`.
Inserts a leading space for single-digit products to align columns.

```basic
10 FOR I=1 TO 9
20 FOR J=1 TO 9
30 P=I*J
40 IF P<10 THEN PRINT " ";
50 PRINT P;" ";
60 NEXT J
70 PRINT
80 NEXT I
RUN
```

Expected output:

```text
 1  2  3  4  5  6  7  8  9
 2  4  6  8 10 12 14 16 18
 3  6  9 12 15 18 21 24 27
 4  8 12 16 20 24 28 32 36
 5 10 15 20 25 30 35 40 45
 6 12 18 24 30 36 42 48 54
 7 14 21 28 35 42 49 56 63
 8 16 24 32 40 48 56 64 72
 9 18 27 36 45 54 63 72 81
*** END ERR
```

---

## 10. Perfect Number Search (Large Scale)

Verify FOR-NEXT inside GOSUB, divisor sum accumulation, and the `S=N` check.
Searches for "perfect numbers" — numbers equal to the sum of their proper divisors.

```basic
10 FOR N=2 TO 500
20 GOSUB 200
30 IF S=N THEN PRINT N
40 NEXT N
50 END
200 S=0
210 FOR D=1 TO N/2
220 IF N/D*D=N THEN S=S+D
230 NEXT D
240 RETURN
RUN
```

Expected output:

```text
6
28
496
```

> `N=2 TO 500` takes a while. For a quick check, narrow it to `N=2 TO 30` (results: 6, 28).

---

## 11. Byte Sieve — Sieve of Eratosthenes (Large Scale / Benchmark)

The official Integer BASIC benchmark published in BYTE magazine in 1981.
No input required; fully deterministic. On a real Apple II this took approximately 166 seconds.

> **Variable name limits and lazy allocation in Apple-1 BASIC:**
>
> - Variable names may only be a single letter (A–Z) or a letter followed by a digit (A0–Z9).
>   The multi-character names `FLAGS`/`SIZE`/`COUNT`/`PRIME` used in the original BYTE version (written for Apple II) are not valid.
> - `DIM F(N)` registers only the array bound; actual memory is allocated lazily on the first write.
>   Writing `F(I) = 1` inside a FOR loop causes the variable table to grow and relocate,
>   invalidating the address pointer for loop variable `I` and triggering `*** BAD NEXT ERR`.
>   **Workaround:** Initialize the array using a GOTO-based loop to pre-allocate all elements before using FOR-NEXT.

```basic
1 S = 100
2 DIM F(100)
3 PRINT "SIEVE START"
4 I = 1
5 F(I) = 1
6 I = I+1
7 IF I <= S THEN GOTO 5
8 C = 0
9 FOR I = 1 TO S
10 IF F(I) = 0 THEN 18
11 P = I+I+1
12 K = I+P
13 IF K > S THEN 17
14 F(K) = 0
15 K = K+P
16 GOTO 13
17 C = C+1
18 NEXT I
19 PRINT C
RUN
```

Expected output (count of primes among odd numbers 3–201 = 45):

```text
SIEVE START
45
*** END ERR
```

> **Note on SIZE limits:** Apple-1 BASIC's HIMEM (heap ceiling) is limited to approximately 1–2 KB.
> `DIM F(N)` allocates `(N+1)×2` bytes, so a large N causes `*** MEM FULL ERR`.
> Changing to `S = 8190` produces the original BYTE benchmark result (1899), but
> Apple-1 BASIC cannot run it due to insufficient memory.
