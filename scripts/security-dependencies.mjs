// 修補版仍沿用上游版本，audit 警示保留；用實際攻擊輸入驗證保護。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const loadModule = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
let base = path.join(root, 'node_modules/braces');
if (!fs.existsSync(base)) {
  const store = path.join(root, 'node_modules/.pnpm');
  const entry = fs.readdirSync(store).find(x => x.startsWith('braces@file+'));
  assert.ok(entry, 'Local patched braces package is required');
  base = path.join(store, entry, 'node_modules/braces');
}
const braces = loadModule(base);
const safeError = error => error instanceof SyntaxError && /security limit/.test(error.message);
assert.deepEqual(braces.expand('src/{a,b}/{1..3}.ts'), ['src/a/1.ts','src/a/2.ts','src/a/3.ts','src/b/1.ts','src/b/2.ts','src/b/3.ts']);
assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
assert.equal(braces.stringify('\\{a,b\\}'), '{a,b}');
const nested = '{'.repeat(3000) + 'x' + '}'.repeat(3000);
const parentheses = '('.repeat(3000) + 'x' + ')'.repeat(3000);
for (const input of [nested, parentheses, '{'.repeat(3000)]) {
  for (const name of ['parse', 'compile', 'expand', 'stringify']) assert.throws(() => braces[name](input), safeError);
  assert.throws(() => braces(input, {maxDepth:Infinity, depth:Infinity}), safeError);
}
for (const name of ['compile', 'expand', 'stringify']) {
  const deep = {type:'root', nodes:[]}; let child = deep;
  for (let n=0;n<3000;n++) { const next={type:'brace', nodes:[]};child.nodes.push(next);child=next; }
  assert.throws(() => braces[name](deep), safeError);
  assert.throws(() => loadModule(path.join(base,'lib',name))(deep), safeError);
  const cycle={type:'root',nodes:[]};cycle.nodes.push(cycle);
  assert.throws(() => braces[name](cycle), safeError);
}
console.log('PASS: valid glob/range/AST round trips; nested braces/parentheses, incomplete input, direct AST/internal API and cycles rejected before recursion');

// 各 walker 對 Set／array-like 的解讀不同；非正式 AST 必須一致拒絕。
for (const nodes of [new Set(), {length:1,0:{type:'text',value:'a'}}]) {
  for (const api of ['compile','expand','stringify']) assert.throws(() => braces[api]({type:'root',nodes}), safeError);
}
