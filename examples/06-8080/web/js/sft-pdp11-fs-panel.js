'use strict';
// sft-pdp11-fs-panel.js — V6 Filesystem パネル（jstree・D&D アップロード・操作ボタン）
//
// 依存（実行時に解決されるグローバル）:
//   worker, simStarted, _executeHostCmd（index.html）, $（jQuery）, jstree
// _jstreeCallbacks / _fsTreeInited などの状態は index.html の
// worker.onmessage（fsEntries / fsFile / v6OpDone 等）からも参照される。

// ── FS ステータス表示 ──────────────────────────────────────────────────────
var _fsStatusTimer = null;
function setFsStatus(msg) {
  var el = document.getElementById('fs-status');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(_fsStatusTimer);
  _fsStatusTimer = setTimeout(function() { el.textContent = ''; }, 5000);
}

// ── FS 操作補助 ────────────────────────────────────────────────────────────
var _jstreeCallbacks = {};  // reqId → { cb: jstree コールバック }
var _jstreeReqCount  = 0;
var _fsTreeInited    = false;
var _fsSelPath       = null;  // 選択ファイルの V6 パス
var _fsSelNodeId     = null;  // 選択ノードの jstree ID
var _fsSelDir        = '/tmp'; // ドロップ先ディレクトリ（デフォルト /tmp）

function _requestFSList() {
  _renderFSPanel();
}

// ドロップ時に CRLF/CR → LF 変換するか（グローバルトグル）
var _lfConvert = true;

// CRLF/CR を LF に正規化した ArrayBuffer を返す（CR が無ければ buf をそのまま）。
function _normalizeNewlinesToLF(buf) {
  var src = new Uint8Array(buf);
  var hasCR = false;
  for (var i = 0; i < src.length; i++) {
    if (src[i] === 0x0D) { hasCR = true; break; } // CR
  }
  if (!hasCR) return buf;             // 変換不要

  var out = new Uint8Array(src.length);
  var n = 0;
  for (var j = 0; j < src.length; j++) {
    var c = src[j];
    if (c === 0x0D) {                 // CR
      if (src[j + 1] === 0x0A) continue; // CRLF → 次の LF に委ねる
      out[n++] = 0x0A;                // 単独 CR → LF
    } else {
      out[n++] = c;
    }
  }
  return out.buffer.slice(0, n);
}

// 選択ディレクトリ（_fsSelDir）へファイル群をアップロードする。
// D&D ドロップと「ファイル選択」ボタン（#v6-upload-input）の両方から呼ばれる。
function _uploadFiles(files) {
  if (!files || !files.length) return;
  if (!simStarted) { setFsStatus('シミュレーション未開始のためアップロード不可'); return; }
  var dir = _fsSelDir || '/tmp';
  Array.from(files).forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var buf = ev.target.result;
      if (_lfConvert) buf = _normalizeNewlinesToLF(buf);
      var path = dir + '/' + file.name;
      worker.postMessage({ type: 'v6WriteFile', requestId: 'dropWrite',
                           path: path, content: buf }, [buf]);
    };
    reader.readAsArrayBuffer(file);
  });
}

// jstree データ関数から返す子ノード配列を組み立てる（ディレクトリは children:true で遅延ロード）
function _buildJstreeChildNodes(entries) {
  return (entries || []).slice().sort(function(a, b) {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  }).map(function(e) {
    var label = e.name;
    if (!e.isDir) {
      if (e.size) label += ' <span class="jst-sz">' + e.size + 'B</span>';
      if (e.mtime) {
        var dt = new Date(e.mtime * 1000);
        var mm = ('0' + (dt.getMonth() + 1)).slice(-2);
        var dd = ('0' + dt.getDate()).slice(-2);
        var hh = ('0' + dt.getHours()).slice(-2);
        var mi = ('0' + dt.getMinutes()).slice(-2);
        label += ' <span class="jst-mt">' + mm + '/' + dd + ' ' + hh + ':' + mi + '</span>';
      }
    }
    return {
      text:     label,
      icon:     e.isDir ? 'jstree-folder' : 'jstree-file',
      children: !!e.isDir,
      data:     { path: e.path, isDir: e.isDir }
    };
  });
}

