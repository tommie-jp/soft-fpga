; PROG.ASM — CP/M ASM.COM 用テストプログラム
; BDOS ファンクション 9（文字列出力）で "ASM OK" を表示して CP/M に戻る。
        ORG     100H
        MVI     C,9
        LXI     D,MSG
        CALL    5
        RET
MSG:    DB      'ASM OK',13,10,'$'
        END
