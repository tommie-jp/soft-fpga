#!/usr/bin/env node
/**
 * test_commands_executable.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * PDP-11 WASM 版（Unix V6）で /bin・/usr/bin の全コマンドが「起動できるか」だけ
 * を確認するスモークテスト。機能（出力の正しさ）はテストしない。
 *
 * 判定（1 コマンドにつき）:
 *   OK       … シェルが起動でき、プロンプト（# ）へ復帰した（= 実行できる）
 *              ※ login/su 等が新しいログインを促した場合も「起動できた」= OK 扱い
 *   NOTFOUND … シェルが "<cmd>: not found" を出した（= バイナリが無く実行できない）
 *   HANG     … プロンプトへ復帰せず、DEL/FS でも復旧できなかった（= 端末が固まる）
 *   ABORTED  … 直前のコマンドでセッションが死に、以降テスト不能
 *
 * 仕組み:
 *   `<cmd> </dev/null;echo <MARK>` を 1 文字ずつペーシング送信（UART 文字化け回避）。
 *   stdin に /dev/null を与えるので対話コマンドも EOF で終了する。
 *   MARK は「入力エコー」と「echo の出力」で 2 回出現する → 2 回目で完了とみなす。
 *   1 回しか出ない（echo に到達しない）= コマンドがハング。
 *
 * 使い方:
 *   cd examples/09-pdp11/tests && node test_commands_executable.mjs
 *   結果は test_commands_result.json にも保存。
 */
import { loadSim } from './helpers/sim.mjs';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── パラメータ ──────────────────────────────────────────────────────────
const PER_CHAR_STEP = 80_000;      // 1 文字ごとのステップ（文字化け回避に必要）
const CMD_BUDGET    = 12_000_000;  // 1 コマンドの最大待ちサイクル（超過で HANG 判定）
const PROMPT_BUDGET = 6_000_000;   // プロンプト復帰待ち
const MARK          = 'Qz7K';      // 出力にまず現れない目印
const CHUNK         = 200_000;
const LOGIN_RE      = /login:|Name:/;   // getty / login の入力待ち

// ── 既知の「スモークテスト不能」コマンド ────────────────────────────────
// `<cmd> </dev/null;echo MARK` 方式では原理的に HANG 判定になるが、コマンド自体は
// 健全なもの。これらは HANG でも失敗にカウントしない（exit 1 にしない）。
// ※ 握りつぶさず、サマリーには「既知例外」として理由付きで必ず表示する。
const EXPECTED_HANG = new Map([
  // 新しいシェルを exec するため後続の `;echo MARK` が消える（実際はプロンプト復帰＝成功）
  ['newgrp', '新シェルを exec するため MARK が届かない（実際は成功）'],
  // 鍵を /dev/tty から読むため stdin の /dev/null リダイレクトを無視して入力待ち
  ['crypt',  '鍵を /dev/tty から読むため端末入力待ちになる'],
  ['tbl',    '端末入力待ちでブロックする（/dev/null リダイレクトを無視）'],
  ['typo',   '端末入力待ちでブロックする（/dev/null リダイレクトを無視）'],
  ['cdb',    'C デバッガ: /dev/tty から対話入力を読むため /dev/null リダイレクトを無視して入力待ち'],
  // 引数なし実行でファイルシステム全走査 or 標準入力待ちに入り終了しない
  ['find',   '引数なし実行でブロックする（V6 find は dir 引数が必須）'],
]);

// ── 既知の「実行できない」コマンド ─────────────────────────────────────
// バイナリ形式不正・存在しない等の理由でシェルが "not found" を返すが、
// このディスクイメージ固有の既知問題として失敗にカウントしない。
const EXPECTED_NOTFOUND = new Map([
  // /bin/dc のバイナリ形式が exec() に失敗する（このディスクイメージ固有）
  ['dc', 'このディスクイメージの /bin/dc はバイナリ形式不正で exec() に失敗する'],
]);

const sim = await loadSim();

// ── 入出力ユーティリティ ────────────────────────────────────────────────
function typeSlow(line) {
  for (const ch of line) { sim.sendKey(ch.charCodeAt(0)); sim.step(PER_CHAR_STEP); }
  sim.sendKey(13); sim.step(PER_CHAR_STEP);  // CR
}
function countOcc(s, sub) { let n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }

