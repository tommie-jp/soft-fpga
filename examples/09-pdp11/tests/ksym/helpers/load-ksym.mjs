// load-ksym.mjs — Node.js vm でブラウザ用 sft-pdp11-ksym.js を評価し、テスト関数を export する

import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsDir = join(__dirname, '../../../../../js');

const ctx = createContext({});
runInContext(
  readFileSync(join(jsDir, 'sft-pdp11-ksym.js'), 'utf8'),
  ctx, { filename: 'sft-pdp11-ksym.js' }
);

export const v6ParseNamelist = ctx.v6ParseNamelist;
export const v6TextSymbols   = ctx.v6TextSymbols;
export const v6NearestSym    = ctx.v6NearestSym;
export const v6FmtSym        = ctx.v6FmtSym;
export const pdp11WalkFrames = ctx.pdp11WalkFrames;
export const pdp11StackView  = ctx.pdp11StackView;
