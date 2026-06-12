# 31. LCASE (Uppercase Mode) Behavior <a class="qr-link" href="../../../docs/09-PDP11/img/31-en-QR.png">QR</a>

## 1. Symptoms

After logging into Unix V6, all input and output appears in uppercase.

```text
login: ROOT
# WHOAMI
WHOAMI: NOT FOUND
# LS /
BIN  DEV  ETC  ...
```

## 2. Cause

The Unix V6 tty driver has an **LCASE mode** (lowercase terminal support).
This feature was designed for uppercase-only teletype terminals and performs the following conversions.

| Direction | Conversion |
|-----------|-----------|
| Input | Echoes `a` as `A` (kernel converts it back to `a` internally before passing to the program) |
| Output | Sends program's `a` to the terminal as `A` |

When the `login` program receives a username entered entirely in **uppercase**,
it determines the terminal is uppercase-only and automatically sets LCASE.

## 3. Trigger Condition

```text
login:          ← empty Enter → LOGIN INCORRECT
NAME: ROOT      ← type "ROOT" on the second attempt → LCASE activated
#
```

Entering uppercase (`ROOT`) on the first login attempt enables LCASE.
Typing `root` in **lowercase** does not trigger it.

## 4. How to Disable

After logging in, enter the following (works even while in LCASE, because the kernel converts uppercase input to lowercase):

```text
# STTY -LCASE
```

The terminal will then revert to lowercase display.

## 5. Correct Login Procedure

```text
login: root     ← type in lowercase
Password:       ← empty Enter (root has no password)
#               ← LCASE not triggered, operates in lowercase
```

## 6. Historical Background

LCASE was a compatibility feature for teletype terminals of the Unix V6/V7 era (such as the Model 33 ASR).
These terminals could only print uppercase characters.
On modern terminal emulators this feature appears to be a "bug," but it is working exactly as designed.
