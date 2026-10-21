// Browser proof with synthetic data; every Supabase request is intercepted.
const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {chromium}=require(process.env.OFFICINA_PLAYWRIGHT||'playwright');
const userId='22222222-2222-4222-8222-222222222222';const companyId='44444444-4444-4444-8444-444444444444';
const productId='11111111-1111-4111-8111-111111111111';const batteryId='33333333-3333-4333-8333-333333333333';
const makeProduct=(id,code,name,price)=>({id,kind:'goods',internal_code:code,name,description:name,brand:'',category:'Ricambi',unit:'pz',stock_quantity:10,purchase_price:73.25,product_identifiers:[{id:randomUUID(),product_id:id,kind:'barcode',value:code,normalized_value:code}],product_prices:[{id:randomUUID(),amount:price,price_list:{id:randomUUID(),name:'Prezzo vendita',sort_order:0}}]});
const products=[makeProduct(productId,'MOTOR-001','Motorino di avviamento',180),makeProduct(batteryId,'BATT-001','Batteria 70 Ah',120)];
const company={id:companyId,name:'Azienda prova S.r.l.',active:true,address:'Via prova 1',city:'Roma',vat_number:'QA123',updated_at:'2026-10-21T10:00:00Z'};
const sales=[];let reorder=[];const prints=[];let failDdt=false;const calls=[];const errors=[];
const operator='operatore@example.invalid';
function newCart(){return{id:randomUUID(),status:'draft',number:null,year:null,version:1,created_by:userId,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),closed_at:null,client_id:null,customer_name:'',notes:'',payment_method:'',client_snapshot:{},emitter_snapshot:{name:'Officina prova'},operator_name:'',lines:[],total:'0.00',delivery_document_id:null,cancelled_at:null,cancellation_reason:null,stock_restored:false};}
function sum(s){s.total=s.lines.reduce((sum,l)=>{l.line_total=(Number(l.quantity)*Number(l.unit_price)*(1-Number(l.discount)/100)).toFixed(2);return sum+Number(l.line_total);},0).toFixed(2);s.version++;return s;}
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 let page;
 try{
  page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3100/**',route=>{const headers={...route.request().headers()};delete headers.cookie;return route.continue({headers});});
  await page.route('https://**.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.postDataJSON();calls.push({path:url.pathname,body});let response=[];
   if(url.pathname.includes('/auth/v1/'))response={id:userId,aud:'authenticated',role:'authenticated',email:operator,app_metadata:{},user_metadata:{}};
   else if(url.pathname.endsWith('/record_activity_event'))response=null;
   else if(url.pathname.endsWith('/business_clients'))response=[company];
   else if(url.pathname.endsWith('/products')){const ids=url.searchParams.get('id');response=ids?products.filter(p=>ids.includes(p.id)):products;}
   else if(url.pathname.endsWith('/product_identifiers'))response=products.filter(p=>url.searchParams.get('normalized_value')==='eq.SHARED'||p.internal_code===url.searchParams.get('normalized_value')?.slice(3)).map(p=>({product_id:p.id}));
   else if(url.pathname.endsWith('/sales_view'))response=url.searchParams.has('id')?sales.find(s=>s.id===url.searchParams.get('id').slice(3)):sales.filter(s=>s.status!=='draft');
   else if(url.pathname.endsWith('/reorder_entries_view'))response=reorder.filter(l=>!l.removed_at).map(l=>({...l,sale_status:sales.find(s=>s.id===l.sale_id).status}));
   else if(url.pathname.endsWith('/reorder_prints'))response=url.searchParams.has('id')?prints.find(p=>p.id===url.searchParams.get('id').slice(3)):prints;
   else if(url.pathname.endsWith('/sales_command')){
    let s=sales.find(s=>s.id===body.p_id);const payload=body.p_payload;
    if(body.p_action==='open'){s=sales.find(s=>s.status==='draft');if(!s){s=newCart();sales.push(s);}response=s;}
    else if(body.p_action==='add'){
     if(!s.operations)s.operations=[];
     if(!s.operations.includes(payload.operation_id)){
      const p=products.find(p=>p.id===payload.product_id);const existing=s.lines.find(l=>l.product_id===p.id);
      if(existing)existing.quantity=String(Number(existing.quantity)+1);
      else s.lines.push({product_id:p.id,kind:p.kind,code:p.internal_code,description:p.name,unit:p.unit,quantity:'1',unit_price:String(p.product_prices[0].amount),discount:'0'});
      s.operations.push(payload.operation_id);sum(s);
     }response=s;
    }else if(body.p_action==='line'){
     if(payload.quantity==='0')s.lines.splice(payload.index,1);else s.lines[payload.index]={...s.lines[payload.index],quantity:payload.quantity,unit_price:payload.unit_price,discount:payload.discount};response=sum(s);
    }else if(body.p_action==='edit'){Object.assign(s,payload);if(payload.client_id)s.customer_name=company.name;s.version++;response=s;}
    else if(body.p_action==='close'){
     if(payload.issue_ddt&&failDdt){failDdt=false;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'Completa i dati dell’officina e la verifica amministrativa nelle impostazioni documenti prima di emettere.'})});}
     if(s.status==='draft'){
      Object.assign(s,{status:'closed',number:sales.filter(s=>s.status!=='draft').length+1,year:2026,closed_at:new Date().toISOString(),operator_name:operator,client_snapshot:s.client_id?{...company}:{name:s.customer_name},delivery_document_id:payload.issue_ddt?randomUUID():null});
      for(const [index,l] of s.lines.entries()){products.find(p=>p.id===l.product_id).stock_quantity-=Number(l.quantity);reorder.push({id:randomUUID(),sale_id:s.id,line_index:index,product_id:l.product_id,code:l.code,description:l.description,quantity:Number(l.quantity),unit:l.unit,sold_at:s.closed_at,supplier:'Fornitore prova',supplier_code:'FOR-'+l.code,sale_number:s.number,sale_year:s.year,sale_status:'closed'});}s.version++;
     }response=s;
    }else if(body.p_action==='snapshot'){
     response=prints.find(p=>p.id===body.p_id);if(!response){response={id:body.p_id,print_number:prints.length+1,created_at:new Date().toISOString(),operator_name:operator,lines:structuredClone(reorder.filter(l=>!l.removed_at))};prints.push(response);}
    }else if(body.p_action==='remove_reorder'){for(const l of reorder)if(payload.ids.includes(l.id))l.removed_at=new Date().toISOString();response={removed:payload.ids.length};}
    else if(body.p_action==='void'){if(s.status!=='void'){s.status='void';s.cancellation_reason=payload.reason;s.cancelled_at=new Date().toISOString();s.stock_restored=payload.restore_stock;if(payload.restore_stock)for(const l of s.lines)products.find(p=>p.id===l.product_id).stock_quantity+=Number(l.quantity);s.version++;}response=s;}
    else if(body.p_action==='discard'){sales.splice(sales.indexOf(s),1);response={discarded:true};}
    else throw new Error('Unexpected sales action '+body.p_action);
   }else throw new Error('Unexpected API '+url.pathname);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.addInitScript(({userId})=>{
   const encode=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,role:'authenticated',exp:4102444800})}.fake`;
   const session={access_token:token,refresh_token:'fake',token_type:'bearer',expires_at:4102444800,expires_in:3600,user:{id:userId,aud:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{}}};
   document.cookie=`sb-vfiiyuwvpocmmlhvmrlo-auth-token=base64-${encode(session)}; path=/; SameSite=Lax`;
  },{userId});
  const scan=async code=>{await page.getByPlaceholder('Codice o barcode…').fill(code);await page.getByPlaceholder('Codice o barcode…').press('Enter');};
  const waitQuantity=async(code,quantity)=>page.waitForFunction(({code,quantity})=>document.querySelector(`input[aria-label="Quantità vendita ${code}"]`)?.value===quantity,{code,quantity});
  await page.goto('http://127.0.0.1:3100/codici/vendite');await page.getByText('Il carrello è vuoto.',{exact:false}).waitFor();
  await scan('SHARED');await page.getByRole('button',{name:'MOTOR-001 · Motorino di avviamento',exact:true}).waitFor();
  await scan('BATT-001');await page.getByRole('button',{name:'MOTOR-001 · Motorino di avviamento',exact:true}).click();
  await waitQuantity('BATT-001','1');await waitQuantity('MOTOR-001','1');
  await page.getByRole('button',{name:'Rimuovi MOTOR-001 dalla vendita',exact:true}).click();await page.getByLabel('Quantità vendita MOTOR-001',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Rimuovi BATT-001 dalla vendita',exact:true}).click();await page.getByText('Il carrello è vuoto.',{exact:false}).waitFor();
  await scan('MOTOR-001');await scan('MOTOR-001');await waitQuantity('MOTOR-001','2');
  assert.equal(products[0].stock_quantity,10);assert.equal(reorder.length,0);
  await page.getByLabel('Quantità vendita MOTOR-001',{exact:true}).fill('3');await page.getByLabel('Sconto vendita MOTOR-001',{exact:true}).fill('10');
  assert(await page.getByRole('button',{name:'Chiudi vendita',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Salva riga',exact:true}).click();await page.getByText('486,00 €',{exact:true}).last().waitFor();
  await scan('BATT-001');await waitQuantity('BATT-001','1');await page.getByRole('button',{name:'Rimuovi BATT-001 dalla vendita',exact:true}).click();
  await page.getByLabel('Quantità vendita BATT-001',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Cliente e pagamento/}).click();await page.getByLabel('Nome cliente (facoltativo)').fill('Antonio');await page.getByLabel('Pagamento',{exact:true}).selectOption('Carta');
  await page.getByRole('button',{name:'Chiudi vendita',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Chiudi vendita')?.disabled);await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'/tmp/officina-sales-cart.png',fullPage:true});
  await page.getByRole('button',{name:'Chiudi vendita',exact:true}).click();await page.getByRole('button',{name:'Conferma vendita',exact:true}).click();
  await page.getByRole('heading',{name:'Vendita 1/2026',exact:true}).waitFor();const firstId=sales[0].id;
  assert.equal(products[0].stock_quantity,7);assert.equal(reorder.length,1);assert.equal(sales[0].total,'486.00');
  assert(!JSON.stringify(sales[0].lines).includes('purchase'));await page.getByText('Antonio',{exact:true}).waitFor();
  let download=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica PDF',exact:true}).click();await (await download).saveAs('/tmp/officina-sales-receipt.pdf');
  await page.screenshot({path:'/tmp/officina-sales-receipt.png',fullPage:true});
  await page.getByRole('link',{name:'Nuova vendita',exact:true}).click();await page.getByText('Il carrello è vuoto.',{exact:false}).waitFor();
  await page.getByRole('button',{name:/Cliente e pagamento/}).click();await page.getByLabel('Azienda per il DDT',{exact:true}).selectOption(companyId);await scan('BATT-001');await waitQuantity('BATT-001','1');
  failDdt=true;await page.getByRole('button',{name:'Chiudi ed emetti DDT',exact:true}).click();await page.getByRole('button',{name:'Conferma vendita e DDT',exact:true}).click();
  await page.getByText('Completa i dati dell’officina e la verifica amministrativa',{exact:false}).waitFor();assert.equal(products[1].stock_quantity,10);assert.equal(reorder.length,1);
  await page.getByRole('button',{name:'Conferma vendita e DDT',exact:true}).click();await page.getByRole('heading',{name:'Vendita 2/2026',exact:true}).waitFor();
  await page.getByRole('link',{name:'Apri DDT',exact:true}).waitFor();assert.equal(products[1].stock_quantity,9);
  await page.getByRole('link',{name:'Da riordinare',exact:true}).last().click();await page.getByLabel('Seleziona tutte le voci visibili').waitFor();
  await page.getByLabel('Filtra lista da riordinare').fill('Motorino');await page.getByRole('button',{name:'Stampa lista',exact:true}).click();
  await page.getByRole('heading',{name:'Stampa 1',exact:true}).waitFor();assert.equal(prints[0].lines.length,2);assert.equal(reorder.filter(l=>!l.removed_at).length,2);
  download=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica PDF',exact:true}).click();await (await download).saveAs('/tmp/officina-reorder-print.pdf');
  const printId=prints[0].id;
  await page.getByRole('link',{name:'Torna alla lista',exact:true}).click();await page.getByLabel('Seleziona tutte le voci visibili').waitFor();
  await page.getByRole('checkbox',{name:'Seleziona MOTOR-001 vendita 1/2026',exact:true}).check();await page.getByRole('button',{name:'Elimina dalla lista (1)',exact:true}).click();await page.getByRole('button',{name:'Conferma rimozione dalla lista',exact:true}).click();
  await page.getByRole('checkbox',{name:'Seleziona MOTOR-001 vendita 1/2026',exact:true}).waitFor({state:'hidden'});assert.equal(reorder.filter(l=>!l.removed_at).length,1);assert.equal(prints[0].lines.length,2);assert.equal(products[0].stock_quantity,7);
  await page.getByRole('dialog').waitFor({state:'hidden'});await page.screenshot({path:'/tmp/officina-reorder-list.png',fullPage:true});
  await page.goto(`http://127.0.0.1:3100/codici/riordino/stampe/${printId}`);await page.getByText('Motorino di avviamento',{exact:true}).filter({visible:true}).waitFor();assert.equal(prints.length,1);
  await page.goto(`http://127.0.0.1:3100/codici/vendite/${firstId}`);await page.getByRole('button',{name:'Annulla vendita',exact:true}).click();await page.getByLabel('Motivo dell’annullamento').fill('Reso del cliente');await page.getByRole('button',{name:'Conferma annullamento vendita',exact:true}).click();
  await page.getByText('Vendita annullata',{exact:true}).waitFor();assert.equal(products[0].stock_quantity,10);assert.equal(reorder.filter(l=>!l.removed_at).length,1);assert.equal(prints[0].lines.length,2);
  await page.getByRole('link',{name:'Storico vendite',exact:true}).last().click();await page.getByRole('button',{name:'Cerca',exact:true}).waitFor();
  await page.getByLabel('Cerca vendita').fill('Antonio');await page.getByRole('button',{name:'Cerca',exact:true}).click();await page.getByRole('link',{name:/Vendita 1\/2026/}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:3100/codici/vendite');await page.getByText('Il carrello è vuoto.',{exact:false}).waitFor();
  await scan('MOTOR-001');await waitQuantity('MOTOR-001','1');await page.screenshot({path:'/tmp/officina-sales-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile cart overflow');
  for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const route of ['/codici/riordino','/codici/vendite/storico',`/codici/vendite/${firstId}`,`/codici/riordino/stampe/${printId}`]){
      await page.goto(`http://127.0.0.1:3100${route}`);
      await page.getByRole('heading',{level:1}).waitFor();
      if(route==='/codici/riordino')await page.getByRole('checkbox',{name:'Seleziona tutte le voci visibili'}).waitFor();
      if(route.includes('/stampe/'))await page.getByRole('button',{name:'Scarica PDF',exact:true}).waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}: ${route}`);
    }
  }
  assert.deepEqual(errors,[]);
  console.log('OK: scans, quantity/discount edits, removal, receipt history, PDF, next empty cart, atomic DDT error/retry, persistent reorder, immutable print and manual removal, cancellation, history search, mobile. No live records changed.');
 }catch(error){
  if(page){await page.screenshot({path:'/tmp/officina-sales-failure.png',fullPage:true});console.error((await page.locator('main').last().innerText()).slice(0,7000));}
  console.error(JSON.stringify({sales,calls:calls.slice(-15)},null,2));throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
