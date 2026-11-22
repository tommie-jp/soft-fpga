'use strict';
// sft-pdp11-scenarios.js — シナリオ: 記事で案内する「デバッグパネルの設定一式」を 1 回の操作で入れる
//
// 入口は 2 つあり、どちらも applyPdp11Scenario(name) を呼ぶ。
//   - 文書の中のリンク "?scenario=名前"（sft-pdp11-docs.js の linkHandlers）
//   - sim.applyScenario('名前')（DevTools / Playwright）
//
// 起動のときに自動で入れる入口（ページの URL など）は設けない。トリガーを待ち受けにするシナリオは、
// 入れる時機が結果を左右する（例: swtch-sswap は、ログインや cc の exec でも同じ経路を通って止まる）。
//
// 設定は、人が画面でする操作と同じ道を通す（欄に値を入れて change を出す・Set を押す）。
// 画面の表示と実際の設定が食い違わないようにするため。
//
// 依存（グローバル）:
//   worker / simStarted / simPaused / _trigArmed / _laFreezeHead / setStatus（sft-pdp11-worker-bridge.js）,
//   _doClearTrigger / window._pdp11TrigPresets（sft-pdp11-trigger-ui.js）,
//   PDP11_TRIGGER_PRESETS（sft-pdp11-la-defs.js）, window.la（RTLScopeLA）

var SCENARIO_APPLIED = 'applied';
var SCENARIO_FAILED  = 'failed';

// panels:  開くパネル（折りたたみボタンの id）
// fields:  欄の id → 値（change を出す）
// preset:  Trigger のプリセットのラベル（PDP11_TRIGGER_PRESETS）
// signals: LA に出す信号の id（これ以外は隠す）
// arm:     true なら最後に Set を押してトリガーを待ち受けにする
var PDP11_SCENARIOS = {
  // docs/09-PDP11/27 章 3.2: swtch() の SSWAP 経路（aretu(u.u_ssav) の手前）で止める
  'swtch-sswap': {
    label:   'V6 swtch: SSWAP path',
    panels:  ['btn-la-collapse', 'btn-stack-collapse'],
    fields:  { 'rk-delay-sel': '4096' },
    preset:  'V6 swtch: SSWAP path (aretu u_ssav)',
    signals: ['addr_v', 'data', 'bus_rd', 'pc', 'sp', 'r5', 'kisa6'],
    arm:     true,
  },
  // docs/09-PDP11/28 章 3 節: C のプログラムの最初の命令 SETD のトラップ（無視される側）
  'setd-crt0': {
    label:   'V6 crt0: SETD trap ignored',
    panels:  ['btn-la-collapse'],
    preset:  'V6 crt0: SETD at user 0 (trap ignored)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'trapped', 'sp'],
    arm:     true,
  },
  // docs/09-PDP11/28 章 6 節: SIGINS を捕まえているプログラム（units）では、同じトラップが fptrap へ届く
  'setd-fcrt0': {
    label:   'V6 units: SETD trap delivered to fptrap',
    panels:  ['btn-la-collapse', 'btn-stack-collapse'],
    preset:  'V6 units: fptrap entry (SIGINS caught)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'trapped', 'sp'],
    arm:     true,
  },
  // docs/09-PDP11/29 章: fork は戻り番地で親と子を分ける。親は 010002、子は 010000 へ戻る
  'fork-parent': {
    label:   'V6 fork: parent returns to bec',
    panels:  ['btn-la-collapse'],
    preset:  'V6 sh: fork returns in parent (bec 2f)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'r0', 'sp'],
    arm:     true,
  },
  'fork-child': {
    label:   'V6 fork: child returns to br',
    panels:  ['btn-la-collapse'],
    preset:  'V6 sh: fork returns in child (br 1f)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'r0', 'sp'],
    arm:     true,
  },
  'fork-child-kernel': {
    label:   'V6 fork: kernel stores parent pid for child',
    panels:  ['btn-la-collapse'],
    preset:  'V6 fork: child gets parent pid (fork+52)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'r0', 'kisa6'],
    arm:     true,
  },
  // docs/09-PDP11/32 章: シグナルは p_sig に書くだけ（psignal）。配るのはプロセス自身（psig）
  'sig-psignal': {
    label:   'V6 signal: DEL key sets p_sig',
    panels:  ['btn-la-collapse'],
    preset:  'V6 psignal: signal number written to p_sig',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'byte_op', 'pc', 'cm', 'bus_int', 'int_vec'],
    arm:     true,
  },
  'sig-psig': {
    label:   'V6 signal: psig pushes PS and PC on user stack',
    panels:  ['btn-la-collapse'],
    preset:  'V6 psig: frame pushed on user stack',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'psw', 'sp'],
    arm:     true,
  },
  'sig-handler': {
    label:   'V6 signal: handler returns with rtt',
    panels:  ['btn-la-collapse'],
    preset:  'V6 sig.c: SIGINT handler entry (tvect+20)',
    signals: ['addr_v', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'psw', 'sp'],
    arm:     true,
  },
  // docs/09-PDP11/33 章: 最初のユーザープロセス。'@' が出たあと、rkunix を打つ前に入れる
  'icode': {
    label:   'V6 icode: first user instruction',
    panels:  ['btn-la-collapse'],
    preset:  'V6 icode: first user instruction (sys exec)',
    signals: ['addr_v', 'addr_p', 'data', 'bus_rd', 'bus_wr', 'pc', 'cm', 'trapped', 'sp'],
    arm:     true,
  },
  // docs/09-PDP11/34 章: sync は bflush() の書き込みを待たずに戻る。RK seek を遅くして順序を見せる
  'sync-bflush': {
    label:   'V6 sync: bflush does not wait',
    panels:  ['btn-la-collapse'],
    fields:  { 'rk-delay-sel': '4096' },
    preset:  'V6 bflush: B_ASYNC set (write not awaited)',
    signals: ['pc', 'cm', 'rk_state', 'bus_int', 'int_vec', 'addr_v', 'data', 'bus_wr'],
    arm:     true,
  },
};

