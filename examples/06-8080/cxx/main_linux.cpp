// main_linux.cpp — CP/M 8080 Linux ターミナルフロントエンド
// 04-6502/cxx/main_linux.cpp と同じ構造

#include "version.h"
#include <cstdio>
#include <cstdlib>
#include <csignal>
#include <cstring>
#include <string>
#include <vector>
#include <cctype>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdint.h>

extern "C" {
    int      sim_init(const char* bios_path, const char* cpm_path, const char* dsk_path);
    int      sim_load_disk_file(int drive, const char* path);
    bool     sim_get_disk_dirty(int drive);
    int      sim_save_disk(int drive, const char* path);
    void     sim_set_disk_readonly(int drive, bool ro);
    void     step();
    void     send_key(uint8_t ch);
    int      get_display_char();
    int      sim_test(int max_cycles);
    int      sim_run_bin(const uint8_t* prog, int prog_size, int max_cycles);
    int      sim_run_bare(const uint8_t* prog, int prog_size, long long max_cycles, int idle_timeout_cycles);
    uint16_t get_pc();
    uint8_t  sim_read_byte(uint16_t addr);
    int      sim_get_cur_drive();
    int      sim_get_disk_track();
    int      sim_get_disk_sector();
    uint16_t sim_get_disk_dma();
    int      sim_con_in_space();
}

static struct termios g_saved_termios;

// 終了時に書き込まれたドライブを元のイメージファイルへ保存する
static const char*  g_dsk_paths[4]   = {};
static std::string  g_mounted_paths[4];  // !mount で動的に変更されたパス
static bool         g_no_save = false;

// !cap — コンソール出力キャプチャ
static FILE* g_cap_file = nullptr;

// !paste — テキストファイルをキーボード入力として流し込む
static uint8_t g_paste_buf[65536];
static int     g_paste_pos = 0;
static int     g_paste_len = 0;

// コマンドヒストリ (↑↓矢印キー)
static const int HISTORY_MAX = 100;
static std::vector<std::string> g_history;
static int         g_hist_idx  = -1;   // -1: 通常入力, 0+: ヒストリ参照中
static std::string g_input_line;       // 現在の入力行
static std::string g_saved_line;       // ヒストリ参照開始時に退避した入力
static int         g_esc_state = 0;    // ESC シーケンス解析状態 (0=通常, 1=ESC受信, 2=ESC[受信)

static void save_dirty_disks() {
    if (g_no_save) return;
    static const char* labels[] = {"A", "B", "C", "D"};
    for (int i = 0; i < 4; i++) {
        if (g_dsk_paths[i] && sim_get_disk_dirty(i)) {
            if (sim_save_disk(i, g_dsk_paths[i]) == 0)
                fprintf(stderr, "[saved %s: %s]\n", labels[i], g_dsk_paths[i]);
        }
    }
}

// !cap [file|off]
static void cmd_cap(const char* arg) {
    while (*arg == ' ') arg++;
    if (*arg == '\0' || strcmp(arg, "off") == 0) {
        if (g_cap_file) {
            fclose(g_cap_file); g_cap_file = nullptr;
            fputs("\r\n[cap] stopped\r\n", stderr);
        }
        return;
    }
    if (g_cap_file) fclose(g_cap_file);
    g_cap_file = fopen(arg, "w");
    if (g_cap_file) fprintf(stderr, "[cap] capturing to: %s\r\n", arg);
    else            fprintf(stderr, "[cap] cannot open: %s\r\n", arg);
}

// !paste <file>
static void cmd_paste(const char* arg) {
    while (*arg == ' ') arg++;
    FILE* f = fopen(arg, "r");
    if (!f) { fprintf(stderr, "[paste] cannot open: %s\r\n", arg); return; }
    g_paste_len = (int)fread(g_paste_buf, 1, sizeof(g_paste_buf) - 1, f);
    fclose(f);
    for (int i = 0; i < g_paste_len; i++)
        if (g_paste_buf[i] == '\n') g_paste_buf[i] = '\r';
    g_paste_pos = 0;
    fprintf(stderr, "[paste] %d bytes queued: %s\r\n", g_paste_len, arg);
}

// !mount <A-D>[:] <path>
static void cmd_mount(const char* arg) {
    while (*arg == ' ') arg++;
    if (!arg[0] || !arg[1]) { fprintf(stderr, "[mount] usage: !mount A: path\r\n"); return; }
    int drive = toupper((unsigned char)arg[0]) - 'A';
    if (drive < 0 || drive > 3) { fprintf(stderr, "[mount] invalid drive: %c\r\n", arg[0]); return; }
    const char* path = arg + 1;
    if (*path == ':') path++;
    while (*path == ' ') path++;
    if (!*path) { fprintf(stderr, "[mount] no path specified\r\n"); return; }
    if (sim_load_disk_file(drive, path) != 0) return;
    g_mounted_paths[drive] = path;
    g_dsk_paths[drive]     = g_mounted_paths[drive].c_str();
    static const char* DRV[] = {"A", "B", "C", "D"};
    fprintf(stderr, "[mount] %s: → %s\r\n", DRV[drive], path);
}

