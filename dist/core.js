import {departmentForEntry} from './duty-context.js';
import {serviceForEntry,styledSummary,colourGroupForEntry} from './calendar-style.js';
export const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export const dayCount=(year,month)=>new Date(Date.UTC(year,month,0)).getUTCDate();
export const pad=n=>String(n).padStart(2,'0');
export function normalise(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
export function featureDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;return Math.sqrt(sum/a.length)/255}
export function groupSymbols(cells,threshold=.075){
 const groups=[],assigned=[];
 for(const cell of cells){
  let best=cell.serviceKey?groups.find(g=>g.serviceKey===cell.serviceKey):null,dist=best?0:Infinity;
  if(!best)for(const g of groups){if(cell.serviceKey&&g.serviceKey&&cell.serviceKey!==g.serviceKey)continue;if(cell.contextKey&&g.contextKey&&cell.contextKey!==g.contextKey)continue;const d=featureDistance(cell.feature,g.feature);if(d<dist){dist=d;best=g}}
  if(!best||dist>threshold){best={id:'g'+groups.length,feature:cell.feature,thumb:cell.thumb,serviceKey:cell.serviceKey,recognizedCode:cell.recognizedCode,legacyCode:cell.legacyCode,suggestedName:cell.suggestedName,strokeCode:cell.strokeCode,partIndex:cell.partIndex,partCount:cell.partCount,partialDate:cell.partialDate,contextKey:cell.contextKey,otherDepartment:cell.otherDepartment,requiresDepartment:cell.requiresDepartment,departmentCode:cell.departmentCode,departmentLabel:cell.departmentLabel,supplementLabels:cell.supplementLabels,notes:[],variants:[],days:[],definition:null,matched:false};groups.push(best)}
  if(!best.variants.some(v=>featureDistance(v.feature,cell.feature)<.01))best.variants.push({feature:cell.feature,thumb:cell.thumb});
  if(cell.note&&!best.notes.includes(cell.note))best.notes.push(cell.note);best.days.push(cell.day);assigned.push({...cell,groupId:best.id,distance:dist});
 }
 return{groups,cells:assigned};
}
export function validateDefinition(d){if(!d||!d.code?.trim()||!d.name?.trim()||!['shift','allday','skip'].includes(d.type))return false;if(d.type!=='skip'&&(d.otherDepartment||d.requiresDepartment)&&!d.department?.trim())return false;if(d.type!=='shift')return true;return /^([01]\d|2[0-3]):[0-5]\d$/.test(d.start||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end||'')&&d.start!==d.end}
export function shiftMinutes(d){if(d.type!=='shift'||!validateDefinition(d))return 0;const min=t=>Number(t.slice(0,2))*60+Number(t.slice(3));let diff=min(d.end)-min(d.start);if(diff<0)diff+=1440;return diff}
export function dateKey(y,m,d){return `${y}${pad(m)}${pad(d)}`}
export function nextDay(y,m,d){const n=new Date(Date.UTC(y,m-1,d+1));return dateKey(n.getUTCFullYear(),n.getUTCMonth()+1,n.getUTCDate())}
export function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
export function foldLine(line){const enc=new TextEncoder();let rows=[],row='',size=0;for(const c of line){const n=enc.encode(c).length;if(size+n>75){rows.push(row);row=' ';size=1}row+=c;size+=n}rows.push(row);return rows.join('\r\n')}
function eventUID(value){let a=0xcbf29ce484222325n,b=0x84222325cbf29ce4n;for(const byte of new TextEncoder().encode(value)){a=BigInt.asUintN(64,(a^BigInt(byte))*0x100000001b3n);b=BigInt.asUintN(64,(b^BigInt(byte))*0x100000001b3n)}return a.toString(16).padStart(16,'0')+b.toString(16).padStart(16,'0')+'@schichtkompass'}
export async function makeICS({year,month,entries,identity='',location='',reminder=null,emojis=false,now=new Date()}){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SchichtKompass//Spitalpilot 1//DE','CALSCALE:GREGORIAN','X-WR-CALNAME:SchichtKompass','X-WR-TIMEZONE:Europe/Zurich','BEGIN:VTIMEZONE','TZID:Europe/Zurich','BEGIN:DAYLIGHT','DTSTART:19700329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
 const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 for(const e of entries){const d=e.definition;if(!validateDefinition(d))throw new Error('Nicht alle Dienste sind vollständig zugeordnet.');if(d.type==='skip')continue;const date=dateKey(year,month,e.day);const uid=eventUID(normalise(identity)+'|'+date+(e.partCount>1?'|part:'+e.partIndex:''));
 const service=serviceForEntry(e);
 lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'SUMMARY:'+escapeICS(styledSummary(e,emojis)),'X-SCHICHTKOMPASS-SERVICE:'+service.id,'X-SCHICHTKOMPASS-SERVICE-NAME:'+escapeICS(service.label),'X-SCHICHTKOMPASS-GROUP:'+colourGroupForEntry(e).id,'CLASS:PRIVATE','TRANSP:OPAQUE');
 if(d.type==='allday')lines.push('DTSTART;VALUE=DATE:'+date,'DTEND;VALUE=DATE:'+nextDay(year,month,e.day));else{const overnight=d.end<d.start;lines.push('DTSTART;TZID=Europe/Zurich:'+date+'T'+d.start.replace(':','')+'00','DTEND;TZID=Europe/Zurich:'+(overnight?nextDay(year,month,e.day):date)+'T'+d.end.replace(':','')+'00')}
 const department=departmentForEntry(e),eventLocation=[location,department].filter(Boolean).join(' · ');if(eventLocation)lines.push('LOCATION:'+escapeICS(eventLocation));lines.push('DESCRIPTION:'+escapeICS('Aus dem persönlich geprüften Dienstplan übernommen. Massgeblich bleibt der offizielle Dienstplan.'+(department?'\nAbteilung: '+department:'')+(e.note?'\nZusatz aus der Zeile darunter: '+e.note:'')));
 if(d.type==='shift'&&Number(reminder)>0)lines.push('BEGIN:VALARM','TRIGGER:-PT'+Math.round(Number(reminder))+'M','ACTION:DISPLAY','DESCRIPTION:'+escapeICS(d.name),'END:VALARM');lines.push('END:VEVENT')}
 lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
