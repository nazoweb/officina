import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { money } from '../ddt/money';
import { saleDate, saleLabel, type Sale, type ReorderPrint } from '../../types/sales';

type Column = { title: string; width: number };
type PrintData = { title: string; subtitle: string; details: string[]; columns: Column[]; rows: string[][]; notes: string[]; total?: string };
async function render(data: PrintData, assets: {font: Uint8Array}) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(assets.font, {subset:true});
  const W=595.28,H=841.89,M=36,width=W-2*M;
  const ink=rgb(.10,.17,.22),muted=rgb(.36,.41,.45),light=rgb(.93,.96,.97);
  let page!: PDFPage; let y=0;
  const clean=(s:string)=>s.replace(/[\x00-\x1f]/g,' ');
  const text=(s:string,x:number,top:number,size=9)=>page.drawText(clean(s),{x,y:top,size,font,color:ink});
  function wrap(s:string,w:number,size=9) {
    const lines:string[]=[]; let line='';
    for (const word of clean(s).split(/\s+/).filter(Boolean)) {
      if(font.widthOfTextAtSize(line?`${line} ${word}`:word,size)<=w) {line=line?`${line} ${word}`:word;continue;}
      if(line){lines.push(line);line='';}
      for(const character of word){if(font.widthOfTextAtSize(line+character,size)>w && line){lines.push(line);line='';}line+=character;}
    }
    if(line)lines.push(line); return lines.length?lines:[''];
  }
  function tableHead(){
    page.drawRectangle({x:M,y:y-24,width,height:24,color:light}); let x=M;
    for(const col of data.columns){text(col.title,x+4,y-15,8);x+=col.width;} y-=32;
  }
  function next(table=false) {
    page=pdf.addPage([W,H]); y=H-45;
    text(data.title,M,y,15);y-=22;
    for(const line of wrap(data.subtitle,width,9)){text(line,M,y,9);y-=13;}y-=10;
    if(table)tableHead();
  }
  function block(value:string,size=9){
    for(const line of wrap(value,width,size)){if(y<75)next();text(line,M,y,size);y-=size+5;}
  }
  next();
  data.details.filter(Boolean).forEach(line=>block(line)); y-=10; tableHead();
  for (const row of data.rows) {
    const cells=row.map((value,index)=>wrap(value,data.columns[index].width-8,8));
    const count=Math.max(...cells.map(cell=>cell.length)); let offset=0;
    while(offset<count){
      if(y<95)next(true);
      const take=Math.min(count-offset,Math.floor((y-67)/12)-1);
      if(take<1){next(true);continue;}
      let x=M;
      cells.forEach((cell,index)=>{
        for(let i=0;i<take;i++)if(cell[offset+i])text(cell[offset+i],x+4,y-11-i*12,8);
        x+=data.columns[index].width;
      });
      y-=Math.max(28,take*12+10);page.drawLine({start:{x:M,y:y+3},end:{x:W-M,y:y+3},color:light,thickness:1}); offset+=take;
    }
  }
  y-=12;
  if(data.total){if(y<100)next();block(`Totale IVA inclusa: ${money(data.total)}`,14);y-=10;}
  data.notes.filter(Boolean).forEach(line=>block(line));
  const pages=pdf.getPages();pages.forEach((p,i)=>{
    page=p;page.drawText('Gestionale Officina - '+(data.total?'Riepilogo interno della vendita':'Lista interna di riordino'),{x:M,y:34,size:7,font,color:muted});
    page.drawText(`${i+1} / ${pages.length}`,{x:W-M-40,y:34,size:7,font,color:muted});
  });
  pdf.setTitle(data.title);pdf.setLanguage('it-IT');pdf.setProducer('Gestionale Officina');return pdf.save();
}
export function createReceiptPdf(sale:Sale,assets:{font:Uint8Array}) {
  return render({
    title:`Scontrino interno - ${saleLabel(sale)}`,
    subtitle:`${saleDate(sale.closed_at!)}${sale.status==='void'?' - ANNULLATA':''}`,
    details:[sale.emitter_snapshot.name??'', [sale.emitter_snapshot.address,sale.emitter_snapshot.city].filter(Boolean).join(', '),
      sale.emitter_snapshot.vat_number?`P. IVA ${sale.emitter_snapshot.vat_number}`:'',
      `Cliente: ${sale.client_snapshot.name||sale.customer_name||'Cliente al banco'}`, `Operatore: ${sale.operator_name}`,
      sale.payment_method?`Pagamento: ${sale.payment_method}`:''],
    columns:[{title:'Codice',width:65},{title:'Descrizione',width:190},{title:'Qta / Ore',width:55},{title:'Prezzo €',width:75},{title:'Sc. %',width:45},{title:'Importo €',width:93.28}],
    rows:sale.lines.map(line=>[line.code,line.description,`${line.quantity.replace('.',',')} ${line.unit}`,money(line.unit_price),line.discount.replace('.',','),money(line.line_total||'0')]),
    total:sale.total, notes:[sale.notes, ...(sale.status==='void'?[`Annullata il ${saleDate(sale.cancelled_at!)}: ${sale.cancellation_reason}`,sale.stock_restored?'Quantità restituite al magazzino.':'Quantità non restituite al magazzino.']:[]), 'Prezzi di vendita comprensivi di IVA.'],
  },assets);
}
export function createReorderPdf(snapshot:ReorderPrint,assets:{font:Uint8Array}) {
  return render({
    title:`Da riordinare - stampa ${snapshot.print_number}`,
    subtitle:`Istantanea del ${saleDate(snapshot.created_at)} - ${snapshot.operator_name}`,
    details:[`${snapshot.lines.length} voci - ${snapshot.lines.reduce((sum,line)=>sum+line.quantity,0)} pezzi`, 'Copia storica: questa stampa non rimuove le voci dalla lista corrente.'],
    columns:[{title:'Venduta il',width:82},{title:'Vendita',width:61},{title:'Codice',width:65},{title:'Prodotto',width:133},{title:'Qta',width:47},{title:'Fornitore / codice',width:135.28}],
    rows:snapshot.lines.map(line=>[saleDate(line.sold_at),`${line.sale_number}/${line.sale_year}${line.sale_status==='void'?' ANNULLATA':''}`,line.code,line.description,`${line.quantity} ${line.unit}`,[line.supplier,line.supplier_code].filter(Boolean).join(' / ')]),
    notes:['Le voci della lista da riordinare si eliminano soltanto manualmente. Le vendite annullate sono segnalate e restano da verificare.'],
  },assets);
}