static void print_status() {
    auto pc_region = [](uint16_t pc) -> const char* {
        if (pc < 0x0100) return "page0";
        if (pc < 0xDC00) return "TPA";
        if (pc < 0xE400) return "CCP";
        if (pc < 0xF200) return "BDOS";
        return "BIOS";
    };
    auto dsk_label = [](const char* p) -> const char* {
        if (!p) return "(blank)";
        const char* s = strrchr(p, '/');
        return s ? s + 1 : p;
    };
    static const char* DRV[] = {"A", "B", "C", "D"};
    uint16_t pc = get_pc();
    fprintf(stderr, "\r--- [Ctrl+T] status ---\n");
    fprintf(stderr, "CPU   PC=%04X  [%s]\n", pc, pc_region(pc));
    fprintf(stderr, "Disk  drive=%s  trk=%d  sec=%d  dma=%04X\n",
            DRV[sim_get_cur_drive()], sim_get_disk_track(),
            sim_get_disk_sector(), sim_get_disk_dma());
    for (int i = 0; i < 4; i++)
        fprintf(stderr, "      %s: %-20s%s\n", DRV[i], dsk_label(g_dsk_paths[i]),
                sim_get_disk_dirty(i) ? " [dirty]" : "");
    fprintf(stderr, "\n");
}

static void restore_terminal() {
    tcsetattr(STDIN_FILENO, TCSANOW, &g_saved_termios);
}

static void on_signal(int) {
    if (g_cap_file) { fclose(g_cap_file); g_cap_file = nullptr; }
    save_dirty_disks();
    restore_terminal();
    _exit(0);
}

// バイナリのディレクトリを取得し、その親ディレクトリ基準でデフォルトパスを構築する。
// 例: /path/to/build/sim → /path/to/ が基準ディレクトリ
static std::string g_base;  // 末尾スラッシュあり

static void init_base_dir()
{
    char exe[4096] = {};
    ssize_t len = readlink("/proc/self/exe", exe, sizeof(exe) - 1);
    if (len <= 0) { g_base = ""; return; }
    exe[len] = '\0';

    // 最後の '/' を切り、さらにもう一つ上（build/ → 親）
    char* p = strrchr(exe, '/');
    if (p) *p = '\0';
    p = strrchr(exe, '/');
    if (p) *(p + 1) = '\0';  // 末尾スラッシュを残す

    g_base = exe;
}

static std::string def(const char* rel) { return g_base + rel; }

// "foo.dsk" → "foo.orig.dsk"
static std::string to_orig_path(const std::string& p) {
    size_t dot = p.rfind('.');
    if (dot != std::string::npos)
        return p.substr(0, dot) + ".orig" + p.substr(dot);
    return p + ".orig";
}

// .orig.dsk が存在しなければ src からコピーして原本を作成する
static void ensure_orig_file(const char* orig, const char* src) {
    if (access(orig, F_OK) == 0) return;
    FILE* in  = fopen(src,  "rb"); if (!in)  return;
    FILE* out = fopen(orig, "wb"); if (!out) { fclose(in); return; }
    char buf[4096]; size_t n;
    while ((n = fread(buf, 1, sizeof(buf), in)) > 0) fwrite(buf, 1, n, out);
    fclose(in); fclose(out);
    fprintf(stderr, "[orig] created: %s\n", orig);
}

