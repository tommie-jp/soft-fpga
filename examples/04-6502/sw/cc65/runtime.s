; Apple-1 向け cc65 最小ランタイム
; sp / pusha / incsp1 を提供する

    .exportzp sp, sreg, regsave, regbank
    .exportzp tmp1, tmp2, tmp3, tmp4
    .exportzp ptr1, ptr2, ptr3, ptr4

.segment "ZEROPAGE"
sp:      .res 2   ; cc65 software stack pointer
sreg:    .res 2
regsave: .res 4
regbank: .res 6
tmp1:    .res 1
tmp2:    .res 1
tmp3:    .res 1
tmp4:    .res 1
ptr1:    .res 2
ptr2:    .res 2
ptr3:    .res 2
ptr4:    .res 2

; pusha: A を software stack に push（スタックは下方向に成長）
.segment "CODE"
.export pusha
pusha:
    ldy     sp
    bne     pusha_ok
    dec     sp+1
pusha_ok:
    dec     sp
    ldy     #0
    sta     (sp),y
    rts

; incsp1: software stack を 1 バイト pop
.export incsp1
incsp1:
    inc     sp
    bne     incsp1_ok
    inc     sp+1
incsp1_ok:
    rts