function _renderFSPanel() {
  var el = document.getElementById('fs-list');
  if (!el || typeof $ === 'undefined') return;

  if (_fsTreeInited) {
    $(el).jstree(true).refresh();
    return;
  }

  _fsTreeInited = true;
  $(el).jstree({
    core: {
      data: function(node, cb) {
        if (!simStarted) { cb.call($(el).jstree(true), []); return; }
        var path = (node.id === '#') ? '/' : (node.data ? node.data.path : '/');
        var reqId = 'jt_' + (_jstreeReqCount++);
        _jstreeCallbacks[reqId] = { cb: cb };
        worker.postMessage({ type: 'listFS', requestId: reqId, path: path });
      },
      // move_node 検証: 移動先はディレクトリのみ許可
      check_callback: function(op, node, parent) {
        if (op !== 'move_node') return true;
        if (!parent || parent.id === '#') return false;
        return !!(parent.data && parent.data.isDir);
      },
      multiple: false,
      themes: { name: 'default-dark', dots: true, icons: true }
    },
    plugins: ['wholerow', 'dnd']
  }).on('select_node.jstree', function(ev, d) {
    var nd = d.node;
    if (!nd.data) return;
    var isFile   = !nd.data.isDir;
    _fsSelPath   = isFile ? nd.data.path : null;
    _fsSelNodeId = isFile ? nd.id        : null;
    // ドロップ先: ファイル選択 → 親ディレクトリ、ディレクトリ選択 → そのディレクトリ
    _fsSelDir    = nd.data.isDir ? nd.data.path
                 : (nd.data.path.replace(/\/[^\/]+$/, '') || '/');
    var dirEl = document.getElementById('drop-overlay-dir');
    if (dirEl) dirEl.textContent = _fsSelDir;
    var btnDl   = document.getElementById('btn-fs-dl');
    var btnEdit = document.getElementById('btn-fs-edit');
    var btnDel  = document.getElementById('btn-fs-delete');
    if (btnDl)   btnDl.disabled   = !isFile;
    if (btnEdit) btnEdit.disabled = !isFile;
    if (btnDel)  btnDel.disabled  = !isFile;
  }).on('deselect_node.jstree', function() {
    _fsSelPath = null; _fsSelNodeId = null;
    var btnDl   = document.getElementById('btn-fs-dl');
    var btnEdit = document.getElementById('btn-fs-edit');
    var btnDel  = document.getElementById('btn-fs-delete');
    if (btnDl)   btnDl.disabled   = true;
    if (btnEdit) btnEdit.disabled = true;
    if (btnDel)  btnDel.disabled  = true;
  }).on('move_node.jstree', function(ev, data) {
    var nd     = data.node;
    var srcPath = nd.data && nd.data.path;
    var newPar  = $(el).jstree(true).get_node(data.parent);
    var dstDir  = newPar && newPar.data && newPar.data.path;
    if (!srcPath || !dstDir || !simStarted) { $(el).jstree(true).refresh(); return; }
    worker.postMessage({ type: 'moveV6File', srcPath: srcPath, dstDir: dstDir });
  });
}

// DL ボタン
(function() {
  var btn = document.getElementById('btn-fs-dl');
  if (!btn) return;
  btn.addEventListener('click', function() {
    if (_fsSelPath) { setFsStatus('ダウンロード: ' + _fsSelPath); _executeHostCmd('get ' + _fsSelPath); }
  });
})();

// 編集ボタン
(function() {
  var btn = document.getElementById('btn-fs-edit');
  if (!btn) return;
  btn.addEventListener('click', function() {
    if (!_fsSelPath || !simStarted) return;
    setFsStatus('エディタで開く: ' + _fsSelPath);
    worker.postMessage({ type: 'readFS', requestId: 'edit', path: _fsSelPath });
  });
})();

// 削除ボタン
(function() {
  var btn = document.getElementById('btn-fs-delete');
  if (!btn) return;
  btn.addEventListener('click', function() {
    if (!_fsSelPath || !simStarted) return;
    if (!confirm('削除しますか？\n' + _fsSelPath)) return;
    setFsStatus('削除: ' + _fsSelPath);
    worker.postMessage({ type: 'removeV6File', path: _fsSelPath });
  });
})();

