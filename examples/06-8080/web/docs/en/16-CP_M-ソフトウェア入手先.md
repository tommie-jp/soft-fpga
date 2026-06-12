# 16. CP/M Software Sources

## 1. Archive Sites

| Site | Contents |
|------|----------|
| [**Walnut Creek CP/M CD** — archive.org](https://archive.org/search?query=walnut+creek+cpm) | CD image containing a large collection of public-domain CP/M software, organized by category — the most comprehensive archive available |
| [**Gaby's CP/M Archive**](http://www.gaby.de/cpm/) | Organized by category; includes development tools such as BDS C and Aztec C |
| [**retroarchive.org**](http://www.retroarchive.org/) | Hosts the official freeware releases of BDS C and Aztec C |

## 2. C Compilers

Because this simulator uses the **Intel 8080** (vm80a), Z80-only compilers
(such as Hi-Tech C) will not work.

| Compiler | Target CPU | License | Notes |
|----------|-----------|---------|-------|
| **BDS C** | 8080/Z80 | Freeware (released by author Leor Zolman) | The representative compiler of the CP/M 2.2 era. Generates `.COM` directly. Comes with a standard library. First choice. |
| **Aztec C** | 8080/Z80 | Freeware (released by Manx Software) | High quality. Separate linker model. Rich library. |
| **Small C** | 8080 | Public domain | Subset implementation of C. Source available. Good for porting and learning. |
| Hi-Tech C | **Z80 only** | Freeware | Does not run on vm80a |

## 3. Other Applications

| Category | Application | Notes |
|----------|------------|-------|
| Pascal | **Turbo Pascal 3.x** | Officially released as freeware by Borland. CP/M version exists. However, **it uses Z80-specific instructions (LDIR, etc.) and does not run on vm80a** |
| BASIC | **MBASIC** (Microsoft BASIC) | The standard BASIC for CP/M |
| Game | **Zork I/II/III** | Infocom text adventure. CP/M versions are widely available |
| Game | **Adventure** (Colossal Cave) | The original text adventure |
| Game | **Ladder** | Arcade-style game |
| Database | **dBASE II** | Historic database software |
| Word processor | **WordStar 3.x** | Renowned word processor (note: copyright still applies) |

## 4. Adding Software to a Disk Image

For procedures on creating images, copying files, and extracting files, see
[03-開発ツール.md §4 — cpmtools](03-開発ツール.md).

## 5. References

- [15-ファイル構成とファイル交換.md](15-ファイル構成とファイル交換.md) — Location and structure of DSK files
- [12-CP_M-コマンドリファレンス.md](12-CP_M-コマンドリファレンス.md) — CP/M built-in command list
