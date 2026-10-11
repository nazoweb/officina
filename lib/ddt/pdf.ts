import { PDFDocument, rgb, degrees, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { DeliveryDocument, Party } from '../../types/ddt';
import { documentLabel } from '../../types/ddt';
import { money } from './money';

export async function createDeliveryPdf(document: DeliveryDocument, assets: { font: Uint8Array; logo?: Uint8Array }) {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(assets.font,{subset:true});const logo=assets.logo?await pdf.embedPng(assets.logo):null;
 const W=595.28,H=841.89,M=36,R=W-M;let page!:PDFPage;let y=0;
 const ink=rgb(.12,.15,.18),muted=rgb(.4,.44,.48),light=rgb(.94,.95,.96);
 const clean=(value:unknown)=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
 const text=(value:unknown,x:number,top:number,size=9,color=ink)=>page.drawText(clean(value),{x,y:top,size,font,color});
 const fit=(value:string,x:number,top:number,width:number,size=9)=>{let actual=size;while(actual>5&&font.widthOfTextAtSize(value,actual)>width)actual-=.25;text(value,x,top,actual);};
 function wrap(value:unknown,width:number,size=9):string[]{
  const result:string[]=[];let current='';
  for(const paragraph of clean(value).split(/\r?\n/)){
   for(const word of paragraph.split(/\s+/).filter(Boolean)){
    if(font.widthOfTextAtSize(current?current+' '+word:word,size)<=width){current=current?current+' '+word:word;continue;}
    if(current){result.push(current);current='';}
    for(const char of word){if(font.widthOfTextAtSize(current+char,size)>width&&current){result.push(current);current='';}current+=char;}
   }
   if(current){result.push(current);current='';}
  }
  return result.length?result:[''];
 }
 const partyLines=(party:Party)=>[party.name,party.vat_number?'P. IVA '+party.vat_number:'',party.tax_code?'C.F. '+party.tax_code:'',party.address,[party.postcode,party.city,party.province].filter(Boolean).join(' '),party.country,[party.phone,party.email].filter(Boolean).join(' · ')].filter(Boolean);
 const heading=document.kind==='ddt'?'Documento di Trasporto (DDT)':'Documento di lavoro / consegna';
 const date=new Intl.DateTimeFormat('it-IT').format(new Date(document.document_date+'T12:00:00'));
 const header=()=>{page.drawRectangle({x:M,y:y-22,width:R-M,height:22,color:light});[['Codice',M],['Descrizione',100],['Qta/Ore',333],['Prezzo lordo',385],['Sc. %',460],['Importo',500]].forEach(([label,x])=>text(label,Number(x)+4,y-14,7.5));y-=30;};
 const next=(first=false,table=true)=>{
  page=pdf.addPage([W,H]);
  if(document.status!=='issued')page.drawText(document.status==='draft'?'BOZZA - NON EMESSA':'ANNULLATO',{x:65,y:340,size:35,font,color:muted,opacity:.12,rotate:degrees(35)});
  if(first){
   if(logo){page.drawRectangle({x:M,y:H-99,width:112,height:61,color:rgb(.06,.06,.06)});page.drawImage(logo,{x:M+5,y:H-97,width:102,height:55});}
   let top=H-116;for(const line of partyLines(document.emitter_snapshot)){for(const value of wrap(line,235,8.5)){text(value,M,top,8.5);top-=11;}}
   const recipientLines=partyLines(document.client_snapshot).flatMap(line=>wrap(line,229,9));const boxHeight=Math.max(115,recipientLines.length*12+32);
   page.drawRectangle({x:307,y:H-36-boxHeight,width:R-307,height:boxHeight,borderColor:rgb(.78,.8,.82),borderWidth:.6});text('Spett.le',319,H-54,8,muted);let rt=H-72;recipientLines.forEach(line=>{text(line,319,rt,9);rt-=12;});
   y=Math.min(top-18,H-36-boxHeight-26);text(heading,M,y,15);y-=22;text(`${documentLabel(document)} · ${date}`,M,y,10);y-=24;
   const vehicle=document.vehicle;const details=[vehicle.brand&&'Marca: '+vehicle.brand,vehicle.model&&'Modello: '+vehicle.model,vehicle.plate&&'Targa: '+vehicle.plate,vehicle.vin&&'Telaio: '+vehicle.vin,vehicle.kilometres&&'Km: '+vehicle.kilometres].filter(Boolean).join(' · ');
   if(details){for(const line of wrap(details,R-M,9)){text(line,M,y,9);y-=12;}y-=8;}
   const transport=[document.delivery_address&&'Destinazione: '+document.delivery_address,document.transport_reason&&'Causale: '+document.transport_reason,document.carrier&&'Trasporto a cura di: '+document.carrier,document.transport_at&&'Data/ora trasporto: '+new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(document.transport_at)),document.packages!==null&&'Colli: '+document.packages].filter(Boolean);
   for(const line of transport.flatMap(value=>wrap(value,R-M,8))){text(line,M,y,8,muted);y-=11;}y-=12;
  }else{text(heading,M,H-48,12);fit(`${documentLabel(document)} · ${date} · ${document.client_snapshot.name}`,M,H-66,R-M,8.5);y=H-90;}
  if(table)header();
 };
 next(true);
 for(const line of document.lines){
  const code=wrap(line.code,54,8),description=wrap(line.description,224,9);const count=Math.max(code.length,description.length);let offset=0;
  while(offset<count){
   const available=Math.floor((y-110)/12)-2;if(available<1){next();continue;}
   const take=Math.min(count-offset,available);const height=Math.max(36,take*12+12);if(y-height<100){next();continue;}
   for(let i=0;i<take;i++){if(code[offset+i])text(code[offset+i],M+4,y-12-i*12,8);if(description[offset+i])text(description[offset+i],104,y-12-i*12,9);}
   if(offset===0){fit(line.quantity.replace('.',','),337,y-12,44,8);text(line.unit,337,y-24,7,muted);fit(money(line.unit_price),389,y-12,65,8);fit(line.discount.replace('.',','),464,y-12,32,8);fit(money(line.line_total||'0'),504,y-12,51,8);}
   y-=height;page.drawLine({start:{x:M,y:y+3},end:{x:R,y:y+3},color:rgb(.83,.85,.87),thickness:.4});offset+=take;
  }
 }
 if(y<190)next(false,false);y-=22;text('Totale IVA inclusa',382,y,10,muted);y-=25;fit(money(document.total),382,y,R-382,18);y-=30;
 const notes=[document.status==='void'?'ANNULLATO: '+document.cancellation_reason:'',document.notes].filter(Boolean).join('\n');
 for(const line of wrap(notes,R-M,9)){if(y<90)next(false,false);text(line,M,y,9);y-=12;}
 if(y<145)next(false,false);y-=35;text('Firma per consegna',M,y,8,muted);text('Firma per ricezione',340,y,8,muted);page.drawLine({start:{x:M,y:y-25},end:{x:245,y:y-25},color:muted,thickness:.5});page.drawLine({start:{x:340,y:y-25},end:{x:R,y:y-25},color:muted,thickness:.5});
 const pages=pdf.getPages();pages.forEach((p,index)=>{page=p;text('Tutti i prezzi indicati si intendono comprensivi di IVA.',M,49,8,muted);text('Stampare in due copie: una interna e una per il destinatario.',M,36,7,muted);text(`Pagina ${index+1} di ${pages.length}`,R-75,23,7,muted);});
 pdf.setTitle(`${documentLabel(document)} - ${document.client_snapshot.name}`);pdf.setLanguage('it-IT');pdf.setProducer('Gestionale officina');pdf.setCreationDate(new Date(document.created_at));return pdf.save();
}
