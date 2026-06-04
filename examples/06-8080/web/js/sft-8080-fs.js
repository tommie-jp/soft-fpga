// sft-8080-fs.js — WASM FS ファイルリスト・ドライブ管理・IndexedDB 永続化
//
// 06-8080 Web UI から分離。関数定義のみ（buildDrivesPanel() の初回呼び出し等の即時実行は index.html 側）。
// グローバル参照: workerRequest / workerSend（worker-bridge）, workerReady / curPreset /
//   diskNames / customDisks / diskTimes / fsDirty / running / term / DRIVE_LABELS / PRESET_NAMES,
//   window.openEditorFile / window.openEditorFallback。いずれも同一グローバルスコープで共有され機能不変。

// ---- WASM FS ファイルリスト ----
function fmtSize(n) {
  if (n >= 1024) return (n >> 10) + 'K';
  return n + 'B';
}

function fmtMtime(mtime) {
  var d = new Date(mtime);
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var mi = String(d.getMinutes()).padStart(2, '0');
  return mm + '/' + dd + ' ' + hh + ':' + mi;
}

async function downloadFromFS(name) {
  try {
    var result = await workerRequest({ type: 'readFS', name: name });
    var blob = new Blob([new Uint8Array(result.data)], { type: 'application/octet-stream' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  } catch(e) { console.error('[FS] download failed:', e); }
}

function fmtHz(hz) {
  var mhz = Math.floor(hz / 1000000);
  var khz = Math.floor((hz % 1000000) / 1000);
  var h   = Math.floor(hz % 1000);
  if (mhz > 0)
    return mhz + ',' + String(khz).padStart(3,'0') + ',' + String(h).padStart(3,'0') + ' Hz';
  if (khz > 0)
    return khz + ',' + String(h).padStart(3,'0') + ' Hz';
  return h + ' Hz';
}

// テキストファイルとして扱う拡張子（クリック → エディタ、それ以外 → ダウンロード）
var TEXT_EXTS = { TXT:1, ASM:1, MAC:1, C:1, H:1, BAS:1, SUB:1, FOR:1,
                  PAS:1, PLI:1, DOC:1, ME:1, INI:1, CFG:1, BAT:1 };

var fsSort = { col: 'mtime', asc: false };

async function updateFSList() {
  if (!workerReady) return;
  var el      = document.getElementById('fs-list');
  var theadEl = document.getElementById('fs-thead-fixed');
  try {
    var result  = await workerRequest({ type: 'listFS' });
    var entries = result.entries;

    entries.sort(function(a, b) {
      var v;
      if (fsSort.col === 'size') {
        // K表示単位（1K=1024〜2047, 2K=2048〜4095…）でまず比較し、
        // 同一K単位内はファイル名でタイブレーク
        var aK = Math.floor(Number(a.size) / 1024);
        var bK = Math.floor(Number(b.size) / 1024);
        v = aK !== bK ? (aK - bK) : a.name.localeCompare(b.name);
      } else if (fsSort.col === 'mtime') {
        v = a.mtime - b.mtime;
      } else {
        v = a.name.localeCompare(b.name);
      }
      return fsSort.asc ? v : -v;
    });

    if (!entries.length) {
      if (theadEl) theadEl.innerHTML = '';
      el.innerHTML = '<div style="color:#aaa;font-size:11px;">(empty)</div>';
      return;
    }

    var COLS = [
      { key:'name',  label:'Name' },
      { key:'size',  label:'Size' },
      { key:'mtime', label:'Time' },
    ];
    var arrow = { asc:' ↑', desc:' ↓' };
    var thead = '<div class="fs-thead">' +
      COLS.map(function(c) {
        var a = (fsSort.col === c.key) ? (fsSort.asc ? arrow.asc : arrow.desc) : '';
        return '<span class="fs-th' + (fsSort.col===c.key?' active':'') +
               '" data-col="' + c.key + '">' + c.label + a + '</span>';
      }).join('') + '</div>';

    var escHtml = function(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    var rows = entries.map(function(e) {
      var nm = escHtml(e.name);
      return '<div class="fs-row" data-name="' + nm + '" title="Click to download | CP/M: R ' + nm + '">' +
        '<span class="fs-name">' + nm + '</span>' +
        '<span class="fs-sz">'  + fmtSize(e.size) + '</span>' +
        '<span class="fs-mt">'  + fmtMtime(e.mtime) + '</span>' +
        '</div>';
    }).join('');

    // ヘッダは固定コンテナ (#fs-thead-fixed) へ、行だけ #fs-list (スクロール可能) へ
    if (theadEl) theadEl.innerHTML = thead;
    el.innerHTML = rows;

    // ヘッダのソートクリックを固定コンテナに登録
    (theadEl || el).querySelectorAll('.fs-th').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = this.getAttribute('data-col');
        if (fsSort.col === col) fsSort.asc = !fsSort.asc;
        else { fsSort.col = col; fsSort.asc = true; }
        updateFSList();
      });
    });

    el.querySelectorAll('.fs-row').forEach(function(row) {
      row.addEventListener('click', function() {
        if (!workerReady) return;
        var name = this.getAttribute('data-name');
        var dot  = name.lastIndexOf('.');
        var ext  = dot >= 0 ? name.slice(dot + 1).toUpperCase() : '';
        if (TEXT_EXTS[ext]) {
          var fn = window.openEditorFile || window.openEditorFallback;
          if (fn) fn(name);
        } else {
          downloadFromFS(name);
        }
      });
    });
  } catch(e) { el.textContent = '(error)'; }
}

