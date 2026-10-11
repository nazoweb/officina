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

// Import edge cases are rejected before any request reaches the database.
const { validateImportRows } = require('../lib/inventory/import.ts');
const prepared = draft => ({ draft, error: '' });
assert.match(validateImportRows([prepared(draft), prepared({ ...draft, internal_code: ' 09-0001 ' })], mapping), /righe 2 e 3/);
assert.match(validateImportRows([prepared(null)], mapping), /Non ci sono prodotti/);
assert.match(validateImportRows([prepared(draft)], { internal_code: 'CODICE', name: 'CODICE' }), /stessa colonna/);
assert.throws(() => importedDraft({ ...rows[0], QUANTITÀ: '999999999999999999' }, mapping, headers));
assert.throws(() => importedDraft({ ...rows[0], MINIMO: '-1' }, { ...mapping, minimum_stock: 'MINIMO' }, [...headers, 'MINIMO']));
assert.throws(() => parseImportNumber('9'.repeat(400)));
const { userErrorMessage, UserFacingError } = require('../lib/user-errors.ts');
for (const raw of [new Error('ambiguous id'), { code: '42702', message: 'column reference "id" is ambiguous' }, new Error('Unexpected SQL relation xyz'), { code: '23505', message: 'duplicate key value violates unique constraint' }]) {
  assert(!/ambiguous|SQL|constraint|xyz/.test(userErrorMessage(raw)));
}
assert.match(userErrorMessage({ code: 'invalid_credentials' }), /Email o password/);
assert.match(userErrorMessage(new TypeError('Failed to fetch')), /connessione/);
assert.match(userErrorMessage(new UserFacingError('Controlla il codice.', 'ABC12345')), /ABC12345/);
// Exercise the transactional persistence boundary with a fake database client.
const calls = [];
const client = { rpc: async (name, values) => { calls.push({ name, values }); return { data: { created: false, productId: 'product-1' }, error: null }; } };
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === '@/lib/supabase/client') return { createSupabaseBrowserClient: () => client };
  if (name === '@/lib/codici/normalizeCode') return require('../lib/codici/normalizeCode.ts');
  if (name === '@/lib/user-errors') return require('../lib/user-errors.ts');
  if (name === '@/lib/inventory/activity') return { tracked: (_action, fn) => fn };
  return originalLoad.call(this, name, parent, isMain);
};
const { upsertImportedProduct } = require('../lib/inventory/api.ts');
Module._load = originalLoad;
(async () => {
  const result = await upsertImportedProduct(draft);
  assert.equal(result.created, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'import_catalogue_product');
  assert.deepEqual(calls[0].values.p_draft, draft);
  console.log('OK: Excel, barcode, importazione atomica, duplicati, numeri non validi e messaggi comprensibili.');
})().catch(error => { console.error(error); process.exitCode = 1; });
