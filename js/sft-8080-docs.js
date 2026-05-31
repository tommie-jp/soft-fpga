// sft-8080-docs.js — CP/M ドキュメントビューア（DOC_LIST / openDoc）
//
// 06-8080 Web UI から分離。initUI ローカル非依存（marked + fetch + DOM のみ）。
// doc-modal / doc-select / doc-prev / doc-next の DOM リスナは index.html の initUI() 側に残し、
// それらが openDoc（グローバル）を呼ぶ。marked（CDN）は openDoc 実行時に参照する。

// ── CP/M DOCS 文書リスト（docs-panel の順序と一致させること）──
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
var _docIdx = -1; // 現在開いている文書の DOC_LIST インデックス

function openDoc(file) {
  // DOC_LIST 内のインデックスを求め、前・次ボタンとドロップダウンを更新する
  var idx = -1;
  for (var i = 0; i < DOC_LIST.length; i++) {
    if (DOC_LIST[i].file === file) { idx = i; break; }
  }
  _docIdx = idx;

  var btnPrev = document.getElementById('doc-prev');
  var btnNext = document.getElementById('doc-next');
  var sel     = document.getElementById('doc-select');

  if (idx > 0) {
    btnPrev.textContent = '‹ ' + DOC_LIST[idx - 1].label; // ‹ prev
    btnPrev.disabled = false;
  } else {
    btnPrev.textContent = '‹';
    btnPrev.disabled = true;
  }
  if (idx >= 0 && idx < DOC_LIST.length - 1) {
    btnNext.textContent = DOC_LIST[idx + 1].label + ' ›'; // next ›
    btnNext.disabled = false;
  } else {
    btnNext.textContent = '›';
    btnNext.disabled = true;
  }
  if (sel && idx >= 0) { sel.value = file; }

  fetch('docs/' + file)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function(md) {
      var html = marked.parse(md)
        .replace(/<table/g, '<div class="table-wrap"><table')
        .replace(/<\/table>/g, '</table></div>');
      var content = document.getElementById('doc-content');
      content.innerHTML = html;
      content.scrollTop = 0;
      document.getElementById('doc-modal').style.display = 'flex';
    })
    .catch(function(e) {
      alert('ドキュメントを読み込めませんでした: ' + file + '\n' + e);
    });
}
