'use strict';
// sft-pdp11-disk.js — ディスクイメージ読み込みと IndexedDB 永続化
//
// 起動時に IndexedDB → サーバーの順でディスクイメージを取得し、
// グローバル diskBuffer にセットして _maybeAutoBoot() を呼ぶ。
// 依存（実行時に解決されるグローバル）:
//   diskBuffer, setStatus, setFsStatus, _maybeAutoBoot, simStarted, worker
// index.html のインラインスクリプトより前に読み込んでよい
// （IndexedDB/fetch のコールバックは全スクリプト実行後に発火するため）。

var _IDB_NAME  = 'pdp11-soft-fpga';
var _IDB_VER   = 1;
var _IDB_STORE = 'disk';
var _idbHasSave = false;

function _openDiskDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(_IDB_NAME, _IDB_VER);
    req.onupgradeneeded = function(e) { e.target.result.createObjectStore(_IDB_STORE); };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function idbSaveDisk(bytes) {
  return _openDiskDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).put(bytes, 'disk');
      tx.oncomplete = resolve;
      tx.onerror    = function(e) { reject(e.target.error); };
    });
  });
}

function idbRestoreDisk() {
  return _openDiskDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx  = db.transaction(_IDB_STORE, 'readonly');
      var req = tx.objectStore(_IDB_STORE).get('disk');
      req.onsuccess = function(e) { resolve(e.target.result || null); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
}

function idbDeleteDisk() {
  return _openDiskDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).delete('disk');
      tx.oncomplete = resolve;
      tx.onerror    = function(e) { reject(e.target.error); };
    });
  });
}

function _onDiskReady(buf, fromIDB) {
  diskBuffer = buf;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('btn-boot').disabled = false;
  if (fromIDB) {
    _idbHasSave = true;
    document.getElementById('btn-reset-disk').style.display = '';
    setStatus('保存済みディスクを復元 — 自動ブート中...');
  } else {
    setStatus('Ready — 自動ブート中...');
  }
  _maybeAutoBoot();
}

function _fetchDiskFromServer() {
  document.getElementById('overlay-msg').textContent = 'Unix V6 ディスクイメージを読み込み中...';
  fetch('disk/unix_v6_rk05.dsk')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ': disk/unix_v6_rk05.dsk');
      var total = parseInt(r.headers.get('content-length') || '0', 10);
      var chunks = [], received = 0;
      var reader = r.body.getReader();
      var prog = document.getElementById('overlay-progress');
      function read() {
        return reader.read().then(function(x) {
          if (x.done) return new Blob(chunks).arrayBuffer();
          chunks.push(x.value);
          received += x.value.length;
          if (total > 0) prog.value = (received / total * 100) | 0;
          return read();
        });
      }
      return read();
    })
    .then(function(buf) { _onDiskReady(buf, false); })
    .catch(function(err) {
      document.getElementById('overlay-msg').textContent = 'Error: ' + err.message;
    });
}

// ── ディスクイメージ読み込み（IDB → サーバー）────────────────────────────
idbRestoreDisk()
  .then(function(saved) {
    if (saved && saved.byteLength > 0) {
      _onDiskReady(saved.buffer || saved, true);
    } else {
      _fetchDiskFromServer();
    }
  })
  .catch(function() { _fetchDiskFromServer(); });

// ── Save Disk / Reset Disk ボタン ─────────────────────────────────────────
document.getElementById('btn-save-disk').addEventListener('click', function() {
  if (!simStarted) return;
  setStatus('Exporting disk...');
  worker.postMessage({ type: 'exportDisk' });
});

document.getElementById('btn-reset-disk').addEventListener('click', function() {
  if (!confirm('IndexedDB の保存済みディスクを削除してサーバーから再ロードしますか？')) return;
  setFsStatus('保存済みディスクを削除中...');
  idbDeleteDisk().then(function() {
    _idbHasSave = false;
    document.getElementById('btn-reset-disk').style.display = 'none';
    setStatus('Deleted — ページをリロードしてください');
    setFsStatus('保存済みディスクを削除しました — ページをリロードしてください');
  }).catch(function(e) { console.error(e); setFsStatus('削除失敗: ' + e.message); });
});