// V6 FS Drag & Drop
// ファイルドラッグを全画面オーバーレイで可視化し、ページ上どこへでもドロップ可能にする。
(function() {
  var overlay = document.getElementById('file-drop-overlay');

  function _hasFiles(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    if (!t) return false;
    // 'Files' (Web 標準) または 'text/uri-list' (Linux XDnD) を受け付ける
    return Array.prototype.some.call(t, function(x) {
      return x === 'Files' || x === 'text/uri-list';
    });
  }

  function _showOverlay()  { if (overlay) overlay.classList.add('active'); }
  function _hideOverlay()  { if (overlay) overlay.classList.remove('active'); }

  // dragenter でオーバーレイを表示（dragover より素早く反応する）
  window.addEventListener('dragenter', function(e) {
    if (!_hasFiles(e)) return;
    e.preventDefault();
    _showOverlay();
  }, true);

  // dragover で都度 preventDefault（ブラウザのデフォルト動作を抑止）
  window.addEventListener('dragover', function(e) {
    if (!_hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    _showOverlay();
  }, true);

  // ウィンドウ外へ出たらオーバーレイを消す
  window.addEventListener('dragleave', function(e) {
    if (e.relatedTarget === null) _hideOverlay();
  }, true);

  // ドロップ処理
  window.addEventListener('drop', function(e) {
    if (!_hasFiles(e)) return;
    e.preventDefault();
    _hideOverlay();
    if (e.dataTransfer.files.length > 0) {
      _uploadFiles(e.dataTransfer.files);
    } else {
      // Linux XDnD では files が空で text/uri-list だけ来る場合がある
      setFsStatus('ドロップ受信: files オブジェクトが空（XDnD）— ブラウザ制限のためアップロード不可');
    }
  }, true);
})();

// ── V6 FS パネル折りたたみ ───────────────────────────────────────────────
(function() {
  var btn    = document.getElementById('btn-fs-collapse');
  var panel  = document.getElementById('fs-panel');
  var body   = document.getElementById('fs-body');
  var status = document.getElementById('fs-status');
  if (!btn || !panel || !body) return;

  btn.addEventListener('click', function() {
    var collapsed = panel.classList.toggle('collapsed');
    if (collapsed) {
      body.style.height   = body.offsetHeight + 'px'; // 現在値を固定してから
      requestAnimationFrame(function() { body.style.height = '0'; });
      if (status) status.style.display = 'none';
    } else {
      var fsList = document.getElementById('fs-list');
      var target = (fsList ? fsList.offsetHeight : 200) +
                   (document.getElementById('fs-resizer') ? 5 : 0);
      body.style.height = target + 'px';
      body.addEventListener('transitionend', function onEnd() {
        body.removeEventListener('transitionend', onEnd);
        body.style.height = '';   // auto に戻して resize が効くように
      });
      if (status) status.style.display = '';
    }
  });
})();

// ── V6 FS ツリーの高さリサイズ ───────────────────────────────────────────
(function() {
  var resizer  = document.getElementById('fs-resizer');
  var fsList   = document.getElementById('fs-list');
  if (!resizer || !fsList) return;

  var startY   = 0;
  var startH   = 0;
  var MIN_H    = 60;
  var MAX_H    = 800;

  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    startY = e.clientY;
    startH = fsList.offsetHeight;
    resizer.classList.add('dragging');

    function onMove(e) {
      var h = Math.min(MAX_H, Math.max(MIN_H, startH + e.clientY - startY));
      fsList.style.height = h + 'px';
    }
    function onUp() {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// ── FS パネルのリフレッシュ・アップロード ────────────────────────────────
document.getElementById('btn-fs-refresh').addEventListener('click', function() {
  if (!simStarted) return;
  setFsStatus('ツリーを更新中...');
  var el = document.getElementById('fs-list');
  if (el && _fsTreeInited) {
    $(el).jstree(true).refresh();
  } else {
    _renderFSPanel();
  }
});

document.getElementById('btn-lf-toggle').addEventListener('click', function() {
  _lfConvert = !_lfConvert;
  this.classList.toggle('lf-off', !_lfConvert);
  setFsStatus('LF 変換: ' + (_lfConvert ? 'ON（CRLF/CR → LF）' : 'OFF'));
});

document.getElementById('btn-export-disk').addEventListener('click', function() {
  if (!simStarted) return;
  setFsStatus('ディスクイメージをエクスポート中...');
  worker.postMessage({ type: 'getDisk' });
});

document.getElementById('v6-upload-input').addEventListener('change', function() {
  _uploadFiles(this.files);
  this.value = '';  // 同じファイルを再選択できるようにリセット
});
