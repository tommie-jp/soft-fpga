'use strict';
// sft-8080-docs.js — CP/M ドキュメントリスト
// 依存: sft-doc-viewer.js (SftDocViewer) を先に読み込むこと

var DOC_LIST = [
  { file: '02-CP_M-歴史的価値.md',              label: '02 CP/M 歴史的価値' },
  { file: '03-開発ツール.md',                    label: '03 開発ツール' },
  { file: '12-CP_M-コマンドリファレンス.md',     label: '12 CP/M コマンドリファレンス' },
  { file: '14-cpm-コマンド説明.md',              label: '14 CP/M コマンド説明' },
  { file: '15-ファイル構成とファイル交換.md',    label: '15 ファイル構成・交換方法' },
  { file: '16-CP_M-ソフトウェア入手先.md',      label: '16 CP/M ソフトウェア入手先' },
  { file: '17-MBASIC-使い方.md',                label: '17 MBASIC 使い方' },
  { file: '18-BDS-C-使い方.md',                 label: '18 BDS C 使い方' },
  { file: '19-インタラクティブコマンド.md',      label: '19 インタラクティブコマンド' },
  { file: '20-サイクルカウンタ.md',             label: '20 サイクルカウンタ' },
  { file: '22-クロック計測とベンチマーク手順.md',label: '22 クロック計測・ベンチマーク' },
  { file: '23-WordMaster-使い方.md',            label: '23 WordMaster 使い方' },
  { file: '24-TurboPascal3-使い方.md',          label: '24 Turbo Pascal 3' },
  { file: '25-デバッグパネル-使い方.md',        label: '25 デバッグパネル・信号線表示' },
  { file: '30-BIOS実装.md',                     label: '30 カスタム BIOS 実装' },
  { file: '52-メモリマップ.md',                 label: '52 メモリマップ & I/O ポート' },
  { file: '53-参考資料.md',                     label: '53 参考資料' },
];

var _docViewer = new SftDocViewer(DOC_LIST, { docsPath: 'docs/', useHash: true });
function openDoc(file) { _docViewer.openDoc(file); }
