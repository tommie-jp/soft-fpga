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
  { file: '26-式トリガー-リファレンス.md',       fileEn: '26-式トリガー-リファレンス.md',       label: '26 式トリガー（Expr）リファレンス',        labelEn: '26 Expr Trigger Reference' },
  { file: '27-swtch-You-are-not-expected-to-understand-this.md', fileEn: '27-swtch-You-are-not-expected-to-understand-this.md', label: '27 「You are not expected to understand this」を LA で見る', labelEn: '27 Watching "You are not expected to understand this"' },
  { file: '28-setd-the-trap-is-ignored.md', fileEn: '28-setd-the-trap-is-ignored.md', label: '28 C プログラムの最初の命令は無視される不正命令', labelEn: '28 The First Instruction of Every C Program Is an Ignored Trap' },
  { file: '29-fork-the-return-locations-differ-by-one-word.md', fileEn: '29-fork-the-return-locations-differ-by-one-word.md', label: '29 fork は戻り番地で親と子を分ける', labelEn: '29 fork Tells Parent from Child by the Return Address' },
  { file: '30-linux-起動スクリプト.md',         fileEn: '30-linux-起動スクリプト.md',         label: '30 Linux 起動スクリプト',                 labelEn: '30 Linux Boot Script' },
  { file: '31-lcase-大文字モード.md',           fileEn: '31-lcase-大文字モード.md',           label: '31 LCASE 大文字モード',                   labelEn: '31 LCASE Uppercase Mode' },
  { file: '32-signal-asks-the-process-to-do-something-to-itself.md', fileEn: '32-signal-asks-the-process-to-do-something-to-itself.md', label: '32 シグナルは、プロセスが自分で自分に配る', labelEn: '32 A Signal Is Delivered by the Process to Itself' },
  { file: '33-icode-return-goes-to-loc-0.md', fileEn: '33-icode-return-goes-to-loc-0.md', label: '33 最初のプロセスは、カーネルが手で写した 11 語', labelEn: '33 The First Process Is Eleven Words Copied by Hand' },
  { file: '34-sync-not-necessarily-complete-upon-return.md', fileEn: '34-sync-not-necessarily-complete-upon-return.md', label: '34 sync は書き込みの完了を待たずに戻る', labelEn: '34 sync Returns Before the Writing Is Complete' },
  { file: '42-as-アセンブラ制約.md',            fileEn: '42-as-アセンブラ制約.md',            label: '42 as アセンブラ制約',                    labelEn: '42 as Assembler Constraints' },
  { file: '52-メモリマップ.md',                 fileEn: '52-メモリマップ.md',                 label: '52 メモリマップ',                         labelEn: '52 Memory Map' },
  { file: '53-参考資料.md',                    fileEn: '53-参考資料.md',                    label: '53 参考資料',                            labelEn: '53 References' },
  { file: '54-simh-使い方.md',                 fileEn: '54-simh-使い方.md',                 label: '54 SIMH 使い方（cc 対応）',               labelEn: '54 SIMH Guide (with cc)' },
  { file: '55-MMU-タイミングと実機比較.md',      fileEn: '55-MMU-タイミングと実機比較.md',      label: '55 MMU タイミング実機比較',               labelEn: '55 MMU Timing vs. Real Hardware' },
  { file: '56-MMU-unix-v6-での使われ方.md',     fileEn: '56-MMU-unix-v6-での使われ方.md',     label: '56 MMU Unix V6 での使われ方',             labelEn: '56 How Unix V6 Uses the MMU' },
  { file: '57-レジスタとistate.md',             fileEn: '57-レジスタとistate.md',             label: '57 レジスタと istate',                    labelEn: '57 Registers & istate' },
];

var _pdp11DocViewer = new SftDocViewer(PDP11_DOC_LIST, {
  docsPath:   'docs/',
  docsPathEn: 'docs/en/',
  idLangBtn:  'doc-lang-btn',
  useHash:    true,
  // 文書の中の "?scenario=名前" のリンクで、デバッグパネルの設定一式を入れる（sft-pdp11-scenarios.js）
  linkHandlers: {
    scenario: function (name) { return applyPdp11Scenario(name) !== SCENARIO_FAILED; },
  },
});
function openDoc(file) { _pdp11DocViewer.openDoc(file); }