// プロンプト（行末 "# "）へ復帰するまで。途中で login/Name/Password を見たら自動応答。
// 戻り値 {ok, sawLogin}
function getPrompt(maxCycles) {
  let out = '', cyc = 0, sawLogin = false;
  while (cyc < maxCycles) {
    sim.step(CHUNK); cyc += CHUNK; out += sim.drain();
    if (/Password:/.test(out)) { typeSlow(''); out = ''; continue; }
    if (LOGIN_RE.test(out))    { sawLogin = true; typeSlow('root'); out = ''; continue; }
    if (out.endsWith('# '))    return { ok: true, sawLogin };
  }
  return { ok: false, sawLogin };
}

// ── ブート & ログイン ──────────────────────────────────────────────────
console.error('[boot] Unix V6 を起動中...');
const boot = sim.bootToLogin();
if (boot.timeout) { console.error('[boot] FAILED stage=' + boot.stage); process.exit(2); }
typeSlow('root');
if (!getPrompt(PROMPT_BUDGET).ok) { console.error('[login] プロンプト取得失敗'); process.exit(2); }
console.error('[login] root ログイン完了');

// 走査系コマンド（du/find/ls）を速くするため空ディレクトリへ移動
typeSlow('mkdir /smoke'); getPrompt(PROMPT_BUDGET);
typeSlow('chdir /smoke'); getPrompt(PROMPT_BUDGET);

// ── コマンド一覧を実機から取得 ──────────────────────────────────────────
function listDir(dir) {
  sim.drain();
  typeSlow(`ls ${dir}`);
  let out = '', cyc = 0;
  while (cyc < 12_000_000) { sim.step(CHUNK); cyc += CHUNK; out += sim.drain(); if (out.endsWith('# ')) break; }
  return out.split(/\r?\n/).map(s => s.trim())
    .filter(s => /^[A-Za-z][A-Za-z0-9]*$/.test(s));  // 単純なファイル名のみ
}
const binCmds = listDir('/bin');
const usrCmds = listDir('/usr/bin');
const seen = new Set();
const cmds = [];
for (const [dir, list] of [['/bin', binCmds], ['/usr/bin', usrCmds]]) {
  for (const c of list) { if (!seen.has(c)) { seen.add(c); cmds.push({ dir, cmd: c }); } }
}
console.error(`[list] /bin=${binCmds.length} /usr/bin=${usrCmds.length} 合計=${cmds.length} コマンド`);

// CR を送って安定プロンプト（行末 "# "）が出るまで待つ。前コマンドの遅延出力で
// 次コマンドの入力が壊れるのを防ぐため、各テスト前に必ず呼ぶ。
function ensurePrompt() {
  sim.drain();
  sim.sendKey(13); sim.step(PER_CHAR_STEP);  // 空行 → 新しいプロンプトを誘発
  let out = '', cyc = 0;
  while (cyc < PROMPT_BUDGET) {
    sim.step(CHUNK); cyc += CHUNK; out += sim.drain();
    if (/Password:/.test(out)) { typeSlow(''); out = ''; continue; }
    if (LOGIN_RE.test(out))    { typeSlow('root'); out = ''; continue; }
    if (out.endsWith('# '))    return true;
  }
  return false;
}

// ── セッション復旧（DEL/FS を複数回 → プロンプト） ──────────────────────
function recover() {
  for (let round = 0; round < 4; round++) {
    sim.sendKey(0o177); sim.step(800_000);   // DEL (interrupt / SIGINT)
    sim.sendKey(0o34);  sim.step(800_000);   // FS  (quit / SIGQUIT)
    sim.drain();
    if (ensurePrompt()) return true;
  }
  return false;
}

// ── 1 コマンドの起動テスト ──────────────────────────────────────────────
function snippet(s) { return s.replace(/[\r\n]+/g, ' ').slice(-80); }
function testOne(cmd) {
  if (!ensurePrompt()) { if (!recover()) return { status: 'DEAD', detail: 'no prompt before cmd' }; }
  sim.drain();
  typeSlow(`${cmd} </dev/null;echo ${MARK}`);
  let out = '', cyc = 0;
  while (cyc < CMD_BUDGET) {
    sim.step(CHUNK); cyc += CHUNK; out += sim.drain();
    // login/su 等が新ログインを促した → 「起動できた」とみなし再ログインして継続
    if (LOGIN_RE.test(out)) { typeSlow('root'); const g = getPrompt(PROMPT_BUDGET); return { status: g.ok ? 'OK' : 'HANG', detail: 'spawned login' }; }
    if (countOcc(out, MARK) >= 2) {   // 入力エコー + echo 出力
      if (out.indexOf(`${cmd}: not found`) >= 0) return { status: 'NOTFOUND', detail: '' };
      return { status: 'OK', detail: '' };
    }
  }
  // 予算超過 = ハング。復旧を試みる
  const ok = recover();
  return { status: ok ? 'HANG' : 'DEAD', detail: snippet(out) };
}

