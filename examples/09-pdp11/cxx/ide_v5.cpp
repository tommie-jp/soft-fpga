// ide_v5.cpp — Brad Parker ide.cpp を Verilator 5.x svLogicVecVal* 署名に適合させた版。
// 実装ロジックは ide.cpp から変更なし。シグネチャと POSIX include のみ修正。

#include <stdint.h>  // uint8_t — svdpi.h より前に必要
#include "svdpi.h"
// Vtest_top*__Dpi.h は実装側では不要（型チェックのみ目的）

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>   // lseek / read / write

#ifdef __cplusplus
extern "C" {
#endif

// ── ide.cpp の実装（シグネチャ変更なし、内部 logic をそのままコピー） ───

static int last_dior_bit_v;
static int last_diow_bit_v;
static unsigned short last_read_v;

static struct ide_state_s {
    unsigned short reg_seccnt, reg_secnum, reg_cyllow, reg_cylhigh, reg_drvhead;
    unsigned short status;
    int fifo_rd, fifo_wr, fifo_depth;
    unsigned short fifo[256 * 128];
    int file_inited, file_fd;
    unsigned int lba;
} ide_state;

#define ATA_DATA     0x10
#define ATA_SECCNT   0x12
#define ATA_SECNUM   0x13
#define ATA_CYLLOW   0x14
#define ATA_CYLHIGH  0x15
#define ATA_DRVHEAD  0x16
#define ATA_STATUS   0x17
#define ATA_COMMAND  0x17
#define ATA_ALTER    0x0e
#define ATA_DEVCTRL  0x1e
#define ATA_FEATURE  0x11
#define IDE_STATUS_BSY  7
#define IDE_STATUS_DRDY 6
#define IDE_STATUS_DWF  5
#define IDE_STATUS_DSC  4
#define IDE_STATUS_DRQ  3
#define ATA_CMD_READ  0x0020
#define ATA_CMD_WRITE 0x0030

static void ide_setup(struct ide_state_s *s) {
    char *dif, fn[1024];
    strcpy(fn, "rk.dsk");
    if ((dif = getenv("IDEIMAGE"))) strncpy(fn, dif, sizeof(fn));
    s->file_fd = open(fn, O_RDWR);
    if (s->file_fd < 0) perror(fn);
    s->status = (1<<IDE_STATUS_DRDY)|(1<<IDE_STATUS_DSC);
    s->fifo_depth = s->fifo_rd = s->fifo_wr = 0;
}

static void ide_do_read(struct ide_state_s *s) {
    s->lba = ((s->reg_drvhead & 0x0f) << 24) | ((s->reg_cylhigh & 0xff) << 16)
           | ((s->reg_cyllow  & 0xff) <<  8) |  (s->reg_secnum & 0xff);
    fprintf(stderr, "dpi_ide: READ lba=%u seccnt=%u\n", s->lba, s->reg_seccnt);
    lseek(s->file_fd, (off_t)s->lba * 512, SEEK_SET);
    int ret = read(s->file_fd, s->fifo, 512 * s->reg_seccnt);
    if (ret < 0) perror("ide read");
    s->fifo_depth = (512 * s->reg_seccnt) / 2;
    s->fifo_rd = s->fifo_wr = 0;
    s->status = (1<<IDE_STATUS_DRDY)|(1<<IDE_STATUS_DSC)|(1<<IDE_STATUS_DRQ);
}

static void ide_do_write_prep(struct ide_state_s *s) {
    s->lba = ((s->reg_drvhead & 0x0f) << 24) | ((s->reg_cylhigh & 0xff) << 16)
           | ((s->reg_cyllow  & 0xff) <<  8) |  (s->reg_secnum & 0xff);
    s->fifo_depth = (512 * s->reg_seccnt) / 2;
    s->fifo_rd = s->fifo_wr = 0;
    s->status = (1<<IDE_STATUS_DRDY)|(1<<IDE_STATUS_DSC)|(1<<IDE_STATUS_DRQ);
}

static void ide_do_write_done(struct ide_state_s *s) {
    /* printf("dpi_ide: write lba=%u seccnt=%u\n", s->lba, s->reg_seccnt); */
    lseek(s->file_fd, (off_t)s->lba * 512, SEEK_SET);
    int ret = write(s->file_fd, s->fifo, 512 * s->reg_seccnt);
    if (ret < 0) perror("ide write");
    s->status = (1<<IDE_STATUS_DRDY)|(1<<IDE_STATUS_DSC);
}

// ── Verilator 5.x DPI エントリ ──────────────────────────────────────────
void dpi_ide(const svLogicVecVal* data_in, svLogicVecVal* data_out,
             const svLogicVecVal* dior, const svLogicVecVal* diow,
             const svLogicVecVal* cs, const svLogicVecVal* da)
{
    int di = (int)data_in->aval;
    int dior_v = (int)dior->aval;
    int diow_v = (int)diow->aval;
    int cs_v   = (int)cs->aval;
    int da_v   = (int)da->aval;
    int out_val = (int)last_read_v;

    struct ide_state_s *s = &ide_state;
    if (!s->file_inited) { s->file_inited = 1; ide_setup(s); }

    int read_start  = (dior_v != last_dior_bit_v && dior_v == 0);
    int read_stop   = (dior_v != last_dior_bit_v && dior_v == 1);
    int write_start = (diow_v != last_diow_bit_v && diow_v == 0);
    int write_stop  = (diow_v != last_diow_bit_v && diow_v == 1);
    last_dior_bit_v = dior_v;
    last_diow_bit_v = diow_v;

    if (write_start) {
        switch (cs_v << 3 | da_v) {
        case ATA_SECCNT:  s->reg_seccnt  = di; break;
        case ATA_SECNUM:  s->reg_secnum  = di; break;
        case ATA_CYLLOW:  s->reg_cyllow  = di; break;
        case ATA_CYLHIGH: s->reg_cylhigh = di; break;
        case ATA_DRVHEAD: s->reg_drvhead = di; break;
        case ATA_DATA:
            s->fifo[s->fifo_wr] = di;
            if (s->fifo_wr < s->fifo_depth) s->fifo_wr++;
            if (s->fifo_wr >= s->fifo_depth) ide_do_write_done(s);
            break;
        case ATA_COMMAND:
            /* printf("dpi_ide: cmd %04x\n", di); */
            if (di == ATA_CMD_READ)  ide_do_read(s);
            if (di == ATA_CMD_WRITE) ide_do_write_prep(s);
            break;
        default: break;
        }
    }

    if (read_start) {
        switch (cs_v << 3 | da_v) {
        case ATA_DATA:
            out_val = last_read_v = s->fifo[s->fifo_rd];
            if (s->fifo_rd < s->fifo_depth) s->fifo_rd++;
            if (s->fifo_rd >= s->fifo_depth)
                s->status = (1<<IDE_STATUS_DRDY)|(1<<IDE_STATUS_DSC);
            break;
        case ATA_STATUS:
            out_val = last_read_v = s->status;
            break;
        default: break;
        }
    }

    data_out->aval = (uint32_t)out_val;
    data_out->bval = 0;
    (void)read_stop; (void)write_stop;
}

#ifdef __cplusplus
}
#endif
