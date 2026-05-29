/**
 * sim.mjs — WASM シミュレーターローダーとテストヘルパー
 *
 * 使い方:
 *   const sim = await loadSim();
 *   const result = await sim.captureInstruction([0x3E, 0xFF]);  // MVI A,$FF
 *   // result.parsedSamples, result.timing が使える
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readRingBuffer, parseSample, analyzeTiming } from './ring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// sim-test.mjs は tests/ 直下に生成される
const SIM_MJS_PATH = join(__dirname, '..', 'sim-test.mjs');

/** WASM モジュールのシングルトンキャッシュ */
let _moduleFactory = null;

/**
 * WASM モジュールファクトリーを動的 import で読み込む。
 * 初回のみロード、以降はキャッシュを返す。
 */
async function getModuleFactory() {
  if (_moduleFactory) return _moduleFactory;
  // Emscripten MODULARIZE=1 + EXPORT_ES6=1 で生成されたデフォルトエクスポート
  const mod = await import(SIM_MJS_PATH);
  _moduleFactory = mod.default;
  return _moduleFactory;
}

/**
 * シミュレーターラッパーを生成する。
 * テスト毎に新しいインスタンスを作成して独立性を確保する。
 * @returns {Promise<SimWrapper>}
 */
export async function loadSim() {
  const factory = await getModuleFactory();
  const M = await factory();
  return new SimWrapper(M);
}

/**
 * シミュレーターラッパークラス。
 * Emscripten Module インスタンスをラップして使いやすい API を提供する。
 */
export class SimWrapper {
  constructor(M) {
    this.M = M;
    /** @type {number} HEAPU32 上のリングバッファ先頭インデックス */
    this.ringBase = M._get_ring_ptr() >>> 2;
    /** @type {number} リングバッファのサンプル数 */
    this.ringSize = M._get_ring_size();
    /** @type {number} 1 サンプルあたりの uint32 ワード数（cpm_const.h の RING_WORDS） */
    this.ringWords = M._get_ring_words();
  }

  /**
   * シミュレーターを CP/M モードで初期化する。
   * sim_init("/bios.bin", "/cpm22.bin", "/cpm22.dsk") を呼ぶ。
   */
  init() {
    this.M._sim_init_wasm();
  }

  /**
   * RAM の指定アドレスに 1 バイト書き込む。
   * @param {number} addr
   * @param {number} val
   */
  poke(addr, val) {
    this.M._sim_poke(addr, val);
  }

  /**
   * RAM の指定アドレスからバイト列を書き込む。
   * @param {number} startAddr
   * @param {number[]} bytes
   */
  pokeBytes(startAddr, bytes) {
    for (let i = 0; i < bytes.length; i++) {
      this.poke(startAddr + i, bytes[i]);
    }
  }

  /**
   * 1 クロックサイクル進める (rising edge 後にリングバッファにサンプルされる)。
   */
  step() {
    this.M._step();
  }

  /**
   * 複数クロックステップを実行する。
   * @param {number} n
   */
  stepN(n) {
    for (let i = 0; i < n; i++) this.step();
  }

  /**
   * 現在のリングバッファヘッドを返す。
   * @returns {number}
   */
  getHead() {
    return this.M._get_head() >>> 0;
  }

  /**
   * PC (アドレスバス) を返す。
   * @returns {number}
   */
  getPC() {
    return this.M._get_pc() >>> 0;
  }

  /**
   * リングバッファのフリーズ状態を返す。
   * @returns {boolean}
   */
  isRingFrozen() {
    return !!this.M._sim_ring_frozen();
  }

  /**
   * トリガーヒット (post_delay 完了) を返す。
   * @returns {boolean}
   */
  isTriggerHit() {
    return !!this.M._sim_trigger_hit();
  }

  /**
   * 命令トリガーを設定する。
   * @param {number} pc    - ターゲット PC (-1 = 任意)
   * @param {number} opc   - ターゲット オペコード (-1 = 任意)
   */
  setInstrTrigger(pc, opc) {
    this.M._sim_set_instr_trigger(pc ?? -1, opc ?? -1);
  }

  /**
   * ポストトリガーのクロック数を設定する。
   * @param {number} n
   */
  setPostDelay(n) {
    this.M._sim_set_post_delay(n | 0);
  }

  /**
   * トリガーをクリアする。
   */
  clearTrigger() {
    this.M._sim_clear_trigger();
  }

  /**
   * トリガー発火時の ring_head を返す (-1 = 未発火)。
   * @returns {number}
   */
  getTrigFireHead() {
    return this.M._sim_get_trig_fire_head() | 0;
  }

