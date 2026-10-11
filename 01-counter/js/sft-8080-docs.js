'use strict';
// sft-8080-docs.js — CP/M ドキュメントリスト
// 依存: sft-doc-viewer.js (SftDocViewer) を先に読み込むこと

var DOC_LIST = [
  { file: '02-CP_M-歴史的価値.md',              fileEn: '02-CP_M-歴史的価値.md',              label: '02 CP/M 歴史的価値',           labelEn: '02 CP/M Historical Value' },
  { file: '03-開発ツール.md',                    fileEn: '03-開発ツール.md',                    label: '03 開発ツール',                labelEn: '03 Development Tools' },
  { file: '12-CP_M-コマンドリファレンス.md',     fileEn: '12-CP_M-コマンドリファレンス.md',     label: '12 CP/M コマンドリファレンス', labelEn: '12 CP/M Command Reference' },
  { file: '14-cpm-コマンド説明.md',              fileEn: '14-cpm-コマンド説明.md',              label: '14 CP/M コマンド説明',         labelEn: '14 cpm Command Reference' },
  { file: '15-ファイル構成とファイル交換.md',    fileEn: '15-ファイル構成とファイル交換.md',    label: '15 ファイル構成・交換方法',    labelEn: '15 File Layout & Exchange' },
  { file: '16-CP_M-ソフトウェア入手先.md',      fileEn: '16-CP_M-ソフトウェア入手先.md',      label: '16 CP/M ソフトウェア入手先',   labelEn: '16 CP/M Software Sources' },
  { file: '17-MBASIC-使い方.md',                fileEn: '17-MBASIC-使い方.md',                label: '17 MBASIC 使い方',             labelEn: '17 MBASIC Guide' },
  { file: '18-BDS-C-使い方.md',                 fileEn: '18-BDS-C-使い方.md',                 label: '18 BDS C 使い方',              labelEn: '18 BDS C Guide' },
  { file: '19-インタラクティブコマンド.md',      fileEn: '19-インタラクティブコマンド.md',      label: '19 インタラクティブコマンド',  labelEn: '19 Interactive Commands' },
  { file: '20-サイクルカウンタ.md',             fileEn: '20-サイクルカウンタ.md',             label: '20 サイクルカウンタ',          labelEn: '20 Cycle Counter' },
  { file: '22-クロック計測とベンチマーク手順.md',fileEn: '22-クロック計測とベンチマーク手順.md',label: '22 クロック計測・ベンチマーク', labelEn: '22 Clock Measurement & Benchmark' },
  { file: '23-WordMaster-使い方.md',            fileEn: '23-WordMaster-使い方.md',            label: '23 WordMaster 使い方',         labelEn: '23 WordMaster Guide' },
  { file: '24-TurboPascal3-使い方.md',          fileEn: '24-TurboPascal3-使い方.md',          label: '24 Turbo Pascal 3',            labelEn: '24 Turbo Pascal 3' },
  { file: '25-デバッグパネル-使い方.md',        fileEn: '25-デバッグパネル-使い方.md',        label: '25 デバッグパネル・信号線表示', labelEn: '25 Debug Panel & Logic Analyzer' },
  { file: '30-BIOS実装.md',                     fileEn: '30-BIOS実装.md',                     label: '30 カスタム BIOS 実装',        labelEn: '30 Custom BIOS Implementation' },
  { file: '52-メモリマップ.md',                 fileEn: '52-メモリマップ.md',                 label: '52 メモリマップ & I/O ポート', labelEn: '52 Memory Map & I/O Ports' },
  { file: '53-参考資料.md',                     fileEn: '53-参考資料.md',                     label: '53 参考資料',                  labelEn: '53 References' },
];

var _docViewer = new SftDocViewer(DOC_LIST, {
  docsPath:   'docs/',
  docsPathEn: 'docs/en/',
  idLangBtn:  'doc-lang-btn',
  useHash:    true,
});
function openDoc(file) { _docViewer.openDoc(file); }