function buildDrivesPanel() {
  const panel = document.getElementById('drives-panel');
  panel.innerHTML = '';
  for (let d = 0; d < 4; d++) {
    const row = document.createElement('div');
    row.className = 'drive-row';
    row.innerHTML =
      '<span class="drive-lbl">' + DRIVE_LABELS[d] + ':</span>' +
      '<span class="drive-name" id="dn-' + d + '">' + diskNames[d] + '</span>' +
      '<span class="drive-time" id="dt-' + d + '">—</span>' +
      '<label class="btn-load" title="Load disk image">' +
        'Load<input type="file" id="fu-' + d + '" accept=".dsk,.img" style="display:none">' +
      '</label>' +
      '<button class="btn-save" id="sv-' + d + '" title="Save to browser (IndexedDB)">Save</button>' +
      '<button class="btn-dl"   id="dl-' + d + '" title="Download to file">↓</button>';
    panel.appendChild(row);

    (function(drive) {
      document.getElementById('fu-' + drive).addEventListener('change', async function() {
        if (!this.files.length) return;
        const file = this.files[0];
        const buf  = await file.arrayBuffer();
        customDisks[drive] = new Uint8Array(buf);
        diskNames[drive]   = file.name;
        document.getElementById('dn-' + drive).textContent = file.name;
        setDiskTime(drive, Date.now());
        if (workerReady) applyOneDisk(drive);
        this.value = ''; // allow re-selecting same file
      });
      document.getElementById('sv-' + drive).addEventListener('click', function() {
        if (workerReady) idbSaveDisk(drive);
      });
      document.getElementById('dl-' + drive).addEventListener('click', function() {
        if (workerReady) downloadDisk(drive);
      });
    })(d);
  }
}

function setDiskTime(drive, ms) {
  diskTimes[drive] = ms;
  var el = document.getElementById('dt-' + drive);
  if (el) el.textContent = ms ? fmtMtime(ms) : '—';
}

function applyOneDisk(drive) {
  if (!customDisks[drive]) return;
  const copy = customDisks[drive].slice(); // Transferable に渡すため独立コピー
  workerSend({ type: 'loadDisk', drive: drive, data: copy.buffer }, [copy.buffer]);
}

function applyCustomDisks() {
  for (let d = 0; d < 4; d++) applyOneDisk(d);
}

function loadPreset(id) {
  customDisks = [null, null, null, null];
  diskNames   = PRESET_NAMES[id].slice();
  curPreset   = id;
  diskTimes = [null, null, null, null];
  for (let d = 0; d < 4; d++) {
    document.getElementById('dn-' + d).textContent = diskNames[d];
    setDiskTime(d, null);
  }
  if (!workerReady) return;
  workerSend({ type: 'reset', preset: id, running: false });
  running = false;
  document.getElementById('btn-run').textContent = 'Run';
  if (term) { term.reset(); term.focus(); }
  for (let d = 0; d < 4; d++) updateDirtyBtn(d, false);
}