function _scenarioOpenPanel(btnId) {
  var btn = document.getElementById(btnId);
  if (!btn) { console.warn('[scenario] パネルのボタン #' + btnId + ' が見つかりません'); return; }
  if (btn.closest('.collapsed')) btn.click();
}

function _scenarioSetField(id, value) {
  var el = document.getElementById(id);
  if (!el) { console.warn('[scenario] 欄 #' + id + ' が見つかりません'); return; }
  el.value = String(value);
  el.dispatchEvent(new Event('change'));
}

// プリセットをラベルで探して入れる。見つからなければ false。
function _scenarioApplyPreset(label) {
  var idx = PDP11_TRIGGER_PRESETS.findIndex(function (p) { return p.label === label; });
  if (idx < 0 || !window._pdp11TrigPresets) return false;
  window._pdp11TrigPresets.apply(idx);
  return true;
}

function applyPdp11Scenario(name) {
  var sc = Object.prototype.hasOwnProperty.call(PDP11_SCENARIOS, name) ? PDP11_SCENARIOS[name] : null;
  if (!sc) {
    console.warn('[scenario] 未知のシナリオ: ' + name);
    setStatus('Unknown scenario: ' + name);
    return SCENARIO_FAILED;
  }
  if (!simStarted) {
    setStatus('Boot Unix V6 first, then apply the scenario');
    return SCENARIO_FAILED;
  }

  (sc.panels || []).forEach(_scenarioOpenPanel);
  Object.keys(sc.fields || {}).forEach(function (id) { _scenarioSetField(id, sc.fields[id]); });

  // 発火済み・待ち受け中のトリガーがあれば先に解除する（Set は押すたびに設定と解除が入れ替わる）
  if (_trigArmed || _laFreezeHead >= 0) _doClearTrigger();
  if (sc.preset && !_scenarioApplyPreset(sc.preset)) {
    console.warn('[scenario] プリセットが見つかりません: ' + sc.preset);
    setStatus('Scenario failed: preset not found');
    return SCENARIO_FAILED;
  }
  if (sc.signals && window.la && window.la.setVisibleSignals) window.la.setVisibleSignals(sc.signals);
  if (sc.arm) document.getElementById('btn-trig-set').click();

  // 前のトリガーや Pause で止まっていたら再開する（止まっている間にセットしたトリガーは残る）。
  // 状態欄は 'resumed' を受けた側が Running に書き換えるので、再開しないときだけここで書く
  if (simPaused) worker.postMessage({ type: 'resume' });
  else setStatus('Scenario ready: ' + sc.label);
  return SCENARIO_APPLIED;
}
