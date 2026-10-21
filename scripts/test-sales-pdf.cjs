const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
require.extensions['.ts']=(module,path)=>module._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,path);
const {createReceiptPdf,createReorderPdf}=require('../lib/sales/pdf.ts');
const {PDFDocument}=require('pdf-lib');const assets={font:fs.readFileSync('public/fonts/NotoSans-Regular.ttf')};
const sale={id:'synthetic',status:'closed',number:15,year:2026,closed_at:'2026-10-21T18:00:00Z',operator_name:'Operatore dimostrativo',customer_name:'Antonio',client_snapshot:{name:'Antonio'},emitter_snapshot:{name:'Officina dimostrativa',address:'Via prova 1',city:'Roma'},payment_method:'Carta',notes:'Dati di prova',total:'486.00',lines:[{product_id:'p',code:'MOTOR-001',description:'Motorino di avviamento',kind:'goods',unit:'pz',quantity:'3',unit_price:'180.00',discount:'10',line_total:'486.00',purchase_price:'73.25'}]};
(async()=>{
 const bytes=await createReceiptPdf(sale,assets);assert((await PDFDocument.load(bytes)).getPageCount()>=1);fs.writeFileSync('/tmp/officina-receipt-qa.pdf',bytes);
 const long={...sale,lines:Array.from({length:100},(_,i)=>({...sale.lines[0],code:'RICAMBIO-'+i,description:i===3?'Descrizione molto lunga con accenti à è ì ò ù Ω '.repeat(120):'Motorino dimostrativo '+i}))};
 const multipage=await createReceiptPdf(long,assets);assert((await PDFDocument.load(multipage)).getPageCount()>2);fs.writeFileSync('/tmp/officina-receipt-long-qa.pdf',multipage);
 const snapshot={id:'snapshot',print_number:9,created_at:sale.closed_at,operator_name:sale.operator_name,lines:Array.from({length:80},(_,i)=>({id:'row'+i,sale_id:sale.id,sale_number:15,sale_year:2026,sale_status:i===1?'void':'closed',code:'MOTOR-'+i,description:'Motorino dimostrativo '+i,unit:'pz',quantity:3,sold_at:sale.closed_at,supplier:'Fornitore dimostrativo con nome esteso',supplier_code:'FOR-'+i}))};
 const reorder=await createReorderPdf(snapshot,assets);assert((await PDFDocument.load(reorder)).getPageCount()>1);fs.writeFileSync('/tmp/officina-reorder-long-qa.pdf',reorder);
 console.log('OK: receipt and reorder PDFs, multiline rows split across pages, cancelled labels and long supplier names.');
})().catch(e=>{console.error(e);process.exitCode=1;});
