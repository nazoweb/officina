const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { matchesProductQuery } = require('../lib/inventory/search.ts');
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
console.log('OK: full and partial keyboard search, internal codes without identifiers, name, brand, category and all code types.');
