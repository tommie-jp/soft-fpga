// Apple-1 Linux ターミナルフロントエンド
// raw termios + 非ブロッキング stdin でキーボード入力を harness に渡し、
// harness の表示キューから文字を受け取って stdout に出力する。

#include <cstdio>
#include <cstdlib>
#include <csignal>
#include <cstring>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdint.h>

extern "C" {
    void     sim_init();
    void     step();
    void     send_key(uint8_t ch);
    int      get_display_char();
}

static struct termios g_saved_termios;

static void restore_terminal() {
    tcsetattr(STDIN_FILENO, TCSANOW, &g_saved_termios);
}

static void on_signal(int) {
    restore_terminal();
    _exit(0);
}

int main() {
    // raw モードに切り替え
    tcgetattr(STDIN_FILENO, &g_saved_termios);
    atexit(restore_terminal);
    signal(SIGINT,  on_signal);
    signal(SIGTERM, on_signal);

    struct termios raw = g_saved_termios;
    cfmakeraw(&raw);
    raw.c_oflag |= OPOST;  // cfmakeraw が落とす OPOST を復元: \n → \r\n に変換される
    raw.c_cc[VMIN]  = 0;   // 非ブロッキング read
    raw.c_cc[VTIME] = 0;
    tcsetattr(STDIN_FILENO, TCSANOW, &raw);

    // stdin を非ブロッキングに
    int fl = fcntl(STDIN_FILENO, F_GETFL);
    fcntl(STDIN_FILENO, F_SETFL, fl | O_NONBLOCK);

    sim_init();

    // Apple-1 は大文字のみ / CR で確定
    // Ctrl+C はシグナル経由でなく read() で拾う (raw モードなので SIG_INT はマスクされる)
    for (;;) {
        // 1000 サイクル進める
        for (int i = 0; i < 1000; i++) step();

        // 表示キューを flush
        int ch;
        while ((ch = get_display_char()) >= 0) {
            char c = (char)(ch & 0x7F);
            if (c == '\r') c = '\n';
            fputc(c, stdout);
            fflush(stdout);
        }

        // キーボード入力を読み取り
        char buf[64];
        ssize_t n = read(STDIN_FILENO, buf, sizeof(buf));
        for (ssize_t i = 0; i < n; i++) {
            uint8_t k = (uint8_t)buf[i];
            if (k == 3) { on_signal(0); }      // Ctrl+C
            if (k == 127) k = 8;               // BS (backspace)
            if (k == '\n') k = '\r';           // LF → CR (Apple-1 は CR で確定)
            send_key(k);
        }
    }

    return 0;
}