int main(int argc, char* argv[]) {
    init_base_dir();

    // デフォルトパス: バイナリの親ディレクトリ（build/ の一つ上）基準
    std::string bios_def     = def("sw/cpm/bios/bios.bin");
    std::string cpm_def      = def("rom/cpm22.bin");
    std::string dsk_def      = def("sw/cpm/disks/cpm22.dsk");
    std::string dsk_b_def    = def("sw/cpm/disks/bdsc.dsk");
    std::string run_test_def = def("test/test_all.bin");

    const char* DEFAULT_BIOS     = bios_def.c_str();
    const char* DEFAULT_CPM      = cpm_def.c_str();
    const char* DEFAULT_DSK      = dsk_def.c_str();
    const char* DEFAULT_DSK_B    = dsk_b_def.c_str();
    const char* DEFAULT_RUN_TEST = run_test_def.c_str();

    const char* bios_path    = DEFAULT_BIOS;
    const char* cpm_path     = DEFAULT_CPM;
    const char* dsk_path     = DEFAULT_DSK;
    const char* dsk_b_path   = DEFAULT_DSK_B;
    const char* dsk_c_path   = nullptr;
    const char* dsk_d_path   = nullptr;
    bool        dsk_b_explicit = false;
    bool        opt_no_save    = false;
    bool        opt_ro         = false;
    bool        opt_orig       = false;

    bool        run_test         = false;
    bool        boot_test        = false;
    bool        ddt_ctrlc_test   = false;
    const char* run_test_bin     = nullptr;
    bool        run_test_default = false;
    const char* exec_cmd     = nullptr;
    const char* bare_test    = nullptr;
    for (int i = 1; i < argc; i++) {
        if      (!strcmp(argv[i], "-hj")) {
            fprintf(stdout,
                CPM_SIM_BANNER "\n"
                "\n"
                "使い方: cpm [オプション]\n"
                "\n"
                "動作モード (省略時: インタラクティブ CP/M):\n"
                "  -h, --help               英語ヘルプを表示して終了\n"
                "  -hj                      日本語ヘルプを表示して終了\n"
                "  --test                   ハーネス動作確認 (MVI+OUT+HLT)\n"
                "  --boot-test              CP/M 起動テスト (A> プロンプト検出)\n"
                "  --run-test [ファイル]    ベアメタルバイナリを実行して合否判定\n"
                "                           (省略時: <binary>/../test/test_all.bin)\n"
                "  --bare-test <ファイル>   ベアメタルバイナリを実行 (タイムアウト延長)\n"
                "  --exec <コマンド>        CP/M 起動後にコマンドを実行して出力を表示\n"
                "\n"
                "ファイルオプション (省略時はバイナリの親ディレクトリ基準):\n"
                "  --bios <パス>            BIOS バイナリ     (省略時: <binary>/../sw/cpm/bios/bios.bin)\n"
                "  --cpm  <パス>            CCP+BDOS バイナリ (省略時: <binary>/../rom/cpm22.bin)\n"
                "  --disk <パス>            ドライブ A: イメージ (省略時: .../sw/cpm/disks/cpm22.dsk)\n"
                "  --disk-b <パス>          ドライブ B: イメージ (省略時: bdsc.dsk)\n"
                "  --disk-c <パス>          ドライブ C: イメージ (省略時: ブランク)\n"
                "  --disk-d <パス>          ドライブ D: イメージ (省略時: ブランク)\n"
                "  --orig                   .orig.dsk から読み込み・保存先は .dsk (原本を常に保持)\n"
                "                           初回実行時に .dsk → .orig.dsk をコピーして原本を作成\n"
                "  --no-save                終了時にディスクイメージを上書きしない\n"
                "  --ro                     全ドライブ読み取り専用 (書き込み無視・保存なし)\n"
                "\n"
                "使用例:\n"
                "  cpm                                  インタラクティブ CP/M\n"
                "  cpm --test                           動作確認\n"
                "  cpm --boot-test                      起動テスト\n"
                "  cpm --run-test                       命令テストスイート実行\n"
                "  cpm --exec 8080EX1                   CPU エクササイザ実行\n"
                "  cpm --exec DIR                       DIR コマンド実行\n"
                "  cpm --bare-test prog.bin             ベアメタルテスト実行\n"
                "  cpm --orig                           原本ディスクで起動\n");
            return 0;
        }
        else if (!strcmp(argv[i], "-h") || !strcmp(argv[i], "--help")) {
            fprintf(stdout,
                CPM_SIM_BANNER "\n"
                "\n"
                "Usage: cpm [options]\n"
                "\n"
                "Modes (default: interactive CP/M):\n"
                "  -h, --help               Show this help and exit\n"
                "  -hj                      Show this help in Japanese and exit\n"
                "  --test                   Harness smoke test (MVI+OUT+HLT)\n"
                "  --boot-test              CP/M boot test (detect A> prompt)\n"
                "  --run-test [file]        Run bare-metal binary and report pass/fail\n"
                "                           (default: <binary>/../test/test_all.bin)\n"
                "  --bare-test <file>       Run bare-metal binary (extended timeout)\n"
                "  --exec <cmd>             Boot CP/M, run command, print output\n"
                "\n"
                "File options (defaults resolved relative to binary):\n"
                "  --bios <path>            BIOS binary     (default: <binary>/../sw/cpm/bios/bios.bin)\n"
                "  --cpm  <path>            CCP+BDOS binary (default: <binary>/../rom/cpm22.bin)\n"
                "  --disk <path>            Drive A: image  (default: <binary>/../sw/cpm/disks/cpm22.dsk)\n"
                "  --disk-b <path>          Drive B: image  (default: bdsc.dsk)\n"
                "  --disk-c <path>          Drive C: image  (default: blank)\n"
                "  --disk-d <path>          Drive D: image  (default: blank)\n"
                "  --orig                   Load from .orig.dsk (pristine original); save to .dsk\n"
                "                           On first use, copies .dsk -> .orig.dsk to create the original\n"
                "  --no-save                Do not overwrite disk images on exit\n"
                "  --ro                     All drives read-only (writes ignored, no save)\n"
                "\n"
                "Examples:\n"
                "  cpm                                  Interactive CP/M\n"
                "  cpm --test                           Smoke test\n"
                "  cpm --boot-test                      Boot test\n"
                "  cpm --run-test                       Run instruction test suite\n"
                "  cpm --exec 8080EX1                   Run CPU exerciser\n"
                "  cpm --exec DIR                       Run DIR command\n"
                "  cpm --bare-test prog.bin             Run bare-metal test\n"
                "  cpm --orig                           Start with pristine disk\n");
            return 0;
        }
        else if (!strcmp(argv[i], "--test"))       run_test     = true;
        else if (!strcmp(argv[i], "--boot-test"))  boot_test    = true;
        else if (!strcmp(argv[i], "--run-test")) {
            // 次の引数がオプションでなければファイルパスとして取る
            if (i+1 < argc && argv[i+1][0] != '-') run_test_bin = argv[++i];
            else { run_test_bin = DEFAULT_RUN_TEST; run_test_default = true; }
        }
        else if (!strcmp(argv[i], "--exec")      && i+1<argc)  exec_cmd  = argv[++i];
        else if (!strcmp(argv[i], "--bare-test") && i+1<argc)  bare_test = argv[++i];
        else if (!strcmp(argv[i], "--ddt-ctrlc-test")) ddt_ctrlc_test = true;
        else if (!strcmp(argv[i], "--bios")      && i+1<argc)  bios_path  = argv[++i];
        else if (!strcmp(argv[i], "--cpm")       && i+1<argc)  cpm_path   = argv[++i];
        else if (!strcmp(argv[i], "--disk")      && i+1<argc)  dsk_path   = argv[++i];
        else if (!strcmp(argv[i], "--disk-b")    && i+1<argc) { dsk_b_path = argv[++i]; dsk_b_explicit = true; }
        else if (!strcmp(argv[i], "--disk-c")    && i+1<argc)  dsk_c_path = argv[++i];
        else if (!strcmp(argv[i], "--disk-d")    && i+1<argc)  dsk_d_path = argv[++i];
        else if (!strcmp(argv[i], "--orig"))                   opt_orig    = true;
        else if (!strcmp(argv[i], "--no-save"))                opt_no_save = true;
        else if (!strcmp(argv[i], "--ro"))                     opt_ro      = true;
    }

    // デフォルトの B: ディスク (bdsc.dsk) が存在しない場合は黙って B: ブランクにする。
    // 明示指定 (--disk-b) の場合はファイルなしをエラーとする。
    if (!dsk_b_explicit && dsk_b_path && access(dsk_b_path, R_OK) != 0)
        dsk_b_path = nullptr;

    if (run_test) {
        int n = sim_test(100000);
        return n >= 2 ? 0 : 1;
    }

    if (boot_test) {
        if (sim_init(bios_path, cpm_path, dsk_path) != 0) return 1;
        if (dsk_b_path && sim_load_disk_file(1, dsk_b_path) != 0) return 1;
        if (dsk_c_path && sim_load_disk_file(2, dsk_c_path) != 0) return 1;
        if (dsk_d_path && sim_load_disk_file(3, dsk_d_path) != 0) return 1;

        char   output[8192] = {};
        int    out_pos       = 0;
        bool   found_prompt  = false;
        int    last_out_step = -1;

        for (int s = 0; s < 10000000 && !found_prompt; s++) {
            step();

            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output) - 1) {
                char c = (char)(ch & 0x7F);
                output[out_pos++] = c;
                last_out_step = s;
                if (out_pos >= 2 &&
                    output[out_pos - 2] == 'A' &&
                    output[out_pos - 1] == '>') {
                    found_prompt = true;
                }
            }
            if (last_out_step >= 0 && (s - last_out_step) > 2000000)
                break;
        }
        output[out_pos] = '\0';
        fprintf(stdout, "%s", output);
        fflush(stdout);
        if (found_prompt) {
            fprintf(stdout, "\n--- CP/M boot: OK (A> found) ---\n");
            return 0;
        } else {
            fprintf(stdout, "\n--- CP/M boot: FAIL (A> not found, %d chars) ---\n", out_pos);
            return 1;
        }
    }

    // --ddt-ctrlc-test: DDT 起動 → Ctrl+C → 10M サイクル出力を確認
    // stderr に [DBG] CONOUT '.' PC=... が出ればその PC が原因特定できる
    if (ddt_ctrlc_test) {
        if (sim_init(bios_path, cpm_path, dsk_path) != 0) return 1;
        if (dsk_b_path && sim_load_disk_file(1, dsk_b_path) != 0) return 1;

        char output[65536] = {};
        int  out_pos = 0;
        bool found_prompt = false;

        // Phase 1: A> 待ち
        for (int s = 0; s < 10000000 && !found_prompt; s++) {
            step();
            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output)-1) {
                char c = (char)(ch & 0x7F);
                output[out_pos++] = c;
                if (out_pos >= 2 && output[out_pos-2]=='A' && output[out_pos-1]=='>')
                    found_prompt = true;
            }
        }
        if (!found_prompt) { fprintf(stderr, "boot failed\n"); return 1; }

        // Phase 2: DDT\r を送る → "-" プロンプト待ち
        for (const char* p = "DDT"; *p; p++) send_key((uint8_t)*p);
        send_key('\r');

        bool found_ddt = false;
        for (int s = 0; s < 5000000 && !found_ddt; s++) {
            step();
            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output)-1) {
                char c = (char)(ch & 0x7F);
                output[out_pos++] = c;
                if (c == '-') found_ddt = true;
            }
        }
        fprintf(stderr, "DDT prompt %s\n", found_ddt ? "found" : "NOT found");

        // Phase 3: Ctrl+C → 10M サイクル実行して出力を捕捉
        send_key(0x03);  // Ctrl+C
        int pre = out_pos;
        for (int s = 0; s < 10000000; s++) {
            step();
            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output)-1) {
                output[out_pos++] = (char)(ch & 0x7F);
            }
        }
        output[out_pos] = '\0';
        fprintf(stdout, "=== output after Ctrl+C (%d chars) ===\n", out_pos - pre);
        for (int i = pre; i < out_pos; i++) fputc(output[i], stdout);
        fputc('\n', stdout);
        return 0;
    }

    // --exec <cmd>: CP/M を起動してコマンドを実行し、出力を表示する
    // 終了条件: "Tests complete" が現れるか、無出力タイムアウト
    if (exec_cmd) {
        if (sim_init(bios_path, cpm_path, dsk_path) != 0) return 1;
        if (dsk_b_path && sim_load_disk_file(1, dsk_b_path) != 0) return 1;
        if (dsk_c_path && sim_load_disk_file(2, dsk_c_path) != 0) return 1;
        if (dsk_d_path && sim_load_disk_file(3, dsk_d_path) != 0) return 1;

        char   output[524288] = {};  // 512KB 出力バッファ
        int    out_pos        = 0;
        bool   found_prompt   = false;
        bool   cmd_sent       = false;
        bool   tests_complete = false;
        int    last_out_step  = -1;

        // Phase 1: CP/M 起動待ち (最大 10M ステップ)
        for (int s = 0; s < 10000000 && !found_prompt; s++) {
            step();
            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output) - 1) {
                char c = (char)(ch & 0x7F);

                output[out_pos++] = c;
                last_out_step = s;
                if (out_pos >= 2 &&
                    output[out_pos - 2] == 'A' &&
                    output[out_pos - 1] == '>') {
                    found_prompt = true;
                }
            }
            if (last_out_step >= 0 && (s - last_out_step) > 2000000) break;
        }

        if (!found_prompt) {
            fprintf(stderr, "CP/M boot failed (A> not found)\n");
            return 1;
        }

        // Phase 2: コマンド送信
        for (const char* p = exec_cmd; *p; p++) {
            uint8_t k = (uint8_t)*p;
            send_key(k);
        }
        send_key('\r');

        // Phase 3: コマンド実行・出力待ち (最大 2 billion ステップ)
        // 終了: "Tests complete" または無出力タイムアウト 5M ステップ
        last_out_step = -1;
        for (long long s = 0; s < 2000000000LL && !tests_complete; s++) {
            step();
            int ch;
            while ((ch = get_display_char()) >= 0 && out_pos < (int)sizeof(output) - 1) {
                char c = (char)(ch & 0x7F);
    
                output[out_pos++] = c;
                last_out_step = (int)(s & 0x7FFFFFFF);
                // 完了検出: "Tests complete" または "Press a key" で終了
                if ((out_pos >= 14 &&
                     strncmp(output + out_pos - 14, "Tests complete", 14) == 0) ||
                    (out_pos >= 11 &&
                     strncmp(output + out_pos - 11, "Press a key", 11) == 0)) {
                    tests_complete = true;
                }
            }
            // 最後の出力から 5M ステップ無変化 → 打ち切り
            if (last_out_step >= 0) {
                int idle = (int)(s & 0x7FFFFFFF) - last_out_step;
                if (idle < 0) idle += 0x7FFFFFFF;  // wrap around
                if (idle > 5000000) break;
            }
        }

        output[out_pos] = '\0';
        fprintf(stdout, "%s", output);
        fflush(stdout);

        if (tests_complete) {
            bool all_ok = (strstr(output, "ERROR") == nullptr);
            fprintf(stdout, "\n--- exec '%s': %s ---\n",
                    exec_cmd, all_ok ? "ALL OK" : "ERRORS FOUND");
            return all_ok ? 0 : 1;
        } else {
            fprintf(stdout, "\n--- exec '%s': TIMEOUT (no 'Tests complete', %d chars) ---\n",
                    exec_cmd, out_pos);
            return 1;
        }
    }

    // --bare-test <file>: バイナリを 0x0000 に配置してベアメタル実行
    // CP/M なし。完了マーカー検出または無出力タイムアウト 5M サイクルで終了。
    if (bare_test) {
        FILE* f = fopen(bare_test, "rb");
        if (!f) { fprintf(stderr, "cannot open: %s\n", bare_test); return 1; }
        fseek(f, 0, SEEK_END);
        long sz = ftell(f);
        rewind(f);
        uint8_t* buf = (uint8_t*)malloc(sz);
        if (fread(buf, 1, sz, f) != (size_t)sz) {
            fprintf(stderr, "read error: %s\n", bare_test);
            free(buf); return 1;
        }
        fclose(f);

        // sim_run_bare: 最大 20G サイクル、アイドルタイムアウト 200M サイクル
        int n = sim_run_bare(buf, (int)sz, 20000000000LL, 200000000);
        free(buf);

        char   output[131072] = {};
        int    out_pos        = 0;
        bool   done           = false;
        for (int i = 0; i < n; i++) {
            int ch = get_display_char();
            if (ch < 0) break;
            char c = (char)(ch & 0x7F);

            if (out_pos < (int)sizeof(output) - 1)
                output[out_pos++] = c;
            if ((out_pos >= 11 &&
                 strncmp(output + out_pos - 11, "Press a key", 11) == 0) ||
                (out_pos >= 14 &&
                 strncmp(output + out_pos - 14, "Tests complete", 14) == 0)) {
                done = true;
            }
        }
        output[out_pos] = '\0';
        fprintf(stdout, "%s\n", output);
        fflush(stdout);

        bool has_error = (strstr(output, "ERROR") != nullptr ||
                          strstr(output, "FAIL")  != nullptr);
        fprintf(stdout, "--- bare-test '%s': %s (%d chars) ---\n",
                bare_test,
                (done && !has_error) ? "OK" : (has_error ? "ERRORS" : "TIMEOUT"),
                out_pos);
        return (done && !has_error) ? 0 : 1;
    }

    if (run_test_bin) {
        if (run_test_default)
            fprintf(stdout, "run-test: %s\n", run_test_bin);
        FILE* f = fopen(run_test_bin, "rb");
        if (!f) { fprintf(stderr, "cannot open: %s\n", run_test_bin); return 1; }
        fseek(f, 0, SEEK_END);
        long sz = ftell(f);
        rewind(f);
        uint8_t* buf = (uint8_t*)malloc(sz);
        if (fread(buf, 1, sz, f) != (size_t)sz) {
            fprintf(stderr, "read error: %s\n", run_test_bin);
            free(buf); return 1;
        }
        fclose(f);

        int n = sim_run_bin(buf, (int)sz, 2000000);
        free(buf);

        // CONOUT 出力を表示して合否を判定
        // g_con_out_buf は harness 内部なので get_display_char() で読む
        bool all_pass = true;
        int  groups   = 0;
        for (int i = 0; i < n; i++) {
            char c = (char)(get_display_char() & 0x7F);
            fputc(c, stdout);
            if (c == 'P') groups++;
            if (c == 'F') { all_pass = false; groups++; }
        }
        fflush(stdout);
        printf("\n--- %d group(s) tested: %s ---\n", groups, all_pass ? "ALL PASS" : "FAIL");
        return all_pass ? 0 : 1;
    }

    tcgetattr(STDIN_FILENO, &g_saved_termios);
    atexit(restore_terminal);
    signal(SIGINT,  on_signal);
    signal(SIGTERM, on_signal);

    struct termios raw = g_saved_termios;
    cfmakeraw(&raw);
    raw.c_oflag |= OPOST;
    raw.c_cc[VMIN]  = 0;
    raw.c_cc[VTIME] = 0;
    tcsetattr(STDIN_FILENO, TCSANOW, &raw);

    int fl = fcntl(STDIN_FILENO, F_GETFL);
    fcntl(STDIN_FILENO, F_SETFL, fl | O_NONBLOCK);

    // --orig: .orig.dsk から読み込む。なければ現在の .dsk を原本としてコピー作成。
    // 保存先は通常の .dsk のままなので g_dsk_paths は変更しない。
    std::string orig_a, orig_b, orig_c, orig_d;
    const char* load_a = dsk_path;
    const char* load_b = dsk_b_path;
    const char* load_c = dsk_c_path;
    const char* load_d = dsk_d_path;
    if (opt_orig) {
        auto prep = [](const char* src, std::string& buf) -> const char* {
            if (!src) return nullptr;
            buf = to_orig_path(src);
            ensure_orig_file(buf.c_str(), src);
            return buf.c_str();
        };
        load_a = prep(dsk_path,   orig_a);
        load_b = prep(dsk_b_path, orig_b);
        load_c = prep(dsk_c_path, orig_c);
        load_d = prep(dsk_d_path, orig_d);
    }

    if (sim_init(bios_path, cpm_path, load_a) != 0) {
        restore_terminal();
        return 1;
    }
    if (load_b && sim_load_disk_file(1, load_b) != 0) { restore_terminal(); return 1; }
    if (load_c && sim_load_disk_file(2, load_c) != 0) { restore_terminal(); return 1; }
    if (load_d && sim_load_disk_file(3, load_d) != 0) { restore_terminal(); return 1; }

    // --no-save / --ro フラグを適用（--orig は保存あり）
    g_no_save = opt_no_save || opt_ro;
    if (opt_ro) {
        for (int i = 0; i < 4; i++) sim_set_disk_readonly(i, true);
    }

    // 終了時保存のためパスを登録（--orig でも保存先は通常の .dsk）
    g_dsk_paths[0] = dsk_path;
    g_dsk_paths[1] = dsk_b_path;
    g_dsk_paths[2] = dsk_c_path;
    g_dsk_paths[3] = dsk_d_path;

    // パスからファイル名だけを取り出すヘルパー
    auto dsk_name = [](const char* p) -> const char* {
        if (!p) return "(blank)";
        const char* s = strrchr(p, '/');
        return s ? s + 1 : p;
    };
    fprintf(stderr, CPM_SIM_BANNER "\n");
    fprintf(stderr, "[quit: Ctrl+\\]\n");
    fprintf(stderr, "  A: %-16s B: %-16s C: %-16s D: %s\n",
            dsk_name(dsk_path), dsk_name(dsk_b_path),
            dsk_name(dsk_c_path), dsk_name(dsk_d_path));
    if (opt_ro)           fprintf(stderr, "  [read-only: writes ignored]\n");
    else if (opt_orig)    fprintf(stderr, "  [orig: load from .orig.dsk / save to .dsk]\n");
    else if (opt_no_save) fprintf(stderr, "  [no-save: disk images will not be saved on exit]\n");

    // ! シェルエスケープ用バッファ
    // chars_sent: 最後の \r 以降に CP/M へ送った文字数
    // shell_len>0 の間はシェルコマンド蓄積中
    char shell_buf[256];
    int  shell_len  = 0;
    int  chars_sent = 0;

    for (;;) {
        for (int i = 0; i < 1000; i++) step();

        int ch;
        while ((ch = get_display_char()) >= 0) {
            char c = (char)(ch & 0x7F);
            fputc(c, stdout);
            if (g_cap_file) fputc(c, g_cap_file);
            fflush(stdout);
        }
        if (g_cap_file) fflush(g_cap_file);

        // !paste ドリップ: con_in に空きがある分だけ流し込む
        if (g_paste_pos < g_paste_len) {
            int space = sim_con_in_space();
            int feed  = g_paste_len - g_paste_pos;
            if (feed > space) feed = space;
            if (feed > 16)    feed = 16;
            for (int j = 0; j < feed; j++) send_key(g_paste_buf[g_paste_pos++]);
            if (g_paste_pos >= g_paste_len) {
                g_paste_len = g_paste_pos = 0;
                fprintf(stderr, "\r\n[paste] done\r\n");
            }
        }

        char buf[64];
        ssize_t n = read(STDIN_FILENO, buf, sizeof(buf));
        for (ssize_t i = 0; i < n; i++) {
            uint8_t k = (uint8_t)buf[i];
            if (k == 28)   { on_signal(0); }    // Ctrl+\ — quit
            if (k == 0x14) { print_status(); continue; }  // Ctrl+T — status

            // ---- ! シェルエスケープ ----
            if (shell_len > 0) {
                if (k == '\r' || k == '\n') {
                    shell_buf[shell_len] = '\0';
                    fputs("\r\n", stdout); fflush(stdout);
                    const char* cmd = shell_buf + 1;
                    while (*cmd == ' ') cmd++;
                    // ---- ビルトインコマンド ----
                    if (strncmp(cmd, "cap", 3) == 0 && (cmd[3] == ' ' || cmd[3] == '\0'))
                        cmd_cap(cmd + 3);
                    else if (strncmp(cmd, "paste ", 6) == 0)
                        cmd_paste(cmd + 6);
                    else if (strncmp(cmd, "mount ", 6) == 0)
                        cmd_mount(cmd + 6);
                    else {
                        // シェルコマンド
                        std::string shell_cmd = std::string(cmd) + " 2>&1";
                        FILE* fp = popen(shell_cmd.c_str(), "r");
                        if (fp) {
                            char line[512];
                            while (fgets(line, sizeof(line), fp)) {
                                for (char* p = line; *p; p++) {
                                    if (*p == '\n') fputs("\r\n", stdout);
                                    else            fputc(*p, stdout);
                                }
                            }
                            pclose(fp);
                        } else {
                            fputs("!: failed to execute\r\n", stdout);
                        }
                        fflush(stdout);
                    }
                    shell_len  = 0;
                    chars_sent = 0;
                    g_input_line.clear();
                    g_hist_idx = -1;
                    send_key('\r');   // CP/M に空行を送って再プロンプト
                } else if ((k == 127 || k == 8) && shell_len > 1) {
                    shell_len--;
                    fputs("\b \b", stdout); fflush(stdout);
                } else if (k >= 0x20 && shell_len < (int)sizeof(shell_buf) - 2) {
                    shell_buf[shell_len++] = (char)k;
                    fputc(k, stdout); fflush(stdout);
                }
                continue;
            }

            if (k == '!' && chars_sent == 0) {
                // ! が行頭 → シェルエスケープ開始
                shell_buf[0] = '!';
                shell_len    = 1;
                fputc('!', stdout); fflush(stdout);
                continue;
            }

            // ---- ESC シーケンス解析 (↑↓矢印でヒストリ) ----
            if (g_esc_state == 1) {
                g_esc_state = (k == '[') ? 2 : 0;
                continue;
            }
            if (g_esc_state == 2) {
                g_esc_state = 0;
                int hist_size = (int)g_history.size();
                if ((k == 'A' || k == 'B') && hist_size > 0) {
                    int new_idx;
                    if (k == 'A') {  // ↑: 古いエントリへ
                        if (g_hist_idx >= hist_size - 1) { continue; }
                        if (g_hist_idx == -1) g_saved_line = g_input_line;
                        new_idx = g_hist_idx + 1;
                    } else {         // ↓: 新しいエントリへ
                        if (g_hist_idx <= -1) { continue; }
                        new_idx = g_hist_idx - 1;
                    }
                    // 現在の入力を消去 (CP/M に BS を送る)
                    for (size_t j = 0; j < g_input_line.size(); j++) send_key(0x08);
                    g_hist_idx   = new_idx;
                    g_input_line = (g_hist_idx == -1)
                                   ? g_saved_line
                                   : g_history[hist_size - 1 - g_hist_idx];
                    for (uint8_t c : g_input_line) send_key(c);
                    chars_sent = (int)g_input_line.size();
                }
                continue;
            }
            if (k == 0x1B) { g_esc_state = 1; continue; }

            // ---- 通常の CP/M 入力 ----
            if (k == 127) k = 8;
            if (k == '\n') k = '\r';
            if (k == '\r') {
                // Enter: ヒストリに追加 (空行・直前と同じ内容は除外)
                if (!g_input_line.empty() &&
                    (g_history.empty() || g_history.back() != g_input_line)) {
                    g_history.push_back(g_input_line);
                    if ((int)g_history.size() > HISTORY_MAX)
                        g_history.erase(g_history.begin());
                }
                g_input_line.clear();
                g_hist_idx = -1;
                chars_sent = 0;
            } else if (k == 8) {
                if (!g_input_line.empty()) g_input_line.pop_back();
                if (chars_sent > 0) chars_sent--;
            } else if (k >= 0x20) {
                g_input_line += (char)k;
                g_hist_idx = -1;  // 文字入力でヒストリナビ終了
                chars_sent++;
            }
            send_key(k);
        }
    }

    return 0;
}
