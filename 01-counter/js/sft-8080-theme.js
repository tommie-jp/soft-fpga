// sft-8080-theme.js — ターミナルテーマ・フォントサイズ
//
// 06-8080 Web UI から分離。関数・状態の定義のみ（DOM リスナ等の即時実行は index.html 側に残す）。
// term はグローバル var（index.html の `var term`）を参照する。
// 利用元: index.html のテーマ切替 UI・フォントサイズ UI・起動時 applyTheme()。

var THEMES = {
  green: { background:'#000000', foreground:'#33FF00', cursor:'#33FF00',
           selectionBackground:'#33FF0055', cursorAccent:'#000000' },
  amber: { background:'#000000', foreground:'#FFB300', cursor:'#FFB300',
           selectionBackground:'#FFB30055', cursorAccent:'#000000' },
  paper: { background:'#000000', foreground:'#E8E8D0', cursor:'#E8E8D0',
           selectionBackground:'#E8E8D055', cursorAccent:'#000000' },
  light: { background:'#ffffff', foreground:'#111111', cursor:'#111111',
           selectionBackground:'#0077cc40', cursorAccent:'#ffffff' },
};

var currentTheme = localStorage.getItem('cpm-theme') || 'green';

function applyTheme(name) {
  if (!THEMES[name]) return;
  currentTheme = name;
  localStorage.setItem('cpm-theme', name);
  if (term) term.options.theme = THEMES[name];
  var wrap = document.getElementById('terminal-wrap');
  wrap.style.background  = THEMES[name].background;
  wrap.style.borderColor = (name === 'light') ? '#bbb' : '#444';
  updateThemeMenu(name);
}

function updateThemeMenu(name) {
  var labels = { green:'Green', amber:'Amber', paper:'White', light:'Light' };
  var lbl = document.getElementById('theme-label');
  if (lbl) lbl.textContent = labels[name] || name;
  document.querySelectorAll('.th-item').forEach(function(el) {
    el.querySelector('.th-chk').textContent = el.dataset.value === name ? '✔' : '';
  });
}

var currentFontSize = parseInt(localStorage.getItem('cpm-fontsize'), 10) || 13;

function applyFontSize(size) {
  size = Math.max(6, Math.min(20, size));
  currentFontSize = size;
  localStorage.setItem('cpm-fontsize', size);
  if (term) {
    term._core.optionsService.options.fontSize = size;
    term.refresh(0, term.rows - 1);
  }
  var sel = document.getElementById('sel-fontsize');
  if (sel) sel.value = size;
}
