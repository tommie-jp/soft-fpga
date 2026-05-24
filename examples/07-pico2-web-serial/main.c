/**
 * main.c — Pico 2 (RP2350) ADC サンプラー (COBS+バイナリ, 1 kSPS)
 *
 * 配線:
 *   GP26 (ADC0) — CH0 入力
 *   GP27 (ADC1) — CH1 入力
 *
 * プロトコル:
 *   Frame(8 bytes) を COBS エンコードして USB-CDC へ送出。
 *   各フレームは 0x00 バイトで終端される。
 */

#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "pico/time.h"
#include "hardware/adc.h"

/* ------------------------------------------------------------------ */
/* フレーム定義                                                         */
/* ------------------------------------------------------------------ */
typedef struct __attribute__((packed)) {
    uint32_t ts_ms; /* タイムスタンプ [ms], little-endian */
    uint16_t ch0;   /* ADC0 raw 12-bit (0-4095) */
    uint16_t ch1;   /* ADC1 raw 12-bit (0-4095) */
} Frame;            /* 8 bytes */

/* ------------------------------------------------------------------ */
/* COBS エンコーダ                                                      */
/* ------------------------------------------------------------------ */
/**
 * src[0..n-1] を COBS エンコードして dst へ書き出す。
 * dst のサイズは n + n/254 + 2 バイト以上確保すること。
 * 戻り値: dst に書いたバイト数（末尾 0x00 を含む）。
 */
static size_t cobs_encode(const uint8_t *src, size_t n, uint8_t *dst) {
    size_t ri = 0, wi = 1, ci = 0;
    uint8_t code = 1;
    while (ri < n) {
        if (src[ri] == 0x00) {
            dst[ci] = code;
            code    = 1;
            ci      = wi++;
        } else {
            dst[wi++] = src[ri];
            if (++code == 0xFF) {
                dst[ci] = 0xFF;
                code    = 1;
                ci      = wi++;
            }
        }
        ri++;
    }
    dst[ci]    = code;
    dst[wi++]  = 0x00; /* フレーム区切り */
    return wi;
}

/* ------------------------------------------------------------------ */
/* エントリポイント                                                      */
/* ------------------------------------------------------------------ */
int main(void) {
    /* USB-CDC の初期化 */
    stdio_usb_init();

    /* USB 接続待ち（最大 5 秒） */
    for (int i = 0; i < 50; i++) {
        if (stdio_usb_connected()) break;
        sleep_ms(100);
    }

    /* ADC 初期化 */
    adc_init();

    adc_gpio_init(26); /* GP26 = ADC0 */
    adc_gpio_init(27); /* GP27 = ADC1 */

    /* 送信バッファ: Frame(8) + COBS overhead(最大 2) + 区切り(1) = 11 bytes */
    uint8_t enc_buf[16];
    Frame   frame;

    /* サンプリング間隔 1000 us = 1 kSPS */
    const uint32_t INTERVAL_US = 1000;
    absolute_time_t next_time = get_absolute_time();

    while (true) {
        /* CH0 サンプリング */
        adc_select_input(0);
        frame.ch0 = adc_read();

        /* CH1 サンプリング */
        adc_select_input(1);
        frame.ch1 = adc_read();

        /* タイムスタンプ (ms) */
        frame.ts_ms = to_ms_since_boot(get_absolute_time());

        /* COBS エンコードして送信 */
        size_t enc_len = cobs_encode((const uint8_t *)&frame, sizeof(Frame), enc_buf);
        fwrite(enc_buf, 1, enc_len, stdout);

        /* 厳密な 1 kSPS タイミングを維持 */
        next_time = delayed_by_us(next_time, INTERVAL_US);
        sleep_until(next_time);
    }

    return 0; /* 到達しない */
}
