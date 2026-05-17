    .export __STARTUP__ : absolute = 1
    .import _main
    .importzp sp

    .segment "STARTUP"
; software stack を $02FF（コード領域 $0300 の直前）に初期化
    lda #$FF
    sta sp
    lda #$02
    sta sp+1
    jsr _main
loop:
    jmp loop
