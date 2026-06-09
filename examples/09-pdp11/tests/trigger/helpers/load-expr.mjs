// load-expr.mjs — Node.js vm でブラウザ用 JS を評価し、テスト関数を export する
// sft-pdp11-la-defs.js → trigger-expr.js の順に vm コンテキストへ読み込む。

import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsDir  = join(__dirname, '../../../../../js');

const ctx = createContext({});

runInContext(
  readFileSync(join(jsDir, 'sft-pdp11-la-defs.js'), 'utf8'),
  ctx, { filename: 'sft-pdp11-la-defs.js' }
);
runInContext(
  readFileSync(join(jsDir, 'trigger-expr.js'), 'utf8'),
  ctx, { filename: 'trigger-expr.js' }
);
runInContext(
  readFileSync(join(jsDir, 'trigger-expr-compiler.js'), 'utf8'),
  ctx, { filename: 'trigger-expr-compiler.js' }
);

export const LA_SIGNALS_PDP11  = ctx.LA_SIGNALS_PDP11;
export const RING_WORDS_PDP11  = ctx.RING_WORDS_PDP11;
export const _trigParse        = ctx._trigParse;
export const _trigEvalExpr     = ctx._trigEvalExpr;
export const _trigFindSig      = ctx._trigFindSig;
export const _trigSigVal       = ctx._trigSigVal;
export const trigCompileToWasm = ctx.trigCompileToWasm;
