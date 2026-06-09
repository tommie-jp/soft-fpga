# 55. MMU ON/OFF と命令タイミング — 実機 vs 本プロジェクト RTL <a class="qr-link" href="../../../docs/09-PDP11/img/55-QR.png">QR</a>

PDP-11 で **MMU（メモリ管理）の有効/無効が命令タイミング（クロック数・バスサイクル波形）を変えるか**を調べた記録。
結論はモデル依存で、本プロジェクトの RTL がどの実機挙動に相当するかも整理する。

---

## 1. 結論（早見表）

| 対象 | MMU ON/OFF で命令タイミングが変わるか | 補足 |
|------|------|------|
| 本プロジェクト RTL（`cpus-pdp11`） | **変わらない**（アドレスの値だけ違う） | 組合せ変換・wait 無し |
| 実機 **PDP-11/40**（KT11-D） | **変わらない** | 基板装着で全参照 +約100ns 固定、ON/OFF 差なし |
| 実機 **PDP-11/45**（KT11-C） | **変わる** | operating 時、メモリ参照ごとに **+0.09µs** |

本プロジェクトは 11/40 系をモデルにしており、「ON/OFF でタイミング不変」という挙動は
**実機 11/40 の特性（マップ有無で性能差なし）と一致**する。

---

## 2. 本プロジェクト RTL の根拠

MMU 変換は組合せ論理で、CPU を止める wait/stall を出さない。

- [`mmu.v`](../../vendor/cpus-pdp11/rtl/mmu.v) — `cpu_pa = map_address ? mapped_pa_22 : unmapped_pa_22`
  は `assign`（同一クロック内で確定）。MMU の出力で CPU を止める信号は無く、
  あるのは `signal_abort` / `signal_trap` のみ。→ 変換に余分なクロックを挿入しない。
- [`pdp11.v`](../../vendor/cpus-pdp11/rtl/pdp11.v) — 命令の待ち合わせは `waiting = bus_req && !bus_ack`。
  `mmu_abort` / `mmu_trap` は `assert_trap_abort`（トラップ条件）に入るだけで、
  通常の状態遷移（istate）には関与しない。
- [`bus.v`](../../vendor/cpus-pdp11/rtl/bus.v) — `waiting = ram_access && ~ram_done`。
  物理アドレスが「変換済み」か「素通し」かでサイクル数は変わらない。

### 2.1 変わる点 / 変わらない点

| 観点 | MMU ON/OFF で | 備考 |
|------|------|------|
| クロック数・T-state・波形の形 | 変わらない | 変換は組合せ（透過） |
| アドレスバスに出る「値」 | 変わる | 仮想16bit素通し vs 物理18/22bitマップ。波形のタイミングは同じ、数値が違う |
| ページフォルト発生時 | 変わる | MMU abort → トラップ系列（ベクタ 0o250）に分岐。これは例外であって正常タイミングではない |

含意: 「全命令タイミング図」を作る際、**MMU off で採取した波形がそのまま MMU on でも通用**する
（アドレス欄の表示値を除く）。MMU on/off で二重にケースを持つ必要はない。

---

## 3. 実機の挙動（DEC ハンドブック由来）

### 3.1 PDP-11/40（KT11-D）— ON/OFF では変わらない

- **マップ有効/無効による性能差は無い**
  （"no performance hit because of mapped or unmapped references as such on the 11/40"）。
- ただし **MMU 基板が「装着されているか」で全メモリ参照が一律に遅くなる**。
  約 **100ns** が仮想→物理アドレス生成のため加算される。これは「マップしているか」ではなく
  「信号が余分なロジックを通る」ことによる固定遅延。
- KT11-D 装着時は **CPU の timing delay 用キャパシタを追加**してタイミング調整する
  （= 載せた時点でタイミングが変わるが、その後の ON/OFF では変わらない）。

### 3.2 PDP-11/45（KT11-C）— ON だと遅くなる

- **KT11-C が装着され、かつ operating（有効）の場合、メモリ参照ごとに +0.09µs（90ns）** の
  命令時間増加がある。→ 11/45 では MMU ON は OFF より実際に遅い。
- リロケーションは「全プロセッサアドレスに固定定数を加算する」処理で、この加算器遅延が時間に乗る。

---

## 4. 本プロジェクトへの含意

- 本 RTL の「ON/OFF でタイミング不変」は **11/40 の挙動として正しい近似**。
- もし **11/45 を厳密に模す**なら、operating 時にメモリ参照ごと +0.09µs を入れる必要があるが、
  本 RTL はサイクル精度でそこまでは再現していない（11/40 近似で十分）。

---

## 5. 参考資料

- [PDP-11/40 — Computer History Wiki](https://gunkies.org/wiki/PDP-11/40)
- [KT11-D Memory Management Unit — Computer History Wiki](https://gunkies.org/wiki/KT11-D_Memory_Management_Unit)
- [Performance discussion — pidp-11 group](https://groups.google.com/g/pidp-11/c/tKPO2VjzxCE)
- [PDP-11/45 Memory Management Reference Manual (DEC-11-HGKTCB-D)](https://www.bitsavers.org/www.computer.museum.uq.edu.au/pdf/DEC-11-HGKTCB-D%20PDP-1145%20Memory%20Management%20Reference%20Manual.pdf)
- [KT11-C Memory Management Unit — Computer History Wiki](http://gunkies.org/wiki/KT11-C_Memory_Management_Unit)
- 関連: [40-cpu-テスト計画.md](?doc=40-cpu-テスト計画.md) / [21-バスサイクル実例.md](?doc=21-バスサイクル実例.md)
