// Browser integration test. Every Supabase request is mocked; no live records are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const XLSX = require('xlsx');
let fault = null;
const activity = [];
const companyId='44444444-4444-4444-8444-444444444444';
const party={name:'Azienda prova S.r.l.',vat_number:'IT00000000000',tax_code:'',address:'Via prova 1',postcode:'00100',city:'Comune prova',province:'XX',country:'Italia',email:'prova@example.invalid',phone:'000000000'};
let clients=[{...party,id:companyId,delivery_address:'',active:true,updated_at:'2026-10-11T10:00:00Z'}];
let settings={...party,id:true,name:'Officina prova',fiscal_verified:true,updated_at:'2026-10-11T10:00:00Z'};
let deliveryDocument=null;
const workbook = rows => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Prodotti'); return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }); };
const { chromium } = require(process.env.OFFICINA_PLAYWRIGHT || 'playwright');

const productId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const makeProduct = () => ({ id: productId, internal_code: '05-0001', name: 'Devio guida', description: '', brand: '', category: 'Devio guida', location: '', unit: 'pz', stock_quantity: 10, minimum_stock: 2, supplier: '', notes: '', active: true, updated_at: '2026-10-11T10:00:00Z', product_identifiers: [{ id: 'identifier', kind: 'barcode', value: '05-0001', normalized_value: '05-0001' }], product_prices: [{ id: 'price', amount: 180, price_list: { id: 'list', name: 'Prezzo vendita', sort_order: 0 } }] });
let products = [makeProduct()];
let categories = ['Devio guida'];
let order = { id: orderId, name: 'Ordine prova', order_number: 1, notes: '', status: 'closed', updated_at: '2026-10-11T10:00:00Z', order_items: [{ id: 'item-1', product_id: productId, quantity: 2, product_name_snapshot: 'Devio guida', internal_code_snapshot: '05-0001', product: makeProduct() }] };
const calls = [];
const errors = [];

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => errors.push(error.message));
    // Do not send the fake session cookie to server middleware.
    await page.route('http://127.0.0.1:3100/**', async route => {
      const headers = { ...route.request().headers() }; delete headers.cookie;
      await route.continue({ headers });
    });
    await page.route('https://**.supabase.co/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const body = request.postDataJSON();
      if (fault && url.pathname.endsWith(fault.path)) { const current = fault; fault = null; return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: current.code, message: current.message }) }); }
      calls.push({ path: url.pathname, method: request.method(), body });
      let response = [];
      if (url.pathname.includes('/auth/v1/')) response = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {} };
      else if (url.pathname.endsWith('/record_activity_event')) { activity.unshift({ id: body.p_id, created_at: new Date().toISOString(), actor_id: userId, session_id: body.p_session_id, action: body.p_action, status: body.p_status, route: body.p_route, metadata: body.p_metadata, user_message: body.p_user_message }); response = null; }
      else if (url.pathname.endsWith('/activity_events')) response = activity;
      else if (url.pathname.endsWith('/business_clients')) {
        if(request.method()==='POST'){clients.push({...body,id:'55555555-5555-4555-8555-555555555555',updated_at:new Date().toISOString()});response={id:clients.at(-1).id};}
        else if(request.method()==='PATCH'){clients=clients.map(c=>c.id===url.searchParams.get('id')?.slice(3)?{...c,...body}:c);response={id:companyId};}
        else if(request.method()==='DELETE'){response={id:clients.at(-1).id};clients.pop();}else response=clients;
      } else if (url.pathname.endsWith('/delivery_settings')) { if(request.method()==='PATCH'){settings={...settings,...body};response={id:true};}else response=settings; }
      else if (url.pathname.endsWith('/delivery_documents_view')) response=request.headers().accept?.includes('vnd.pgrst.object')?deliveryDocument:deliveryDocument?[deliveryDocument]:[];
      else if (url.pathname.endsWith('/save_delivery_document')) {
        const draft=body.p_draft;const lines=draft.lines.map(line=>({...line,line_total:(Number(line.quantity)*Number(line.unit_price)*(1-Number(line.discount)/100)).toFixed(2)}));
        deliveryDocument={...draft,id:body.p_id,kind:lines.some(line=>line.kind==='goods')?'ddt':'work',status:'draft',number:null,year:null,client_snapshot:clients[0],emitter_snapshot:settings,lines,total:lines.reduce((sum,line)=>sum+Number(line.line_total),0).toFixed(2),version:(deliveryDocument?.id===body.p_id?deliveryDocument.version:0)+1,created_at:'2026-10-11T10:00:00Z',updated_at:'2026-10-11T10:00:00Z',cancellation_reason:null};response=body.p_id;
      } else if(url.pathname.endsWith('/issue_delivery_document')) {deliveryDocument={...deliveryDocument,status:'issued',number:1,year:2026,version:deliveryDocument.version+1};response=deliveryDocument.id;}
      else if(url.pathname.endsWith('/cancel_delivery_document')) {deliveryDocument={...deliveryDocument,status:'void',cancellation_reason:body.p_reason,version:deliveryDocument.version+1};response=null;}
      else if(url.pathname.endsWith('/delete_delivery_draft')) {deliveryDocument=null;response=null;}
      else if (url.pathname.endsWith('/product_identifiers')) response = url.searchParams.get('normalized_value') === 'eq.NOTFOUND' ? [] : products.map(p => ({ product_id: p.id }));
      else if (url.pathname.endsWith('/import_catalogue_product')) { const existing = products.find(p => p.internal_code === body.p_draft.internal_code); if (!existing) products.push({ ...makeProduct(), internal_code: body.p_draft.internal_code, category: '' }); response = { created: !existing, productId }; }
      else if (url.pathname.endsWith('/adjust_product_stock')) { products[0].stock_quantity += body.p_delta; response = products[0].stock_quantity; }
      else if (url.pathname.endsWith('/scan_order_item')) { const item = order.order_items[0]; order.order_items = item ? [{ ...item, quantity: item.quantity + 1 }] : [{ id: 'item-1', product_id: productId, quantity: 1, internal_code_snapshot: '05-0001', product_name_snapshot: 'Devio guida', product: makeProduct() }]; response = []; }
      else if (url.pathname.endsWith('/product_categories')) {
        if (request.method() === 'POST') { categories.push(body.name); }
        response = categories.map(name => ({ name }));
      } else if (url.pathname.endsWith('/products')) {
        if (request.method() === 'DELETE') { products = []; response = { id: productId }; }
        else if (request.method() === 'PATCH') { products = products.map(p => ({ ...p, ...body })); response = products; }
        else response = request.headers().accept?.includes('vnd.pgrst.object') ? products[0] : products;
      } else if (url.pathname.endsWith('/orders')) response = request.headers().accept?.includes('vnd.pgrst.object') ? order : [order];
      else if (url.pathname.endsWith('/save_catalogue_product')) {
        const draft = body.p_draft;
        products = [{ ...makeProduct(), internal_code: draft.internal_code.toUpperCase(), name: draft.name, stock_quantity: draft.stockQuantity, category: draft.category }];
        response = productId;
      } else if (url.pathname.endsWith('/rename_product_category')) {
        categories = categories.map(name => name === body.p_name ? body.p_new_name : name);
        products = products.map(p => ({ ...p, category: body.p_new_name }));
      } else if (url.pathname.endsWith('/delete_product_category')) {
        categories = categories.filter(name => name !== body.p_name);
        products = body.p_delete_products ? [] : products.map(p => ({ ...p, category: '' }));
      } else if (url.pathname.endsWith('/manage_order')) order = { ...order, name: body.p_name, notes: body.p_notes, status: body.p_status };
      else if (url.pathname.endsWith('/set_order_item_quantity')) order = { ...order, order_items: body.p_quantity === 0 ? [] : order.order_items.map(item => ({ ...item, quantity: body.p_quantity })) };
      else if (url.pathname.endsWith('/delete_catalogue_order')) response = null;
      else throw new Error(`Unexpected mocked API request: ${url.pathname}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.addInitScript(({ userId }) => {
      const encode = value => btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: 4102444800 })}.fake-signature`;
      const session = { access_token: token, refresh_token: 'fake-refresh-token', token_type: 'bearer', expires_at: 4102444800, expires_in: 3600, user: { id: userId, aud: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {} } };
      document.cookie = `sb-vfiiyuwvpocmmlhvmrlo-auth-token=base64-${encode(session)}; path=/; SameSite=Lax`;
    }, { userId });

    await page.goto('http://127.0.0.1:3100/codici/magazzino');
    await page.getByRole('button', { name: 'Gestisci categorie' }).waitFor();
    await page.getByRole('link', { name: 'Modifica', exact: true }).click();
    await page.getByLabel('Nostro codice', { exact: true }).fill('05-0099');
    assert.equal(await page.getByLabel('Barcode automatico', { exact: false }).inputValue(), '05-0099');
    await page.getByLabel('Nome prodotto', { exact: true }).fill('Devio aggiornato');
    await page.getByLabel('Giacenza attuale', { exact: false }).fill('15');
    await page.getByRole('button', { name: 'Salva prodotto', exact: true }).click();
    await page.waitForURL('**/codici/magazzino');
    await page.getByText('Devio aggiornato', { exact: true }).waitFor();
    const save = calls.find(call => call.path.endsWith('/save_catalogue_product'));
    assert.equal(save.body.p_product_id, productId);
    assert.equal(save.body.p_draft.stockQuantity, 15);
    assert.equal(save.body.p_expected_updated_at, '2026-10-11T10:00:00Z');

    await page.getByRole('button', { name: 'Gestisci categorie' }).click();
    await page.getByRole('button', { name: 'Rinomina Devio guida' }).click();
    await page.getByRole('textbox', { name: 'Rinomina Devio guida' }).fill('Devio luci');
    await page.getByRole('button', { name: 'Salva nome' }).click();
    await page.getByRole('button', { name: 'Elimina Devio luci', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Elimina Devio luci', exact: true }).click();
    await page.getByLabel('Elimina anche tutti i prodotti di questa categoria').check();
    await page.getByRole('button', { name: 'Elimina categoria e prodotti', exact: true }).click();
    const categoryDelete = calls.find(call => call.path.endsWith('/delete_product_category'));
    assert.equal(categoryDelete.body.p_delete_products, true);
    assert.equal(categoryDelete.body.p_expected_count, 1);
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();

    await page.goto(`http://127.0.0.1:3100/codici/ordini/${orderId}`);
    await page.getByRole('button', { name: 'Modifica lista', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Lista aggiornata');
    await page.getByLabel('Stato', { exact: false }).selectOption('open');
    await page.getByRole('button', { name: 'Salva lista', exact: true }).click();
    await page.getByRole('button', { name: 'Rimuovi 05-0001', exact: true }).click();
    await page.getByText('Scansiona il primo prodotto per aggiungerlo alla lista.').waitFor();
    assert(calls.some(call => call.path.endsWith('/set_order_item_quantity') && call.body.p_quantity === 0));
    await page.getByRole('button', { name: 'Elimina lista', exact: true }).click();
    await page.getByLabel('Restituisci le quantità al magazzino').uncheck();
    await page.getByRole('button', { name: 'Elimina lista', exact: true }).last().click();
    await page.waitForURL('**/codici/ordini');
    assert(calls.some(call => call.path.endsWith('/delete_catalogue_order') && call.body.p_restore_stock === false));

    products = [makeProduct()]; categories = ['Devio guida'];
    await page.goto('http://127.0.0.1:3100/codici/magazzino');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Gestisci categorie' }).waitFor();
    await page.screenshot({ path: '/tmp/officina-magazzino-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page must not scroll horizontally');
    await page.getByRole('link', { name: 'Modifica', exact: true }).click();
    await page.getByLabel('Nostro codice', { exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/officina-prodotto-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile product form must not scroll horizontally');
    await page.setViewportSize({ width: 1280, height: 900 });
    // A technical database error must be understandable and traceable.
    await page.goto('http://127.0.0.1:3100/codici');
    await page.getByPlaceholder('Punta la pistola qui o digita un codice…').fill('NOTFOUND');
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    await page.getByText('Nessun prodotto trovato', { exact: false }).waitFor();
    fault = { path: '/product_identifiers', code: '42702', message: 'column reference "id" is ambiguous' };
    await page.getByPlaceholder('Punta la pistola qui o digita un codice…').fill('05-0001');
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    await page.getByText('Riferimento per l’assistenza:', { exact: false }).waitFor();
    assert(!/ambiguous|column reference/.test(await page.locator('body').innerText()));
    assert(calls.some(c => c.path.endsWith('/record_activity_event') && c.body.p_technical_code === '42702'));
    await page.goto('http://127.0.0.1:3100/codici/attivita');
    await page.getByRole('button', { name: 'Aggiorna registro' }).waitFor();
    await page.getByText('Problema', { exact: true }).first().waitFor();
    // Required field, duplicate code and a product with optional parts missing.
    await page.goto('http://127.0.0.1:3100/codici/nuovo');
    const saveCount = calls.filter(c => c.path.endsWith('/save_catalogue_product')).length;
    await page.getByRole('button', { name: 'Salva prodotto' }).click();
    assert.equal(calls.filter(c => c.path.endsWith('/save_catalogue_product')).length, saveCount);
    await page.getByLabel('Nostro codice', { exact: true }).fill('05-0001');
    fault = { path: '/save_catalogue_product', code: '23505', message: 'duplicate key value violates unique constraint' };
    await page.getByRole('button', { name: 'Salva prodotto' }).click();
    await page.getByRole('alert').filter({ hasText: 'Codice prodotto già presente' }).waitFor();
    await page.getByLabel('Nostro codice', { exact: true }).fill('QA-NEW');
    await page.getByRole('button', { name: 'Salva prodotto' }).click();
    await page.waitForURL('**/codici/magazzino');
    // The same Excel file twice, duplicate rows, empty and invalid files.
    await page.goto('http://127.0.0.1:3100/codici/import');
    const upload = page.locator('input[type=file]');
    await upload.setInputFiles({ name: 'vuoto.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook([['NOSTRO CODICE']]) });
    await page.getByText('Il foglio è vuoto', { exact: false }).waitFor();
    await upload.setInputFiles({ name: 'doppio.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook([['NOSTRO CODICE'], ['QA-DUP'], [' qa-dup ']]) });
    await page.getByText('compare nelle righe 2 e 3', { exact: false }).waitFor();
    assert(await page.getByRole('button', { name: 'Conferma importazione' }).isDisabled());
    await upload.setInputFiles({ name: 'quantita.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook([['NOSTRO CODICE', 'QUANTITÀ'], ['QA-NEW', '1,5']]) });
    await page.getByText('inserisci un numero intero', { exact: false }).first().waitFor();
    assert(await page.getByRole('button', { name: 'Conferma importazione' }).isDisabled());
    const file = { name: 'corretto.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook([['NOSTRO CODICE'], ['QA-EXCEL']]) };
    await upload.setInputFiles(file);
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await page.getByText('1 nuovi prodotti', { exact: false }).waitFor();
    await upload.setInputFiles(file);
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await page.getByText('0 nuovi prodotti, 1 aggiornati', { exact: false }).waitFor();
    // Scan repetition increments quantity on the same row; removal and stock correction work.
    products = [makeProduct()]; categories = ['Devio guida']; order = { ...order, status: 'open', order_items: [] };
    await page.goto(`http://127.0.0.1:3100/codici/ordini/${orderId}`);
    for (let i=0;i<2;i++) {
      await page.getByPlaceholder('Punta qui la pistola barcode…').fill('05-0001');
      await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
      await page.getByLabel('Quantità 05-0001').waitFor();
      await page.waitForFunction(() => !document.querySelector('input[placeholder="Punta qui la pistola barcode…"]').disabled);
    }
    assert.equal(await page.getByLabel('Quantità 05-0001').inputValue(), '2');
    await page.getByLabel('Quantità 05-0001').fill('0');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await page.getByText('Scansiona il primo prodotto').waitFor();
    await page.goto('http://127.0.0.1:3100/codici/magazzino');
    await page.getByRole('button', { name: 'Rettifica', exact: false }).click();
    await page.getByLabel('Variazione', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Salva rettifica' }).click();
    await page.getByText('Inserisci una variazione intera diversa da zero.').waitFor();
    await page.getByLabel('Variazione', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Salva rettifica' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert(calls.some(c => c.path.endsWith('/adjust_product_stock') && c.body.p_delta === 3));
    await page.waitForFunction(() => document.querySelector('article')?.textContent.includes('13'));
    // Bulk assignment and deleting just the category preserve the products.
    await page.getByLabel('Seleziona tutti i 1 prodotti visualizzati').check();
    await page.getByLabel('Assegna categoria', { exact: true }).fill('Categoria nuova');
    await page.getByRole('button', { name: 'Assegna categoria', exact: true }).click();
    await page.getByRole('button', { name: 'Gestisci categorie' }).click();
    await page.getByRole('textbox', { name: 'Nuova categoria', exact: true }).fill('Categoria vuota');
    await page.getByRole('button', { name: 'Crea categoria' }).click();
    await page.getByRole('button', { name: 'Elimina Categoria vuota', exact: true }).click();
    await page.getByRole('button', { name: 'Elimina solo categoria', exact: true }).click();
    await page.getByRole('button', { name: 'Elimina Categoria vuota', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(products.length, 1);
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    // A failed diagnostic request cannot break the user's search; it is retried later.
    await page.goto('http://127.0.0.1:3100/codici');
    await page.getByPlaceholder('Punta la pistola qui o digita un codice…').fill('NOTFOUND');
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    await page.getByText('Nessun prodotto trovato', { exact: false }).waitFor();
    fault = { path: '/record_activity_event', code: '503', message: 'temporary logging failure' };
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    await page.getByText('Nessun prodotto trovato', { exact: false }).waitFor();
    const pending = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('officina-pending-activity-')).flatMap(key => JSON.parse(localStorage[key])));
    assert.equal(pending.length, 1);
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    await page.getByText('Nessun prodotto trovato', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('officina-pending-activity-')).flatMap(key => JSON.parse(localStorage[key])).length), 0);
    // Login and missing pages also have Italian messages.
    await page.goto('http://127.0.0.1:3100/login');
    await page.getByPlaceholder('email@officina.it').fill('test@example.invalid');
    await page.getByPlaceholder('Password', { exact: true }).fill('password-di-prova');
    fault = { path: '/auth/v1/token', code: 'invalid_credentials', message: 'Invalid login credentials' };
    await page.getByRole('button', { name: 'Accedi', exact: true }).click();
    await page.getByText('Email o password non corrette.', { exact: false }).waitFor();
    await page.goto('http://127.0.0.1:3100/questa-pagina-non-esiste');
    await page.getByRole('heading', { name: 'Pagina non trovata' }).waitFor();
    // DDT: mixed goods/services, discounts, optional vehicle, editing, emission and PDF.
    products=[{...makeProduct(),kind:'goods'},{...makeProduct(),id:'66666666-6666-4666-8666-666666666666',internal_code:'MAN001',kind:'service',name:'Manodopera',unit:'ore',product_prices:[{id:'service-price',amount:42.70,price_list:{name:'Prezzo vendita',sort_order:0}}]}];
    await page.goto('http://127.0.0.1:3100/codici/ddt/nuovo');
    await page.getByLabel('Azienda destinataria').selectOption(companyId);
    await page.getByLabel('Cerca nel catalogo').fill('05-0001');
    await page.getByRole('button', { name: '05-0001 · Devio guida', exact:true }).click();
    await page.getByLabel('Sconto riga 1').fill('10');
    await page.getByLabel('Cerca nel catalogo').fill('MAN001');
    await page.getByRole('button', { name: 'MAN001 · Manodopera (prestazione)', exact:true }).click();
    await page.getByLabel('Quantità riga 2').fill('2');
    await page.getByText('247,40 €', {exact:true}).waitFor();
    await page.getByLabel('Causale del trasporto').fill('Vendita ricambi');
    await page.getByLabel('Sconto riga 1').fill('101');
    await page.getByRole('button', {name:'Salva bozza',exact:true}).click();
    await page.getByText('Lo sconto deve essere tra 0 e 100.',{exact:true}).waitFor();
    await page.getByLabel('Sconto riga 1').fill('10');
    await page.getByRole('button', {name:'Salva bozza',exact:true}).click();
    await page.getByRole('button', {name:'Modifica bozza',exact:true}).waitFor();
    assert.equal(deliveryDocument.total,'247.40');
    await page.getByRole('button', {name:'Modifica bozza',exact:true}).click();
    await page.getByLabel('Note',{exact:true}).fill('Note aggiornate');
    await page.getByRole('button', {name:'Salva bozza',exact:true}).click();
    await page.getByRole('button', {name:'Modifica bozza',exact:true}).waitFor();
    assert.equal(deliveryDocument.notes,'Note aggiornate');
    fault={path:'/issue_delivery_document',code:'P0001',message:'Completa i dati dell’officina e la verifica amministrativa nelle impostazioni documenti prima di emettere.'};
    await page.getByRole('button', {name:'Emetti documento',exact:true}).click();
    await page.getByRole('button', {name:'Conferma emissione',exact:true}).click();
    await page.getByText('Completa i dati dell’officina e la verifica amministrativa',{exact:false}).waitFor();
    await page.getByRole('button', {name:'Conferma emissione',exact:true}).click();
    await page.getByRole('heading',{name:'DDT 1/2026',exact:true}).waitFor();
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Scarica PDF',exact:true}).click();
    const downloaded=await downloadPromise;await downloaded.saveAs('/tmp/officina-ddt-browser.pdf');
    assert(fs.readFileSync('/tmp/officina-ddt-browser.pdf').subarray(0,4).equals(Buffer.from('%PDF')));
    await page.getByRole('button',{name:'Annulla documento',exact:true}).click();
    await page.getByLabel('Motivo annullamento').fill('Documento di prova');
    await page.getByRole('button',{name:'Conferma annullamento',exact:true}).click();
    await page.getByText('Annullato: Documento di prova',{exact:true}).waitFor();
    await page.goto('http://127.0.0.1:3100/codici/ddt/nuovo');
    await page.getByLabel('Azienda destinataria').selectOption(companyId);
    await page.getByLabel('Cerca nel catalogo').fill('MAN001');
    await page.getByRole('button',{name:'MAN001 · Manodopera (prestazione)',exact:true}).click();
    await page.getByRole('button',{name:'Salva bozza',exact:true}).click();
    await page.getByRole('button',{name:'Modifica bozza',exact:true}).waitFor();
    assert.equal(deliveryDocument.kind,'work');
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/officina-ddt-mobile.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'DDT mobile must not scroll horizontally');
    await page.getByRole('button',{name:'Elimina bozza',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Elimina bozza',exact:true}).click();
    await page.waitForURL('**/codici/ddt');
    assert.equal(deliveryDocument,null);
    await page.goto('http://127.0.0.1:3100/codici/aziende');
    await page.getByRole('button',{name:'Nuova azienda',exact:true}).click();
    await page.getByLabel('Ragione sociale',{exact:true}).fill('Seconda azienda di prova');
    await page.getByRole('button',{name:'Salva azienda',exact:true}).click();
    await page.getByRole('heading',{name:'Seconda azienda di prova',exact:true}).waitFor();
    assert.deepEqual(errors, []);
    console.log('OK: browser CRUD, scansioni ripetute, importazione ripetuta, duplicati, campi mancanti, rettifiche, errori italiani e registro, desktop e mobile; nessun dato reale modificato.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
