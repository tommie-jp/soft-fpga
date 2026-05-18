// main_linux.cpp — CP/M 8080 Linux ターミナルフロントエンド
// 04-6502/cxx/main_linux.cpp と同じ構造

#include <cstdio>
#include <cstdlib>
#include <csignal>
#include <cstring>
#include <string>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdint.h>

extern "C" {
    int      sim_init(const char* bios_path, const char* cpm_path, const char* dsk_path);
    void     step();
    void     send_key(uint8_t ch);
    int      get_display_char();
    int      sim_test(int max_cycles);
    int      sim_run_bin(const uint8_t* prog, int prog_size, int max_cycles);
    int      sim_run_bare(const uint8_t* prog, int prog_size, long long max_cycles, int idle_timeout_cycles);
    uint16_t get_pc();
    uint8_t  sim_read_byte(uint16_t addr);
}

static struct termios g_saved_termios;

static void restore_terminal() {
    tcsetattr(STDIN_FILENO, TCSANOW, &g_saved_termios);
}

static void on_signal(int) {
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

int main(int argc, char* argv[]) {
    init_base_dir();

    // デフォルトパス: バイナリの親ディレクトリ（build/ の一つ上）基準
    std::string bios_def     = def("sw/cpm/bios/bios.bin");
    std::string cpm_def      = def("rom/cpm22.bin");
    std::string dsk_def      = def("sw/cpm/disks/cpm22.dsk");
    std::string run_test_def = def("test/test_all.bin");

    const char* DEFAULT_BIOS     = bios_def.c_str();
    const char* DEFAULT_CPM      = cpm_def.c_str();
    const char* DEFAULT_DSK      = dsk_def.c_str();
    const char* DEFAULT_RUN_TEST = run_test_def.c_str();

    const char* bios_path    = DEFAULT_BIOS;
    const char* cpm_path     = DEFAULT_CPM;
    const char* dsk_path     = DEFAULT_DSK;

    bool        run_test         = false;
    bool        boot_test        = false;
    bool        ddt_ctrlc_test   = false;
    const char* run_test_bin     = nullptr;
    bool        run_test_default = false;
    const char* exec_cmd     = nullptr;
    const char* bare_test    = nullptr;
    for (int i = 1; i < argc; i++) {
        if      (!strcmp(argv[i], "-h") || !strcmp(argv[i], "--help")) {
            fprintf(stdout,
                "使い方: cpm [オプション]\n"
                "\n"
                "動作モード（省略時: 対話型 CP/M 起動）:\n"
                "  -h, --help               このヘルプを表示して終了\n"
                "  --test                   ハーネス内蔵スモークテスト (MVI+OUT+HLT)\n"
                "  --boot-test              CP/M ブートテスト (A> プロンプト検出)\n"
                "  --run-test [file]        ベアメタルバイナリを実行して P/F 判定\n"
                "                           (省略時の既定: <binary>/../test/test_all.bin)\n"
                "  --bare-test <file>       ベアメタルバイナリを実行 (長時間タイムアウト)\n"
                "  --exec <cmd>             CP/M 起動後にコマンドを実行し出力を表示\n"
                "\n"
                "ファイル指定（省略時はデフォルトパスを使用）:\n"
                "  --bios <path>            BIOS バイナリ        (既定: <binary>/../sw/cpm/bios/bios.bin)\n"
                "  --cpm  <path>            CCP+BDOS バイナリ    (既定: <binary>/../rom/cpm22.bin)\n"
                "  --disk <path>            DSK イメージ         (既定: <binary>/../sw/cpm/disks/cpm22.dsk)\n"
                "\n"
                "使用例:\n"
                "  cpm                                  対話型 CP/M\n"
                "  cpm --test                           スモークテスト\n"
                "  cpm --boot-test                      ブートテスト\n"
                "  cpm --run-test                       命令テストスイート実行\n"
                "  cpm --exec 8080EX1                   CPU エクササイザ実行\n"
                "  cpm --exec DIR                       DIR コマンド実行\n"
                "  cpm --bare-test prog.bin             ベアメタルテスト実行\n");
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
        else if (!strcmp(argv[i], "--bios")      && i+1<argc)  bios_path = argv[++i];
        else if (!strcmp(argv[i], "--cpm")       && i+1<argc)  cpm_path  = argv[++i];
        else if (!strcmp(argv[i], "--disk")      && i+1<argc)  dsk_path  = argv[++i];
    }

    if (run_test) {
        int n = sim_test(100000);
        return n >= 2 ? 0 : 1;
    }

    if (boot_test) {
        if (sim_init(bios_path, cpm_path, dsk_path) != 0) return 1;

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
            if (last_out_step >= 0 && (s - last_out_step) > 200000)
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
            if (last_out_step >= 0 && (s - last_out_step) > 200000) break;
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

    if (sim_init(bios_path, cpm_path, dsk_path) != 0) {
        restore_terminal();
        return 1;
    }

    for (;;) {
        for (int i = 0; i < 1000; i++) step();

        int ch;
        while ((ch = get_display_char()) >= 0) {
            char c = (char)(ch & 0x7F);
            fputc(c, stdout);
            fflush(stdout);
        }

        char buf[64];
        ssize_t n = read(STDIN_FILENO, buf, sizeof(buf));
        for (ssize_t i = 0; i < n; i++) {
            uint8_t k = (uint8_t)buf[i];
            if (k == 28) { on_signal(0); }   // Ctrl+\ でシミュレータ終了
            if (k == 127) k = 8;
            if (k == '\n') k = '\r';
            send_key(k);                      // Ctrl+C (0x03) はエミュレータに渡す
        }
    }

    return 0;
}
