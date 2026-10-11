'use strict';
// sft-pdp11-worker-bridge.js — Web Worker 生成・メッセージ送受信・rAF 描画スロットル
//
// Worker からの全メッセージ（tty / ring / mmu / triggered / FS 応答…）を受けて
// 各パネルの描画関数へ振り分ける。Worker URL はドキュメント相対で解決されるため
// このファイルを共有 js/ に置いても 'sim-worker.js' は web/ のものを指す。
//
// 依存（実行時に解決されるグローバル）:
//   term（xterm）, la（RTLScopeLA）, _termUI,
//   checkBootTTY / resetBootProgress / updateRegs / updateGPRDisplay /
//   updateMMUPanel（sft-pdp11-debug-panel.js）,
//   _requestFSList / _jstreeCallbacks / _buildJstreeChildNodes / setFsStatus /
//   _fsSelPath / _fsSelNodeId（sft-pdp11-fs-panel.js）,
//   idbSaveDisk / _idbHasSave（sft-pdp11-disk.js）,
//   onTriggered / _updateTrigButtons（sft-pdp11-trigger-ui.js）,
//   _applySampleRate / openEditorWithContent / laFrozen（index.html）,
//   RING_WORDS_PDP11 / pdp11TrigAnchorF1（sft-pdp11-la-defs.js）

var worker = new Worker('sim-worker.js');
var simStarted  = false;
var simPaused   = false;
var _preQueue   = [];  // simStarted 前の先行入力バッファ
var diskBuffer  = null;
var _workerReady = false;

// URL に ?autoboot=0 が指定されたら自動ブートを抑止する。
// ベアメタル用途（タイミング図テスト等で Unix V6 を起動したくない場合）向け。
// 抑止時は btn-boot を有効のまま残し、手動ブートできるようにする。
var _autoBootEnabled = new URLSearchParams(location.search).get('autoboot') !== '0';

// worker 準備完了 ＆ ディスク読込完了の両方が揃ったら自動でブートする。
// どちらが先に完了しても確実に 1 度だけ起動する。
function _maybeAutoBoot() {
  if (!_autoBootEnabled) return;
  if (!_workerReady || !diskBuffer || simStarted) return;
  document.getElementById('btn-boot').disabled = true;
  startSim();
}

var localRing  = null;
var _ringSize  = 4096;
var _ringWords = RING_WORDS_PDP11;
var _pendingTrigHead     = false;
var _pendingTrigFireHead = -1;
var _pendingTrigType     = 0;
var _laFreezeHead        = -1;     // トリガー発火後: head を固定してビュードリフトを防ぐ
var _trigArmed           = false;  // Set 成功後 true、Clear で false

