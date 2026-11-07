const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name.startsWith('@/')) return originalLoad.call(this, path.join(__dirname, '..', name.slice(2)) + '.ts', parent, isMain);
  return originalLoad.call(this, name, parent, isMain);
};
const { prepareCartLines, saveCartLines } = require('../lib/sales/cart-drafts.ts');
const { safeReturnPath } = require('../hooks/use-workspace-navigation.ts');
Module._load = originalLoad;

const initial = () => ({ id: 'sale', version: 7, lines: [
  { product_id: 'a', quantity: '1', unit_price: '180', discount: '0' },
  { product_id: 'b', quantity: '1', unit_price: '120', discount: '0' },
] });
const drafts = { a: { quantity: '2', unit_price: '180', discount: '0' }, b: { quantity: '1,5', unit_price: '120', discount: '10' } };

(async () => {
  assert.deepEqual(prepareCartLines(initial(), drafts).map(line => line.line_total), ['360.00', '162.00']);
  assert.equal(initial().lines[0].quantity, '1');
  const updates = [], saved = [];
  const result = await saveCartLines(initial(), drafts, async (sale, index, quantity, unit_price, discount) => {
    updates.push([sale.version, index]);
    return { ...sale, version: sale.version + 1, lines: sale.lines.map((line, i) => i === index ? { ...line, quantity, unit_price, discount } : line) };
  }, (sale, id) => saved.push([sale.version, id]));
  assert.deepEqual(updates, [[7, 0], [8, 1]]);
  assert.deepEqual(saved, [[8, 'a'], [9, 'b']]);
  assert.equal(result.version, 9);
  for (const invalid of [{ quantity: '0' }, { quantity: '' }, { discount: '101' }, { unit_price: '-1' }]) {
    let called = false;
    await assert.rejects(() => saveCartLines(initial(), { ...drafts, b: { ...drafts.b, ...invalid } }, async () => { called = true; }, () => {}));
    assert.equal(called, false, 'All rows must be validated before the first write');
  }
  assert.throws(() => prepareCartLines(initial(), { missing: drafts.a }), /carrello è cambiato/);
  const partial = [];
  await assert.rejects(() => saveCartLines(initial(), drafts, async (sale, index) => {
    if (index === 1) throw new Error('Conflict');
    return { ...sale, version: 8 };
  }, (_sale, id) => partial.push(id)), /Conflict/);
  assert.deepEqual(partial, ['a'], 'Only successfully saved drafts may be cleared');
  for (const bad of ['https://example.com', '//example.com', '/codici-evil', '/codici\\evil', '/codici\nX']) assert.equal(safeReturnPath(bad), '/codici/magazzino');
  assert.equal(safeReturnPath('/codici?query=MOTOR'), '/codici?query=MOTOR');
  assert.equal(safeReturnPath('/codici/ddt/123'), '/codici/ddt/123');
  console.log('OK: totals, decimal input, sequential versions, validation before writes, partial failures and local return paths.');
})().catch(error => { console.error(error); process.exitCode = 1; });
