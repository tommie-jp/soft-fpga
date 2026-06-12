# 23. WordMaster User Guide

WordMaster (`WM.COM`) is a full-screen text editor for CP/M by MicroPro.
It is the predecessor to WordStar and shares the same diamond-key layout.

## Launch

```text
WM filename.TXT
```

A new file is created if the specified file does not exist.

## 1. Cursor Movement

```text
        ^E (up)
         |
^S (left)-+- ^D (right)
         |
        ^X (down)
```

| Key | Action |
|-----|--------|
| `^E` | Up 1 line |
| `^X` | Down 1 line |
| `^S` | Left 1 character |
| `^D` | Right 1 character |
| `^A` | Left 1 word |
| `^F` | Right 1 word |
| `^Q S` | Beginning of line |
| `^Q D` | End of line |
| `^Q E` | Top of screen |
| `^Q X` | Bottom of screen |
| `^Q R` | Beginning of file |
| `^Q C` | End of file |

## 2. Deletion

| Key | Action |
|-----|--------|
| `^G` | Delete character at cursor |
| `^H` / BS | Delete character to the left of cursor |
| `^T` | Delete word to the right of cursor |
| `^Y` | Delete current line |

## 3. Insert Mode

| Key | Action |
|-----|--------|
| `^V` | Toggle between insert mode and overwrite mode |

## 4. Block Operations

| Key | Action |
|-----|--------|
| `^K B` | Set block start mark |
| `^K K` | Set block end mark |
| `^K C` | Copy marked block to cursor position |
| `^K V` | Move marked block to cursor position |
| `^K Y` | Delete marked block |
| `^K H` | Clear block marks |

## 5. Search and Replace

| Key | Action |
|-----|--------|
| `^Q F` | Search for string |
| `^Q A` | Search and replace |
| `^L` | Repeat last search / replace |

Options (entered at the search prompt):

- `B` — Search backwards
- `G` — Search from the beginning of the file
- `N` — Replace all without confirmation
- Number — Execute the specified number of times

## 6. Save and Exit

| Key | Action |
|-----|--------|
| `^K S` | Save and continue editing (creates a backup) |
| `^K D` | Save and exit |
| `^K X` | Save and exit (same as `^K D`) |
| `^K Q` | Discard changes and exit |

## 7. Other

| Key | Action |
|-----|--------|
| `^J` | Display help screen |
| `^B` | Reformat paragraph to fit right margin |
| `^I` / Tab | Insert tab |
| `^P` + char | Embed a control character (printer control, etc.) |
| `^U` | Cancel current command |

## 8. Notes for This Simulator

- `^C` (CP/M BREAK) must be sent via the **`^C` button** in the terminal.
- The BS key is converted by xterm.js to `^H` (0x08) before being sent.
- While WordMaster is running, it polls the CP/M console status port (Port 0x02)
  waiting for key input. If you see continuous `port=0x02` accesses in the I/O Bus Analyzer,
  this is normal behaviour.