worker.onmessage = function(e) {
  var d = e.data;
  switch (d.type) {
    case 'ready':
      _ringSize  = d.ringSize  || 4096;
      _ringWords = d.ringWords || RING_WORDS_PDP11;
      localRing  = new Uint32Array(_ringSize * _ringWords);
      _workerReady = true;
      _maybeAutoBoot();
      break;

    case 'started':
      setStatus('Running');
      document.getElementById('btn-reset').disabled = false;
      document.getElementById('btn-pause').disabled = false;
      simStarted = true; simPaused = false;
      // simStarted 前に積んだ先行入力をフラッシュ
      for (var _pqi = 0; _pqi < _preQueue.length; _pqi++) {
        worker.postMessage({ type: 'key', ch: _preQueue[_pqi] });
      }
      _preQueue = [];
      _updateTrigButtons();
      document.getElementById('btn-pause').textContent = 'Pause';
      document.getElementById('boot-progress').classList.add('show');
      document.getElementById('mmu-panel').classList.add('show');
      document.getElementById('btn-save-disk').disabled = false;
      resetBootProgress();
      // sim_init() が ring_tick_mask=3u にリセットするため UI の選択を再適用する
      _applySampleRate();
      // FS パネルの初回取得（ディスクロード後）
      setTimeout(function() { _requestFSList(); }, 500);
      break;

    case 'paused':
      setStatus('Paused');
      simPaused = true;
      document.getElementById('btn-pause').textContent = 'Resume';
      break;

    case 'resumed':
      setStatus('Running');
      simPaused = false;
      _laFreezeHead = -1;   // フリーズ解除: live 追従に戻す
      _trigArmed = false;
      _updateTrigButtons();
      document.getElementById('btn-pause').textContent = 'Pause';
      break;

    case 'tty':
      var s = '';
      for (var i = 0; i < d.chars.length; i++) {
        var c = d.chars[i];
        if (c === 13) s += '\r';
        else if (c === 10) s += '\n';
        else s += String.fromCharCode(c);
      }
      term.write(s);
      checkBootTTY(s);
      break;

    case 'ring': {
      var snap  = new Uint32Array(d.snap);
      var count = snap.length / _ringWords;
      var prevHead = (d.head - count) >>> 0;
      for (var ri = 0; ri < count; ri++) {
        var idx = ((prevHead + ri) >>> 0) % _ringSize;
        for (var w = 0; w < _ringWords; w++) {
          localRing[idx * _ringWords + w] = snap[ri * _ringWords + w];
        }
      }
      // 式トリガーは Worker の Wasm ネイティブ評価に移管済み（'triggered' で通知される）
      // トリガー T=0 の決定:
      //   PC/Fetch 等のハードウェアトリガー: istate=f1 の立ち上がり（フェッチ開始）に吸着
      //   式トリガー (type 7): f1 アンカリングを適用しない。発火サンプル自体を T=0 にする。
      //     fireHead = _xabs + 1（発火サンプルの 1 つ後ろ）なので、T=0 = fireHead - 1 = _xabs。
      var _trigForUpdate;
      var _didTrigRender = false;
      if (_pendingTrigHead) {
        var _anchorHead = (_pendingTrigFireHead >= 0) ? _pendingTrigFireHead : d.head;
        if (_pendingTrigType === 7) {
          // 式トリガー: 発火サンプル（fireHead - 1）をそのまま T=0 にする
          _trigForUpdate = (_pendingTrigFireHead >= 0) ? ((_pendingTrigFireHead - 1) >>> 0) : (_anchorHead >>> 0);
        } else {
          _trigForUpdate = pdp11TrigAnchorF1(localRing, _anchorHead, _ringSize, _ringWords);
        }
        _laFreezeHead = d.head;   // 発火時の head を固定: 以後の ring フレームでドリフトしない
        _updateTrigButtons();     // Resume を有効化
        // トリガー発火: フリーズビューを即座に描画する
        la.update(_laFreezeHead, localRing, true, _trigForUpdate);
        updateRegs(snap, d.gpr);
        _didTrigRender = true;
      }
      _pendingTrigHead     = false;
      _pendingTrigFireHead = -1;
      _pendingTrigType     = 0;

      // 描画バッファ更新（rAF 描画で使用）
      _latestRingHead = d.head;
      _latestGpr      = d.gpr;
      _latestSnap     = snap;

      // 通常時: rAF に委ねて 60fps にスロットル（トリガー発火時は既に即描画済み）
      if (!_didTrigRender) {
        _laDirty = true;
        _scheduleRafRender();
      }

      _ringCount++; if (d.steps) _lastSteps = d.steps;
      _updateCycleInfo();
      break;
    }

    case 'gpr':
      updateGPRDisplay(d.gpr);
      break;

    case 'mmu':
      updateMMUPanel(new Uint32Array(d.snap));
      break;

    case 'triggered':
      onTriggered(d.pc, d.trigType);
      _pendingTrigHead     = true;
      _pendingTrigFireHead = (d.fireHead !== undefined && d.fireHead >= 0) ? (d.fireHead >>> 0) : -1;
      _pendingTrigType     = d.trigType | 0;
      break;

    case 'bare_ready':
      window._pdp11BareReady = true;
      break;

    case 'bare_stepped':
      window._pdp11BareStepped = true;
      break;

    case 'stepped':
      break;

    case 'diskExported': {
      var _bytes = new Uint8Array(d.data);
      idbSaveDisk(_bytes).then(function() {
        _idbHasSave = true;
        document.getElementById('btn-reset-disk').style.display = '';
        setStatus('Disk saved ✓');
        setTimeout(function() { setStatus(simPaused ? 'Paused' : 'Running'); }, 2000);
      }).catch(function(e) {
        console.error('[IDB] save failed', e);
        setStatus('Save failed');
      });
      break;
    }
    case 'diskExportError':
      console.error('[exportDisk]', d.msg);
      break;

    // ── Freeze ─────────────────────────────────────────────────────────
    case 'frozen':
      laFrozen = true;
      document.getElementById('btn-la-freeze').textContent = 'Unfreeze';
      document.getElementById('frozen-badge').style.display = '';
      document.getElementById('r-frozen-badge').style.display = '';
      setStatus('Frozen');
      break;

    case 'unfrozen':
      laFrozen = false;
      document.getElementById('btn-la-freeze').textContent = 'Freeze';
      document.getElementById('frozen-badge').style.display = 'none';
      document.getElementById('r-frozen-badge').style.display = 'none';
      setStatus('Running');
      break;

    // ── スクリプト（マクロ）状態 ────────────────────────────────────────
    case 'scriptStarted': {
      var sStat = document.getElementById('macro-status');
      var sStop = document.getElementById('btn-macro-stop');
      if (sStat) sStat.textContent = 'Script: ' + d.name;
      if (sStop) sStop.style.display = '';
      break;
    }

    case 'scriptEnded': {
      var eStat = document.getElementById('macro-status');
      var eStop = document.getElementById('btn-macro-stop');
      if (eStat) eStat.textContent = '';
      if (eStop) eStop.style.display = 'none';
      break;
    }

    case 'scriptWarn': {
      var wStat = document.getElementById('macro-status');
      if (wStat) wStat.textContent = 'Warn: ' + (d.msg || '');
      break;
    }

    case 'fsError':
      term.write('\r\n[FS Error] ' + (d.msg || '') + '\r\n');
      break;

    case 'v6WriteFileDone': {
      term.write('\r\n[Editor] ' + d.path + ' (inode ' + d.ino + ')\r\n');
      setFsStatus(d.path + ' 書き込み完了');
      if (simStarted) {
        var _v6FsEl = document.getElementById('fs-list');
        if (_v6FsEl) {
          var _wDir = d.path.replace(/\/[^\/]+$/, '') || '/';
          $(_v6FsEl).one('refresh.jstree', function() {
            var _jt = $(this).jstree(true);
            var _root = _jt.get_node('#');
            if (_root && _root.children) {
              _root.children.forEach(function(cId) {
                var _c = _jt.get_node(cId);
                if (_c && _c.data && _c.data.path === _wDir) _jt.open_node(_c);
              });
            }
          });
          $(_v6FsEl).jstree(true).refresh();
        }
      }
      break;
    }

    case 'v6WriteFileError':
      term.write('\r\n[Editor Error] ' + (d.error || '不明なエラー') + '\r\n');
      setFsStatus('エラー: ' + (d.error || '書き込み失敗'));
      break;

    // ── FS エントリ（listFS 応答）──────────────────────────────────────
    case 'fsEntries':
      if (d.requestId && _jstreeCallbacks[d.requestId]) {
        // jstree データ関数コールバック（初回ロード or 遅延ロード）
        var _cbInfo = _jstreeCallbacks[d.requestId];
        delete _jstreeCallbacks[d.requestId];
        var _cbEl = document.getElementById('fs-list');
        if (_cbEl && typeof $ !== 'undefined') {
          _cbInfo.cb.call($(_cbEl).jstree(true), _buildJstreeChildNodes(d.entries));
        }
      } else if (d.requestId === 'tty') {
        // !ls コマンド → ターミナルに表示（サイズ付き）
        var ents2 = (d.entries || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name); });
        var lines2 = ents2.map(function(e) {
          var flag = e.isDir ? 'd' : '-';
          var sz   = e.isDir ? '' : String(e.size).padStart(7) + ' B';
          return flag + ' ' + e.name.padEnd(20) + sz;
        });
        term.write('\r\n' + (lines2.length ? lines2.join('\r\n') : '(empty)') + '\r\n');
      }
      break;

    // ── FS ファイル読み取り（readFS 応答）──────────────────────────────
    case 'fsFile':
      if (d.requestId === 'tty') {
        // !type → ターミナルに表示
        var bytes2 = new Uint8Array(d.data);
        var text2  = new TextDecoder('utf-8', { fatal: false }).decode(bytes2);
        term.write('\r\n' + text2.replace(/\n/g, '\r\n') + '\r\n');
      } else if (d.requestId === 'download') {
        // !get → ブラウザダウンロード
        var blob  = new Blob([d.data]);
        var url   = URL.createObjectURL(blob);
        var a     = document.createElement('a');
        var fname = (d.path || 'file').replace(/.*\//, '');
        a.href = url; a.download = fname;
        a.click();
        URL.revokeObjectURL(url);
      } else if (d.requestId === 'edit') {
        // ✏ Edit → バイナリ判定（先頭 512 バイトにヌルバイトがあればバイナリ）
        var bytes3  = new Uint8Array(d.data);
        var scanLen = Math.min(bytes3.length, 512);
        var isBin   = false;
        for (var bi = 0; bi < scanLen; bi++) { if (bytes3[bi] === 0) { isBin = true; break; } }
        if (isBin) {
          alert(d.path + '\nバイナリファイルはテキストエディタで開けません。');
        } else {
          var text3 = new TextDecoder('utf-8', { fatal: false }).decode(bytes3);
          openEditorWithContent(d.path, text3);
        }
      }
      break;

    // ── writeFS 完了 ────────────────────────────────────────────────────
    case 'fsWritten':
      if (simStarted) _requestFSList();
      break;

    // ── deleteFS 完了 ───────────────────────────────────────────────────
    case 'fsDeleted':
      term.write('\r\nDeleted: ' + (d.name || '') + '\r\n');
      break;

    // ── V6 FS ファイル操作完了 / エラー ─────────────────────────────────
    case 'v6OpDone': {
      var _fsEl = document.getElementById('fs-list');
      if (d.op === 'remove' && _fsSelNodeId && _fsEl) {
        $(_fsEl).jstree(true).delete_node(_fsSelNodeId);
        _fsSelPath = null; _fsSelNodeId = null;
        var _bDl   = document.getElementById('btn-fs-dl');
        var _bEdit = document.getElementById('btn-fs-edit');
        var _bDel  = document.getElementById('btn-fs-delete');
        if (_bDl)   _bDl.disabled   = true;
        if (_bEdit) _bEdit.disabled = true;
        if (_bDel)  _bDel.disabled  = true;
      } else if (d.op === 'move' && _fsEl) {
        // ノードの data.path が旧パスのままなので refresh して再同期
        $(_fsEl).jstree(true).refresh();
      }
      break;
    }
    case 'v6OpError':
      console.error('[V6 FS]', d.msg);
      if (d.op === 'move') {
        var _fsEl2 = document.getElementById('fs-list');
        if (_fsEl2) $(_fsEl2).jstree(true).refresh();
      }
      break;

    // ── ディスクエクスポート ─────────────────────────────────────────────
    case 'diskData': {
      var dblob = new Blob([d.data]);
      var durl  = URL.createObjectURL(dblob);
      var da    = document.createElement('a');
      da.href = durl; da.download = 'unix_v6_rk05.dsk';
      da.click();
      URL.revokeObjectURL(durl);
      setFsStatus('ディスクイメージをエクスポートしました (unix_v6_rk05.dsk)');
      break;
    }
  }
};