  /**
   * セットアップバイト列を 1 回だけ実行してから対象命令をキャプチャする。
   *
   * メモリ配置:
   *   0x0000         : JMP testAddr       (リセットベクター)
   *   testAddr       : setupBytes         (1 回だけ実行されるセットアップ)
   *   targetAddr     : instrBytes         (測定対象命令、ループ先)
   *   targetAddr+len : JMP targetAddr     (セットアップをスキップして対象命令へ)
   *
   * セットアップは最初の 1 回のみ実行されるため、例えば
   * "MVI A,$42 → MOV B,A" のような複数命令のレジスタ値テストに使用する。
   *
   * @param {number[]} setupBytes  - 対象命令の前に 1 回だけ実行するバイト列
   * @param {number[]} instrBytes  - キャプチャ対象の命令バイト列
   * @param {object}   [opts]      - captureInstruction と同じオプション
   * @returns {{parsedSamples: Array, instrSamples: Array, timing: object, steps: number}}
   */
  captureWithSetup(setupBytes, instrBytes, opts = {}) {
    const testAddr   = opts.testAddr  ?? 0x0100;
    const postDelay  = opts.postDelay ?? 80;
    const maxSteps   = opts.maxSteps  ?? 100000;
    const targetAddr = testAddr + setupBytes.length;

    // 1) CP/M 初期化
    this.init();

    // 2) リセットベクター → testAddr
    this.poke(0x0000, 0xC3);
    this.poke(0x0001, testAddr & 0xFF);
    this.poke(0x0002, (testAddr >> 8) & 0xFF);

    // 3) セットアップコードを testAddr に配置
    this.pokeBytes(testAddr, setupBytes);

    // 4) 対象命令を targetAddr に配置
    this.pokeBytes(targetAddr, instrBytes);
    const afterInstr = targetAddr + instrBytes.length;

    // 5) JMP targetAddr (対象命令のみをループ、セットアップはスキップ)
    this.poke(afterInstr + 0, 0xC3);
    this.poke(afterInstr + 1, targetAddr & 0xFF);
    this.poke(afterInstr + 2, (targetAddr >> 8) & 0xFF);

    // 6) targetAddr でトリガー設定
    this.clearTrigger();
    this.setInstrTrigger(targetAddr, -1);
    this.setPostDelay(postDelay);

    // 7) トリガーヒットまでステップ実行
    let steps = 0;
    while (!this.isTriggerHit() && steps < maxSteps) {
      this.step();
      steps++;
    }

    if (!this.isTriggerHit()) {
      throw new Error(
        `captureWithSetup タイムアウト: ${maxSteps} ステップ内にトリガーが発火しなかった` +
        ` (targetAddr=0x${targetAddr.toString(16).padStart(4, '0')})`
      );
    }

    // 8) リングバッファフリーズ & 読み取り
    this.M._sim_freeze_ring();
    const head = this.getHead();
    const snap = readRingBuffer(
      this.M.HEAPU32, this.ringBase, this.ringSize, head, postDelay + 1, this.ringWords
    );
    const parsedSamples = snap.map(parseSample);

    // 9) 先頭 SYNC (targetAddr) から afterAddr SYNC まで命令サンプルを抽出
    //    afterAddr = targetAddr + instrLen → JMP の M1 SYNC で終端
    const instrSamples = extractInstrSamples(parsedSamples, instrBytes.length);
    const timing = analyzeTiming(instrSamples);

    return { parsedSamples, instrSamples, timing, steps };
  }

