# ブランクイメージを作成（256,256 バイト）
dd if=/dev/zero of=new.dsk bs=128 count=$((77*26))

# CP/M ファイルシステムを初期化
mkfs.cpm -f ibm-3740 new.dsk
