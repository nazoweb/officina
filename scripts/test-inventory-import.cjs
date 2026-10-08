const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const XLSX = require('xlsx');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);

const { guessImportMapping, importedDraft, parseImportNumber } = require('../lib/inventory/import.ts');
const headers = ['CODICE FORNITORE', 'NOSTRO CODICE', 'CROSS REFERENCE', 'PREZZO VENDITA', 'SCONTO AZIENDE', 'SCONTO OFFICINE', 'CODICE A BARRE', 'QUANTITÀ'];
const mapping = guessImportMapping(headers);
assert.equal(mapping.internal_code, 'NOSTRO CODICE');
assert.equal(mapping.supplier_code, 'CODICE FORNITORE');
assert.equal(mapping.supplier, '');
const sheet = XLSX.utils.aoa_to_sheet([headers, ['PS171040', '09-0001', '594651;594774', 0, 40, '', '0012345678905', 12]]);
sheet.D2.z = '#,##0.00 "€"'; sheet.E2.z = '#,##0.00 "€"';
const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Prodotti');
const reread = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
const rows = XLSX.utils.sheet_to_json(reread.Sheets.Prodotti, { defval: '', raw: false });
const draft = importedDraft(rows[0], mapping, headers);
assert.equal(draft.internal_code, '09-0001');
assert.equal(draft.supplierCode, 'PS171040');
assert.equal(draft.barcode, '09-0001');
assert.equal(importedDraft({ 'NOSTRO CODICE': ' 05-0001 ' }, mapping, headers).barcode, '05-0001');
// Excel error cells are read as empty: the barcode still comes from our code.
const errorSheet = XLSX.utils.aoa_to_sheet([headers, ['251687', '05-0001']]);
errorSheet.G2 = { t: 'e', v: 15 };
const errorRows = XLSX.utils.sheet_to_json(errorSheet, { defval: '', raw: false });
assert.equal(errorRows[0]['CODICE A BARRE'], '');
assert.equal(importedDraft(errorRows[0], mapping, headers).barcode, '05-0001');
assert.deepEqual(draft.crossReferences, ['594651', '594774']);
assert.deepEqual(draft.prices, [{ name: 'Prezzo vendita', amount: 0 }, { name: 'Sconto aziende', amount: 40 }]);
assert.equal(draft.name, undefined);
assert.equal(draft.stockQuantity, 12);
assert.equal(parseImportNumber('1.234,56 €'), 1234.56);
assert.equal(parseImportNumber('40,00 €'), 40);
assert.equal(parseImportNumber(''), undefined);
assert.throws(() => parseImportNumber('20%'));
assert.throws(() => importedDraft({ ...rows[0], QUANTITÀ: '1,5' }, mapping, headers));
assert.throws(() => importedDraft({ ...rows[0], 'SCONTO AZIENDE': '-1' }, mapping, headers));
assert.equal(importedDraft({ ...rows[0], 'NOSTRO CODICE': '' }, mapping, headers), null);

// Exercise the persistence queries without touching the live database.
let existing = true;
const queries = [];
const client = { from(table) {
  const chain = {
    select() { return chain; }, eq() { return chain; },
    maybeSingle: async () => ({ data: existing ? { id: 'product-1' } : null, error: null }),
    update(values) { queries.push({ table, action: 'update', values }); return chain; },
    insert(values) { queries.push({ table, action: 'insert', values }); return chain; },
    upsert(values) { queries.push({ table, action: 'upsert', values }); return chain; },
    single: async () => ({ data: { id: 'product-1' }, error: null }),
    then(resolve) { return Promise.resolve({ data: null, error: null }).then(resolve); },
  };
  return chain;
} };
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === '@/lib/supabase/client') return { createSupabaseBrowserClient: () => client };
  if (name === '@/lib/codici/normalizeCode') return require('../lib/codici/normalizeCode.ts');
  return originalLoad.call(this, name, parent, isMain);
};
const { upsertImportedProduct } = require('../lib/inventory/api.ts');
Module._load = originalLoad;
(async () => {
  await upsertImportedProduct(draft);
  const update = queries.find(q => q.table === 'products' && q.action === 'update');
  assert.deepEqual(update.values, { internal_code: '09-0001' });
  const identifiers = queries.find(q => q.table === 'product_identifiers').values;
  assert(identifiers.some(i => i.kind === 'supplier_code' && i.normalized_value === 'PS171040'));
  assert(identifiers.some(i => i.kind === 'cross_reference' && i.normalized_value === '594774'));
  assert(identifiers.some(i => i.kind === 'barcode' && i.value === '09-0001'));
  queries.length = 0; existing = false;
  await upsertImportedProduct(draft);
  assert.equal(queries.find(q => q.table === 'products' && q.action === 'insert').values.stock_quantity, 12);
  assert.equal(queries.find(q => q.table === 'inventory_movements').values.delta, 12);
  console.log('OK: Excel cliente, codici, prezzi EUR, celle vuote e query di creazione/aggiornamento.');
})().catch(error => { console.error(error); process.exitCode = 1; });
