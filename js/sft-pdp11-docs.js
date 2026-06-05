'use strict';
// sft-pdp11-docs.js — PDP-11 / Unix V6 ドキュメントビューア（DOC_LIST / openDoc）
//
// 09-pdp11 Web UI から使用。docs/ ディレクトリから Markdown を fetch して
// doc-modal に表示する。marked（CDN）を使用。

// ── WASM 向けドキュメントリスト（docs-panel の順序と一致させること）──
var PDP11_DOC_LIST = [
  { file: '07-unix-v6-歴史的価値.md',           label: '07 Unix V6 / PDP-11 の歴史' },
  { file: '06-unix-v6-demo-commands.md',       label: '06 デモコマンド集' },
  { file: '09-unix-v6-ファイルシステム.md',      label: '09 ファイルシステム構成' },
  { file: '11-thompson-シェル.md',              label: '11 Thompson シェル使い方' },
  { file: '08-ed-使い方.md',                   label: '08 ed エディタ使い方' },
  { file: '10-unix-v6-コマンドリファレンス.md',  label: '10 Unix V6 コマンドリファレンス' },
  { file: '13-c-コンパイル入門.md',             label: '13 C コンパイル入門 ※WASM非対応' },
  { file: '14-adb-デバッガー-使い方.md',        label: '14 デバッグ手法（od / printf / SIMH）' },
  { file: '20-デバッグパネル-使い方.md',        label: '20 デバッグパネル・Logic Analyzer' },
  { file: '21-バスサイクル実例.md',             label: '21 LA バスサイクル実例集' },
  { file: '52-メモリマップ.md',                 label: '52 メモリマップ' },
  { file: '53-参考資料.md',                    label: '53 参考資料' },
  { file: '54-simh-使い方.md',                 label: '54 SIMH 使い方（cc 対応）' },
];
var _pdp11DocIdx = -1;

function openDoc(file) {
  var idx = -1;
  for (var i = 0; i < PDP11_DOC_LIST.length; i++) {
    if (PDP11_DOC_LIST[i].file === file) { idx = i; break; }
  }
  _pdp11DocIdx = idx;

  var btnPrev = document.getElementById('doc-prev');
  var btnNext = document.getElementById('doc-next');
  var sel     = document.getElementById('doc-select');

  if (btnPrev) {
    if (idx > 0) {
      btnPrev.textContent = '‹ ' + PDP11_DOC_LIST[idx - 1].label;
      btnPrev.disabled = false;
    } else {
      btnPrev.textContent = '‹';
      btnPrev.disabled = true;
    }
  }
  if (btnNext) {
    if (idx >= 0 && idx < PDP11_DOC_LIST.length - 1) {
      btnNext.textContent = PDP11_DOC_LIST[idx + 1].label + ' ›';
      btnNext.disabled = false;
    } else {
      btnNext.textContent = '›';
      btnNext.disabled = true;
    }
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