export function detectGrid(items,viewportWidth,days){
 const rows=[];for(const t of items){if(!/^\d{1,2}$/.test(t.text.trim()))continue;const n=Number(t.text);if(n<1||n>31||t.y>viewportWidth*.22)continue;let r=rows.find(r=>Math.abs(r.y-t.y)<Math.max(t.height*.7,3));if(!r){r={y:t.y,items:[]};rows.push(r)}r.items.push({...t,n})}
 const candidates=rows.map(r=>{const sorted=r.items.sort((a,b)=>a.x-b.x);const one=sorted.findIndex(t=>t.n===1);if(one<0)return null;const seq=sorted.slice(one,one+days);if(seq.length!==days||!seq.every((t,i)=>t.n===i+1))return null;const xs=seq.map(t=>t.x+t.width/2);const step=(xs.at(-1)-xs[0])/(days-1);if(step<=0)return null;const err=Math.max(...xs.map((x,i)=>Math.abs(x-(xs[0]+i*step))));if(err>step*.25)return null;return{left:xs[0]-step*.5,right:xs.at(-1)+step*.5,headerY:r.y,step}}).filter(Boolean);return candidates[0]||null;
}
export function findPerson(items,name){const tokens=normalise(name).split(' ').filter(Boolean);if(!tokens.length)return[];const matches=[];for(const item of items){let text=item.text;let x=item.x,y=item.y,width=item.width,height=item.height;if(!tokens.every(t=>normalise(text).split(' ').includes(t))){const neighbours=items.filter(n=>Math.abs(n.y-item.y)<Math.max(item.height*.5,2)&&Math.abs(n.x-item.x)<Math.max(200,item.width*3));text=neighbours.sort((a,b)=>a.x-b.x).map(n=>n.text).join(' ');if(!tokens.every(t=>normalise(text).split(' ').includes(t)))continue;x=Math.min(...neighbours.map(n=>n.x));width=Math.max(...neighbours.map(n=>n.x+n.width))-x}if(!matches.some(m=>Math.abs(m.y-y)<height))matches.push({x,y,width,height})}return matches}
