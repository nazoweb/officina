const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { matchesProductQuery } = require('../lib/inventory/search.ts');
const { normalizeScannerInput } = require('../lib/inventory/scanner.ts');
const product = {
  internal_code: '05-0001', name: 'Devio guida', brand: 'Marca prova', category: 'Ricambi elettrici',
  product_identifiers: [
    { kind: 'supplier_code', value: 'FOR-987' }, { kind: 'barcode', value: '0123456789' },
    { kind: 'mav', value: 'MAV5160A' }, { kind: 'cross_reference', value: 'F032US0057' },
  ],
};
for (const query of ['05-0001', '05-00', '  05-0001  ', 'devio', 'MARCA', 'elettrici', 'for-98', '012345', 'mav516', 'f032us', '']) {
  assert(matchesProductQuery(product, query), query);
}
for (const query of ['NOTFOUND', '%', '_', '05-0002']) assert(!matchesProductQuery(product, query), query);
assert(matchesProductQuery({ ...product, product_identifiers: [] }, '05-0001'), 'Internal codes work without a separate identifier');
// Every incoming edit is corrected, including partial scans and pasted text.
for (const [input, expected] of [
  ["03'", '03-'], ["03'0", '03-0'], ["03'0029", '03-0029'],
  ['03’0029', '03-0029'], ['03‘0029', '03-0029'],
  ["FOR'987", 'FOR-987'], ["03'00'29", '03-00-29'],
  [" 03'0029 ", ' 03-0029 '], ['030029', '030029'], ['03-0029', '03-0029'],
]) {
  assert.equal(normalizeScannerInput(input), expected);
}
let field = '';
for (const character of "03'0029") {
  field = normalizeScannerInput(field + character);
  assert(!field.includes("'"), 'The field never retains the apostrophe during a scan');
}
assert.equal(field, '03-0029');
assert(matchesProductQuery({ ...product, internal_code: '03-0029' }, field));
assert(!matchesProductQuery({ ...product, internal_code: '03-0030' }, field));
console.log('OK: full and partial keyboard search, internal codes without identifiers, name, brand, category and all code types.');
