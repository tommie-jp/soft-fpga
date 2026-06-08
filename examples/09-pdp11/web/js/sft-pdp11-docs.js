'use strict';
// sft-pdp11-docs.js — PDP-11 / Unix V6 ドキュメントリスト
// 依存: sft-doc-viewer.js (SftDocViewer) を先に読み込むこと

var PDP11_DOC_LIST = [
  { file: '07-unix-v6-歴史的価値.md',           label: '07 Unix V6 / PDP-11 の歴史' },
  { file: '06-unix-v6-demo-commands.md',       label: '06 デモコマンド集' },
  { file: '09-unix-v6-ファイルシステム.md',      label: '09 ファイルシステム構成' },
  { file: '11-thompson-シェル.md',              label: '11 Thompson シェル使い方' },
  { file: '08-ed-使い方.md',                   label: '08 ed エディタ使い方' },
  { file: '10-unix-v6-コマンドリファレンス.md',  label: '10 Unix V6 コマンドリファレンス' },
  { file: '12-unix-v6-システムコール.md',       label: '12 システムコール参考' },
  { file: '13-c-コンパイル入門.md',             label: '13 C コンパイル入門 ※WASM非対応' },
  { file: '14-db-デバッガー-使い方.md',         label: '14 db デバッガの使い方' },
  { file: '20-デバッグパネル-使い方.md',        label: '20 デバッグパネル・Logic Analyzer' },
  { file: '21-バスサイクル実例.md',             label: '21 LA バスサイクル実例集' },
  { file: '22-全命令タイミング図.md',           label: '22 全命令タイミング図（61 ケース）' },
  { file: '24-全命令タイミング図-解説.md',       label: '24 タイミング図ケース別解説' },
  { file: '25-as-db-命令シーケンスデモ.md',      label: '25 as/db で命令シーケンス図' },
  { file: '52-メモリマップ.md',                 label: '52 メモリマップ' },
  { file: '53-参考資料.md',                    label: '53 参考資料' },
  { file: '54-simh-使い方.md',                 label: '54 SIMH 使い方（cc 対応）' },
];

var _pdp11DocViewer = new SftDocViewer(PDP11_DOC_LIST, { docsPath: 'docs/', useHash: true });
function openDoc(file) { _pdp11DocViewer.openDoc(file); }