function setStatus(msg) { document.getElementById('status').textContent = msg; }

function startSim() {
  setStatus('Initializing...');
  worker.postMessage({ type: 'start', disk: diskBuffer }, [diskBuffer]);
  diskBuffer = null;
}

// ── LA canvas 描画スロットル（rAF 60fps）────────────────────────────────
// ring メッセージは式トリガー有効時に 700+ 回/秒届くことがある。
// la.update()（canvas 描画）は rAF に委ねて 60fps に間引く。
// トリガー発火時のみ即座に描画する（フリーズビューの確実な表示のため）。
var _laDirty        = false;
var _rafId          = null;
var _latestRingHead = 0;
var _latestGpr      = null;
var _latestSnap     = null;

function _scheduleRafRender() {
  if (!_rafId) _rafId = requestAnimationFrame(_rafRender);
}

function _rafRender() {
  _rafId = null;
  if (!_laDirty) return;
  _laDirty = false;
  var head = (_laFreezeHead >= 0) ? _laFreezeHead : _latestRingHead;
  la.update(head, localRing, _laFreezeHead >= 0, undefined);
  if (_latestSnap && _latestSnap.length >= _ringWords) updateRegs(_latestSnap, _latestGpr);
}

// ── cycle-info 更新 (H) ───────────────────────────────────────────────────
// 実機比較の基準クロック: 本 RTL は CLR reg = 5 tick で、これが実機の CLR
// レジスタ ≈ 1.5µs に整合する（22 章 Q3 のタイミング検証）。
// よって 5 tick ÷ 1.5µs ≈ 3.33 MHz が「この RTL が実機速度で動くときの
// tick レート」= 実機比較 100% の基準値。
var REAL_PDP11_MHZ = 3.33;
var _ringCount = 0, _lastHzTime = 0, _lastSteps = 200000;
function _updateCycleInfo() {
  var now = Date.now();
  if (_lastHzTime === 0) { _lastHzTime = now; return; }
  var dt = now - _lastHzTime;
  if (dt < 800) return;
  var fps    = _ringCount * 1000 / dt;
  var mhzNum = _lastSteps * fps / 1e6;
  var mhz    = mhzNum.toFixed(1);
  var pct    = Math.round(mhzNum / REAL_PDP11_MHZ * 100);
  var el     = document.getElementById('cycle-info');
  if (el) el.textContent = mhz + ' MHz (' + pct + '%)';
  _ringCount = 0;
  _lastHzTime = now;
}