  /**
   * 指定アドレスから指定バイト列の命令を実行し、リングバッファを解析する。
   *
   * テスト配置場所: 0x0100 (BIOSや割り込みベクターから離れた安全な領域)
   * JMP 0x0100 を 0x0000 に配置してCPUがそこへ飛ぶ。
   * 0x0100 に命令を配置し、直後に JMP 0x0100 (無限ループ) を置く。
   *
   * @param {number[]} instrBytes  - 命令バイト列
   * @param {object}   [opts]
   * @param {number}   [opts.testAddr=0x0100]  - 命令を配置する RAM アドレス
   * @param {number}   [opts.postDelay=80]     - トリガー後に記録するサンプル数
   * @param {number}   [opts.maxSteps=100000]  - タイムアウト上限
   * @returns {Promise<{parsedSamples: Array, timing: object, fireHead: number}>}
   */
  captureInstruction(instrBytes, opts = {}) {
    const testAddr  = opts.testAddr  ?? 0x0100;
    const postDelay = opts.postDelay ?? 80;   // 最大命令でも 18T = 36 samples, 余裕を持たせる
    const maxSteps  = opts.maxSteps  ?? 100000;

    // 1) シミュレーター初期化 (CP/M BIOS・RAM ロード + CPU リセット)
    this.init();

    // 2) 0x0000 に JMP testAddr を配置 (RESET ベクター)
    //    0xC3 nn mm = JMP mmnn
    this.poke(0x0000, 0xC3);
    this.poke(0x0001, testAddr & 0xFF);
    this.poke(0x0002, (testAddr >> 8) & 0xFF);

    // 3) testAddr に命令バイトを配置し、直後に JMP testAddr (無限ループ)
    this.pokeBytes(testAddr, instrBytes);
    const afterInstr = testAddr + instrBytes.length;
    this.poke(afterInstr + 0, 0xC3);
    this.poke(afterInstr + 1, testAddr & 0xFF);
    this.poke(afterInstr + 2, (testAddr >> 8) & 0xFF);

    // 4) トリガー設定: PC=testAddr で命令フェッチ開始時に発火
    this.clearTrigger();
    this.setInstrTrigger(testAddr, -1);
    this.setPostDelay(postDelay);

    // 5) トリガーヒットまでステップ実行
    let steps = 0;
    while (!this.isTriggerHit() && steps < maxSteps) {
      this.step();
      steps++;
    }

    if (!this.isTriggerHit()) {
      throw new Error(
        `captureInstruction タイムアウト: ${maxSteps} ステップ内にトリガーが発火しなかった` +
        ` (命令=0x${instrBytes[0].toString(16)}, testAddr=0x${testAddr.toString(16)})`
      );
    }

    // 6) リングバッファをフリーズさせる
    this.M._sim_freeze_ring();

    // 7) トリガー発火ヘッドから postDelay + 1 サンプルを読む
    //    トリガーは ring_head をインクリメント後に記録するため、
    //    トリガーサンプル (M1 T1 f1) は head - postDelay - 1 の位置にある。
    //    +1 することでそのサンプルを含む。
    const fireHead = this.getTrigFireHead();
    const head = this.getHead();

    // フリーズ後の実際のヘッドを使う
    const snap = readRingBuffer(
      this.M.HEAPU32,
      this.ringBase,
      this.ringSize,
      head,
      postDelay + 1,  // +1: トリガーサンプル(M1 SYNC f1)を含むため
      this.ringWords
    );
    const parsedSamples = snap.map(parseSample);

    // 8) SYNC パルスを起点に最初の命令分だけ抽出する
    //    最初の SYNC から次の JMP 命令の SYNC 直前まで
    const instrSamples = extractInstrSamples(parsedSamples, instrBytes.length);

    const timing = analyzeTiming(instrSamples);

    return { parsedSamples, instrSamples, timing, fireHead, steps };
  }
}

/**
 * parsedSamples から最初の命令 1 個分のサンプルを抽出する。
 *
 * SYNC 立ち上がりエッジ (0→1 遷移) で命令境界を検出する。
 * vm80a では SYNC が T1 f1・f2 の両フェーズで High になるため、
 * 「任意の SYNC=1」ではなく「SYNC の立ち上がり」を使う。
 *
 * 命令終了条件: 次の命令の SYNC 立ち上がりが startAddr で検出されたとき
 * (無限ループ JMP testAddr が戻ってきたとき)。
 *
 * @param {Array} parsedSamples
 * @param {number} instrLen - 命令バイト長 (未使用だが将来の精密化のために残す)
 * @returns {Array}
 */
function extractInstrSamples(parsedSamples, instrLen) {
  // 最初の SYNC 立ち上がりを探す (sample[0] が SYNC f1 なら index=0)
  const firstSync = parsedSamples.findIndex(
    (s, i) => s.sync && (i === 0 || !parsedSamples[i - 1].sync)
  );
  if (firstSync < 0) return parsedSamples;

  const startAddr = parsedSamples[firstSync].addr;
  // captureInstruction は命令の直後 (startAddr + instrLen) に JMP startAddr を配置する。
  // その JMP の M1 SYNC が "命令終了" の目印になる。
  // 例外: JMP 自身など afterAddr に到達しない命令は startAddr ループバックで終端。
  const afterAddr = (startAddr + instrLen) & 0xFFFF;

  let end = parsedSamples.length;
  let prevSync = parsedSamples[firstSync].sync; // = true

  for (let i = firstSync + 1; i < parsedSamples.length; i++) {
    const isRising = parsedSamples[i].sync && !prevSync;
    if (isRising) {
      const addr = parsedSamples[i].addr;
      // afterAddr への SYNC = JMP 開始 (命令終了)
      // startAddr への SYNC = ループバック (自己ジャンプ命令の場合)
      if (addr === afterAddr || addr === startAddr) {
        end = i;
        break;
      }
    }
    prevSync = parsedSamples[i].sync;
  }

  return parsedSamples.slice(firstSync, end);
}