async function downloadDisk(drive) {
  const result = await workerRequest({ type: 'getDiskData', drive: drive });
  const blob = new Blob([new Uint8Array(result.data)], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.style.display = 'none';
  a.href     = url;
  a.download = diskNames[drive] === '(blank)'
    ? ('drive' + DRIVE_LABELS[drive] + '.dsk')
    : diskNames[drive];
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function updateDirtyBtn(drive, dirty) {
  const btn = document.getElementById('sv-' + drive);
  if (!btn) return;
  btn.classList.toggle('dirty', dirty);
  btn.textContent = dirty ? '*Save*' : 'Save';
}

// ---- IndexedDB ----
function openCpmDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('cpm-disks', 2);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('disks'))
        db.createObjectStore('disks', { keyPath: 'drive' });
      if (!db.objectStoreNames.contains('fs'))
        db.createObjectStore('fs', { keyPath: 'name' });
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function updateFSSaveBtn() {
  var btn = document.getElementById('btn-save-fs');
  if (!btn) return;
  btn.classList.toggle('dirty', fsDirty);
  btn.textContent = fsDirty ? '*Save*' : 'Save';
}

function markFSDirty() {
  fsDirty = true;
  updateFSSaveBtn();
}

async function idbSaveFS() {
  if (!workerReady) return;
  try {
    var listResult = await workerRequest({ type: 'listFS' });
    var fileData   = [];
    for (var e of listResult.entries) {
      var r = await workerRequest({ type: 'readFS', name: e.name });
      fileData.push({ name: e.name, data: new Uint8Array(r.data), mtime: e.mtime });
    }
    var db = await openCpmDB();
    await new Promise(function(resolve, reject) {
      var tx = db.transaction('fs', 'readwrite');
      var store = tx.objectStore('fs');
      store.clear();
      fileData.forEach(function(e) { store.put(e); });
      tx.oncomplete = resolve;
      tx.onerror = function(ev) { reject(ev.target.error); };
    });
    fsDirty = false;
    updateFSSaveBtn();
    console.log('[IDB] WASM FS saved (' + fileData.length + ' files)');
  } catch(e) { console.error('[IDB] FS save error', e); }
}

function idbRestoreFS() {
  return new Promise(function(resolve, reject) {
    openCpmDB().then(function(db) {
      var req = db.transaction('fs', 'readonly').objectStore('fs').getAll();
      req.onsuccess = function(e) { resolve(e.target.result || []); };
      req.onerror   = function(e) { reject(e.target.error); };
    }).catch(reject);
  });
}

async function idbSaveDisk(drive) {
  if (!workerReady) return;
  try {
    var result = await workerRequest({ type: 'getDiskData', drive: drive });
    var data   = new Uint8Array(result.data);
    var name   = diskNames[drive];
    var mtime  = Date.now();
    var db     = await openCpmDB();
    await new Promise(function(resolve, reject) {
      var tx = db.transaction('disks', 'readwrite');
      tx.objectStore('disks').put({ drive: drive, data: data, name: name, mtime: mtime });
      tx.oncomplete = resolve;
      tx.onerror = function(ev) { reject(ev.target.error); };
    });
    setDiskTime(drive, mtime);
    workerSend({ type: 'clearDirty', drive: drive });
    updateDirtyBtn(drive, false);
    console.log('[IDB] drive ' + DRIVE_LABELS[drive] + ': saved (' + name + ')');
  } catch(e) { console.error('[IDB] save error', e); }
}

function idbRestoreAll() {
  return new Promise(function(resolve, reject) {
    openCpmDB().then(function(db) {
      var req = db.transaction('disks', 'readonly').objectStore('disks').getAll();
      req.onsuccess = function(e) { resolve(e.target.result || []); };
      req.onerror   = function(e) { reject(e.target.error); };
    }).catch(reject);
  });
}