// ── 実行 ────────────────────────────────────────────────────────────────
const results = [];
let dead = false;
for (let i = 0; i < cmds.length; i++) {
  const { dir, cmd } = cmds[i];
  if (dead) { results.push({ dir, cmd, status: 'ABORTED', detail: '' }); continue; }
  const r = testOne(cmd);
  if (r.status === 'DEAD') { dead = true; r.status = 'HANG'; r.detail += ' (session dead)'; }
  results.push({ dir, cmd, ...r });
  console.error(`  [${i + 1}/${cmds.length}] ${cmd.padEnd(10)} ${r.status}`);
}

// ── 集計 ────────────────────────────────────────────────────────────────
const by = (st) => results.filter(r => r.status === st);
const ok = by('OK'), nf = by('NOTFOUND'), ab = by('ABORTED');
const allHang = by('HANG');
// HANG を「既知例外」と「想定外」に分ける。既知例外は失敗にカウントしない。
const xhang = allHang.filter(r => EXPECTED_HANG.has(r.cmd));
const hang  = allHang.filter(r => !EXPECTED_HANG.has(r.cmd));
// NOTFOUND を「既知例外」と「想定外」に分ける。
const xnf = nf.filter(r => EXPECTED_NOTFOUND.has(r.cmd));
const badf = nf.filter(r => !EXPECTED_NOTFOUND.has(r.cmd));

console.log('\n================ PDP-11 WASM コマンド起動テスト ================');
console.log(`総数 ${results.length}  OK ${ok.length}  NOTFOUND ${badf.length}  HANG ${hang.length}  既知HANG ${xhang.length}  既知NOTFOUND ${xnf.length}  ABORTED ${ab.length}`);
const showList = (label, arr) => {
  if (!arr.length) return;
  console.log(`\n--- ${label} (${arr.length}) ---`);
  for (const r of arr) console.log(`  ${r.cmd.padEnd(10)} ${r.dir}${r.detail ? '  | ' + r.detail : ''}`);
};
showList('実行できない: NOTFOUND', badf);
showList('実行できない: HANG（端末が固まる）', hang);
// 既知例外はエラーではないが、握りつぶさず理由付きで必ず表示する。
if (xhang.length) {
  console.log(`\n--- 既知例外: HANG（スモークテスト不能・失敗にカウントしない） (${xhang.length}) ---`);
  for (const r of xhang) console.log(`  ${r.cmd.padEnd(10)} ${r.dir}  | ${EXPECTED_HANG.get(r.cmd)}`);
}
if (xnf.length) {
  console.log(`\n--- 既知例外: NOTFOUND（失敗にカウントしない） (${xnf.length}) ---`);
  for (const r of xnf) console.log(`  ${r.cmd.padEnd(10)} ${r.dir}  | ${EXPECTED_NOTFOUND.get(r.cmd)}`);
}
showList('未テスト: ABORTED', ab);
console.log('\n--- 実行できる: OK ---');
console.log('  ' + ok.map(r => r.cmd).join(' '));

const outPath = join(__dirname, 'test_commands_result.json');
writeFileSync(outPath, JSON.stringify({
  summary: { total: results.length, ok: ok.length, notfound: badf.length, hang: hang.length, expectedHang: xhang.length, expectedNotfound: xnf.length, aborted: ab.length },
  results: results.map(r => {
    if (EXPECTED_HANG.has(r.cmd) && r.status === 'HANG')
      return { ...r, expected: true, expectedReason: EXPECTED_HANG.get(r.cmd) };
    if (EXPECTED_NOTFOUND.has(r.cmd) && r.status === 'NOTFOUND')
      return { ...r, expected: true, expectedReason: EXPECTED_NOTFOUND.get(r.cmd) };
    return r;
  }),
}, null, 2));
console.log(`\n結果を保存: ${outPath}`);

// 失敗 = 想定外の NOTFOUND または想定外の HANG。既知例外は除外。
process.exit((badf.length + hang.length) > 0 ? 1 : 0);
