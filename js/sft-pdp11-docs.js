'use strict';
// sft-pdp11-docs.js — PDP-11 / Unix V6 document list
// Requires: sft-doc-viewer.js (SftDocViewer) loaded first

var PDP11_DOC_LIST = [
  { file: '07-unix-v6-歴史的価値.md',           fileEn: '07-unix-v6-歴史的価値.md',           label: '07 Unix V6 / PDP-11 の歴史',              labelEn: '07 Unix V6 / PDP-11 History' },
  { file: '06-unix-v6-demo-commands.md',       fileEn: '06-unix-v6-demo-commands.md',       label: '06 デモコマンド集',                       labelEn: '06 Demo Commands' },
  { file: '09-unix-v6-ファイルシステム.md',      fileEn: '09-unix-v6-ファイルシステム.md',      label: '09 ファイルシステム構成',                  labelEn: '09 Filesystem Layout' },
  { file: '11-thompson-シェル.md',              fileEn: '11-thompson-シェル.md',              label: '11 Thompson シェル使い方',                labelEn: '11 Thompson Shell Guide' },
  { file: '08-ed-使い方.md',                   fileEn: '08-ed-使い方.md',                   label: '08 ed エディタ使い方',                    labelEn: '08 ed Editor Guide' },
  { file: '10-unix-v6-コマンドリファレンス.md',  fileEn: '10-unix-v6-コマンドリファレンス.md',  label: '10 Unix V6 コマンドリファレンス',          labelEn: '10 Unix V6 Command Reference' },
  { file: '12-unix-v6-システムコール.md',       fileEn: '12-unix-v6-システムコール.md',       label: '12 システムコール参考',                   labelEn: '12 System Call Reference' },
  { file: '13-c-コンパイル入門.md',             fileEn: '13-c-コンパイル入門.md',             label: '13 C コンパイル入門 ※WASM非対応',         labelEn: '13 C Compilation Guide (no WASM)' },
  { file: '14-db-デバッガー-使い方.md',         fileEn: '14-db-デバッガー-使い方.md',         label: '14 db デバッガの使い方',                  labelEn: '14 db Debugger Guide' },
  { file: '20-デバッグパネル-使い方.md',        fileEn: '20-デバッグパネル-使い方.md',        label: '20 デバッグパネル・Logic Analyzer',       labelEn: '20 Debug Panel & Logic Analyzer' },
  { file: '21-バスサイクル実例.md',             fileEn: '21-バスサイクル実例.md',             label: '21 LA バスサイクル実例集',                labelEn: '21 LA Bus Cycle Examples' },
  { file: '22-全命令タイミング図.md',           fileEn: '22-全命令タイミング図.md',           label: '22 全命令タイミング図（61 ケース）',        labelEn: '22 Instruction Timing Diagrams (61 cases)' },
  { file: '24-全命令タイミング図-解説.md',       fileEn: '24-全命令タイミング図-解説.md',       label: '24 タイミング図ケース別解説',              labelEn: '24 Timing Diagram Case Explanations' },
  { file: '25-as-db-命令シーケンスデモ.md',      fileEn: '25-as-db-命令シーケンスデモ.md',      label: '25 as/db で命令シーケンス図',             labelEn: '25 as/db Instruction Sequence Demo' },
  { file: '52-メモリマップ.md',                 fileEn: '52-メモリマップ.md',                 label: '52 メモリマップ',                         labelEn: '52 Memory Map' },
  { file: '53-参考資料.md',                    fileEn: '53-参考資料.md',                    label: '53 参考資料',                            labelEn: '53 References' },
  { file: '54-simh-使い方.md',                 fileEn: '54-simh-使い方.md',                 label: '54 SIMH 使い方（cc 対応）',               labelEn: '54 SIMH Guide (with cc)' },
];

var _pdp11DocViewer = new SftDocViewer(PDP11_DOC_LIST, {
  docsPath:   'docs/',
  docsPathEn: 'docs/en/',
  idLangBtn:  'doc-lang-btn',
  useHash:    true,
});
function openDoc(file) { _pdp11DocViewer.openDoc(file); }
