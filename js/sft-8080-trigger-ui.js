// sft-8080-trigger-ui.js — トリガー設定 UI・Freeze/Step・Logic Analyzer 制御
//
// 06-8080 Web UI から分離。initTriggerUI() は initUI() 内（la 生成後・DOM 準備後）で呼ぶ。
// グローバル参照のみ（term/_jp106/_wasmEd 非依存）:
//   workerSend（worker-bridge）, window.la（bareword la）, running（index の let）,
//   ioLog / renderIOLog（debug-panel）, document / localStorage。

function initTriggerUI() {
    // ---- Trigger 折りたたみトグル ----
    (function() {
      var toggleBtn = document.getElementById('btn-trig-toggle');
      var detail    = document.getElementById('dbg-trig-detail');
      var PREF_KEY  = 'la_trig_open';
      var isOpen    = localStorage.getItem(PREF_KEY) === '1';  // デフォルト: 閉じた状態
      function applyTrigPanel() {
        detail.style.display = isOpen ? 'flex' : 'none';
        toggleBtn.textContent = '⚙ Trigger ' + (isOpen ? '▾' : '▸');
      }
      applyTrigPanel();
      toggleBtn.addEventListener('click', function() {
        isOpen = !isOpen;
        localStorage.setItem(PREF_KEY, isOpen ? '1' : '0');
        applyTrigPanel();
      });
    })();

    // ---- Freeze / Thaw ----
    document.getElementById('btn-freeze').addEventListener('click', function() {
      // '❄ Freeze' 表示中 = 未凍結 → 凍結する
      // '▶ Thaw'   表示中 = 凍結中 → 解除する
      var isFreezable = this.textContent.indexOf('❄') >= 0;
      if (isFreezable) {
        workerSend({ type: 'freezeRing' });
        this.textContent = '▶ Thaw';
      } else {
        // フリーズ解除
        workerSend({ type: 'thawRing' });
        this.textContent = '❄ Freeze';
      }
    });

    // ---- Run to I/O ----
    document.getElementById('btn-run-to-io').addEventListener('click', function() {
      workerSend({ type: 'setTrigger', trigType: 1, port: 0xFF, addr: 0 });
      if (!running) {
        running = true;
        document.getElementById('btn-run').textContent = 'Pause';
        workerSend({ type: 'setRunning', running: true });
      }
    });

    // ---- Step ----
    (function() {
      var stepBtn = document.getElementById('dbg-step');
      if (!stepBtn) return;
      // ステップボタンの有効/無効を running 状態に合わせて更新
      function updateStepBtn() {
        stepBtn.disabled = running;
        stepBtn.style.opacity = running ? '0.4' : '';
        stepBtn.style.cursor  = running ? 'default' : '';
      }
      updateStepBtn();
      // btn-run と btn-reset のクリック後にも状態を更新
      document.getElementById('btn-run').addEventListener('click', updateStepBtn);
      document.getElementById('btn-reset').addEventListener('click', function() {
        // reset 後は running=true になるのでボタンを更新
        setTimeout(updateStepBtn, 0);
      });
      stepBtn.addEventListener('click', function() {
        if (running) return;
        workerSend({ type: 'setRunning', running: false });
        workerSend({ type: 'stepInstr' });
      });
    })();

    // ---- トリガー種別変更: 各種別ごとに専用フィールドを表示 ----
    document.getElementById('trig-type').addEventListener('change', function() {
      var isVal   = parseInt(this.value, 10) === 6;
      var isInstr = this.value === 'instr';
      var isReg   = this.value === 'reg';
      document.getElementById('trig-val-sig').style.display    = isVal          ? '' : 'none';
      document.getElementById('trig-instr-pc').style.display   = isInstr        ? '' : 'none';
      document.getElementById('trig-instr-opc').style.display  = isInstr        ? '' : 'none';
      document.getElementById('trig-reg-name').style.display   = isReg          ? '' : 'none';
      document.getElementById('trig-reg-val').style.display    = isReg          ? '' : 'none';
      document.getElementById('trig-addr').style.display       = (isInstr || isReg) ? 'none' : '';
    });

    // ---- トリガー設定 ----
    document.getElementById('btn-trig-set').addEventListener('click', function() {
      var typeStr  = document.getElementById('trig-type').value;
      var type     = parseInt(typeStr, 10) || 0;
      var addrStr  = document.getElementById('trig-addr').value.trim().replace(/^0x/i, '');
      var addrVal  = addrStr ? (parseInt(addrStr, 16) || 0) : 0;
      var postStr  = document.getElementById('trig-post').value.trim();
      var postVal  = postStr ? (parseInt(postStr, 10) || 0) : 0;
      workerSend({ type: 'setPostDelay', n: postVal });
      if (typeStr === 'instr') {
        var pcStr  = document.getElementById('trig-instr-pc').value.trim().replace(/^0x/i, '');
        var opcStr = document.getElementById('trig-instr-opc').value.trim().replace(/^0x/i, '');
        var pcVal  = pcStr  ? parseInt(pcStr,  16) : -1;
        var opcVal = opcStr ? parseInt(opcStr, 16) : -1;
        workerSend({ type: 'setInstrTrigger', pc: pcVal, opc: opcVal });
        if (!running) {
          running = true;
          document.getElementById('btn-run').textContent = 'Pause';
          workerSend({ type: 'setRunning', running: true });
        }
        return;
      }
      if (typeStr === 'reg') {
        var regId  = parseInt(document.getElementById('trig-reg-name').value, 10) | 0;
        var rvStr  = document.getElementById('trig-reg-val').value.trim().replace(/^0x/i, '');
        var regVal = rvStr ? (parseInt(rvStr, 16) || 0) : 0;
        workerSend({ type: 'setRegTrigger', regId: regId, value: regVal });
        if (!running) {
          running = true;
          document.getElementById('btn-run').textContent = 'Pause';
          workerSend({ type: 'setRunning', running: true });
        }
        return;
      }
      if (type === 4 || type === 5) {
        // エッジトリガー: addrVal = シグナル ID（LA_SIGNALS_ALL のインデックス番号 or bit番号）
        // 簡易実装: addrVal を Word 0 のビット番号として使用（デフォルトは io_req=bit24）
        var edgeBit  = addrVal || 24;   // デフォルト: io_req (bit 24 of Word 0)
        var edgeWord = 0;
        var edgeDir  = (type === 5) ? 1 : 0;  // type=5 = 立ち下がり
        workerSend({ type: 'setEdgeTrigger', word: edgeWord, bit: edgeBit, dir: edgeDir });
      } else if (type === 6) {
        // 値トリガー: 信号名 → Ring Buffer の Word/mask/cmp に変換
        var sig = document.getElementById('trig-val-sig').value;
        var word, mask, cmp;
        if (sig === 'addr') {
          word = 1; mask = 0x0000FFFF;  cmp = addrVal & 0xFFFF;
        } else if (sig === 'dbus') {
          word = 3; mask = 0xFF000000 | 0; cmp = ((addrVal & 0xFF) << 24) | 0;
        } else if (sig === 'port') {
          word = 0; mask = 0x000000FF;  cmp = addrVal & 0xFF;
        } else { // iodata
          word = 0; mask = 0x00FF0000;  cmp = (addrVal & 0xFF) << 16;
        }
        workerSend({ type: 'setValueTrigger', word: word, mask: mask >>> 0, cmp: cmp >>> 0 });
      } else {
        workerSend({ type: 'setTrigger', trigType: type, port: addrVal || 0xFF, addr: addrVal });
      }
      if (type > 0 && !running) {
        running = true;
        document.getElementById('btn-run').textContent = 'Pause';
        workerSend({ type: 'setRunning', running: true });
      }
    });

    document.getElementById('btn-trig-clear').addEventListener('click', function() {
      workerSend({ type: 'clearTrigger' });
      document.getElementById('btn-freeze').textContent = '❄ Freeze';
      la.setTrigFireHead(-1);
    });

    // ---- ⊙Trig: トリガー発火位置をタイミング図中央へ ----
    document.getElementById('btn-goto-trig').addEventListener('click', function() {
      la.gotoTrig();
    });

    // ---- Call Log クリア ----
    document.getElementById('btn-clear-calllog').addEventListener('click', function() {
      workerSend({ type: 'clearCallLog' });
      ioLog = [];
      renderIOLog();
    });

    // ---- Logic Analyzer ON/OFF ----
    document.getElementById('btn-la-toggle').addEventListener('click', function() {
      la.setEnabled(!la.enabled);
      this.textContent = la.enabled ? 'LA ON' : 'LA OFF';
      this.style.color  = la.enabled ? '' : '#cc3333';
      workerSend({ type: 'setLA', enabled: la.enabled });
      if (!la.enabled) la._drawOff();
    });

    // ---- Fill トグル ----
    document.getElementById('la-fill-chk').addEventListener('change', function() {
      la.setFillEnabled(this.checked);
      la._updateCanvas();
    });

    // ---- 網目トグル ----
    document.getElementById('la-hatch-chk').addEventListener('change', function() {
      la.setHatchEnabled(this.checked);
      la._updateCanvas();
    });
}
