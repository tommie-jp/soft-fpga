// load-v6fs.mjs — Node.js vm でブラウザ用 sft-v6fs.js を評価し、テスト関数を export する

import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsDir = join(__dirname, '../../../../../js');

const ctx = createContext({});
runInContext(
  readFileSync(join(jsDir, 'sft-v6fs.js'), 'utf8'),
  ctx, { filename: 'sft-v6fs.js' }
);

export const V6_BLOCK_SIZE         = ctx.V6_BLOCK_SIZE;
export const V6_INODE_START        = ctx.V6_INODE_START;
export const V6_ROOT_INODE         = ctx.V6_ROOT_INODE;
export const V6_TMP_INO            = ctx.V6_TMP_INO;
export const V6_TMP_DIR_BLK        = ctx.V6_TMP_DIR_BLK;
export const v6ReadBlock           = ctx.v6ReadBlock;
export const v6ReadInode           = ctx.v6ReadInode;
export const v6ListDir             = ctx.v6ListDir;
export const v6FindPath            = ctx.v6FindPath;
export const v6ReadFile            = ctx.v6ReadFile;
export const v6DskWrU16            = ctx.v6DskWrU16;
export const v6DskWriteInode       = ctx.v6DskWriteInode;
export const v6DskAllocChainBlocks = ctx.v6DskAllocChainBlocks;
export const v6DskFindTmpEntry     = ctx.v6DskFindTmpEntry;
export const v6DskAddTmpEntry      = ctx.v6DskAddTmpEntry;
export const v6DskFindFreeInode    = ctx.v6DskFindFreeInode;
export const v6ValidateName        = ctx.v6ValidateName;
export const v6DskWriteFile        = ctx.v6DskWriteFile;
export const v6DirFindEntry        = ctx.v6DirFindEntry;
export const v6DirRemoveEntry      = ctx.v6DirRemoveEntry;
export const v6DirAddEntry         = ctx.v6DirAddEntry;
export const v6RecurseDir          = ctx.v6RecurseDir;
