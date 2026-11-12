const allowedOrigins=new Set(['https://andi201andi201.github.io','https://schichtkompass.bb-planer.ch','https://schichtkompass-domain.andi201andi201.chatgpt.site']);
import {DUTY_GROUPS,dutyGroup} from './duty-groups.js';
import {rewriteCalendar} from './calendar-display.mjs';
const tokenOK=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const serviceOK=value=>value==='legacy'||/^[a-f0-9]{32}$/.test(value||'');
const unfold=ics=>ics.replace(/\r\n[ \t]/g,'');
const events=ics=>unfold(ics).match(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g)||[];
const field=(event,key)=>new RegExp('^'+key+':([^\\r\\n]*)','m').exec(event)?.[1];
const serviceID=event=>field(event,'X-SCHICHTKOMPASS-SERVICE')||'legacy';
const unescape=value=>String(value||'').replace(/\\([nN,;\\])/g,(_,c)=>c==='n'||c==='N'?' ':c);
const groupOK=value=>Object.hasOwn(DUTY_GROUPS,value||'');
const groupID=event=>field(event,'X-SCHICHTKOMPASS-GROUP')||dutyGroup({name:unescape(field(event,'X-SCHICHTKOMPASS-SERVICE-NAME')||field(event,'SUMMARY')),type:/^DTSTART;VALUE=DATE:/m.test(event)?'allday':'shift'});
export function listGroups(rows){
 const counts=new Map();for(const row of rows)for(const event of events(row.ics)){const id=groupID(event);counts.set(id,(counts.get(id)||0)+1)}
 return Object.entries(DUTY_GROUPS).map(([id,label])=>({id,label,count:counts.get(id)||0}));
}
function fold(line){let row='',size=0,rows=[];for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){rows.push(row);row=' ';size=1}row+=c;size+=n}rows.push(row);return rows.join('\r\n')}
export function listServices(rows){
 const found=new Map();
 for(const row of rows)for(const event of events(row.ics)){
  const id=serviceID(event),label=id==='legacy'?'Bisherige Dienste':unescape(field(event,'X-SCHICHTKOMPASS-SERVICE-NAME'))||'Dienst';
  const service=found.get(id)||{id,label,count:0};service.count++;found.set(id,service);
 }
 return [...found.values()].sort((a,b)=>a.label.localeCompare(b.label,'de-CH'));
}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function validateICS(ics,month){
 if(typeof ics!=='string'||ics.length>65000||!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month))throw Error('Ungültiger Monat');
 const unfolded=ics.replace(/\r\n[ \t]/g,'');
 if(!unfolded.startsWith('BEGIN:VCALENDAR\r\n')||!unfolded.endsWith('END:VCALENDAR\r\n'))throw Error('Ungültiger Kalender');
 const allowed=new Set('BEGIN END VERSION PRODID CALSCALE X-WR-CALNAME X-WR-TIMEZONE TZID DTSTART DTEND TZOFFSETFROM TZOFFSETTO TZNAME RRULE UID DTSTAMP LAST-MODIFIED SEQUENCE SUMMARY CLASS TRANSP LOCATION DESCRIPTION TRIGGER ACTION X-SCHICHTKOMPASS-SERVICE X-SCHICHTKOMPASS-SERVICE-NAME X-SCHICHTKOMPASS-GROUP X-SCHICHTKOMPASS-ORIGINAL-TITLE'.split(' '));
 const stack=[];let count=0;
 for(const line of unfolded.trim().split('\r\n')){
  const pos=line.indexOf(':');if(pos<1)throw Error('Ungültige Zeile');
  const key=line.slice(0,pos).split(';')[0],value=line.slice(pos+1);
  if(!allowed.has(key))throw Error('Unzulässiges Kalenderfeld');
  if(key==='BEGIN'){
   const parent=stack.at(-1);if(!((!parent&&value==='VCALENDAR')||(parent==='VCALENDAR'&&['VTIMEZONE','VEVENT'].includes(value))||(parent==='VTIMEZONE'&&['DAYLIGHT','STANDARD'].includes(value))||(parent==='VEVENT'&&value==='VALARM')))throw Error('Ungültige Struktur');
   stack.push(value);if(value==='VEVENT')count++;
  }
  if(key==='END'&&stack.pop()!==value)throw Error('Ungültiges Ende');
  if(key==='DTSTART'&&stack.at(-1)==='VEVENT'&&!value.startsWith(month.replace('-','')))throw Error('Termin ausserhalb des Monats');
  if(key==='ACTION'&&value!=='DISPLAY')throw Error('Ungültiger Alarm');
  if(key==='RRULE'&&stack.at(-1)!=='DAYLIGHT'&&stack.at(-1)!=='STANDARD')throw Error('Wiederholungen sind nicht erlaubt');
  if(key.startsWith('X-SCHICHTKOMPASS-SERVICE')&&(stack.at(-1)!=='VEVENT'||(key==='X-SCHICHTKOMPASS-SERVICE'&&!/^[a-f0-9]{32}$/.test(value))||(key==='X-SCHICHTKOMPASS-SERVICE-NAME'&&value.length>600)))throw Error('Ungültige Dienstart');
  if(key==='X-SCHICHTKOMPASS-GROUP'&&(stack.at(-1)!=='VEVENT'||!groupOK(value)))throw Error('Ungültige Dienstgruppe');
  if(key==='X-SCHICHTKOMPASS-ORIGINAL-TITLE'&&stack.at(-1)!=='VEVENT')throw Error('Ungültiger Termintitel');
  if(key==='SEQUENCE'&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))throw Error('Ungültige Terminfassung');
 }
 if(stack.length||count>124)throw Error('Zu viele Termine');return ics;
}
export function mergeCalendars(rows,service=null,group=null){
 const base=rows[0]?.ics; if(!base)return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SchichtKompass//DE\r\nEND:VCALENDAR\r\n';
 let head=unfold(base).split('BEGIN:VEVENT')[0].replace('END:VCALENDAR\r\n','');
 if(service||group){const label=group?DUTY_GROUPS[group]:listServices(rows).find(s=>s.id===service)?.label||'Dienst',name='SchichtKompass · '+label;head=head.replace(/^X-WR-CALNAME:[^\r\n]*\r\n/gm,'');head+=fold('X-WR-CALNAME:'+name.replace(/\\/g,'\\\\').replace(/[,;]/g,c=>'\\'+c).replace(/[\r\n]/g,' '))+'\r\n';}
 return head.split('\r\n').filter(Boolean).map(fold).join('\r\n')+'\r\n'+rows.flatMap(r=>events(r.ics).filter(e=>(!service||serviceID(e)===service)&&(!group||groupID(e)===group))).map(e=>e.trimEnd().split('\r\n').map(fold).join('\r\n')+'\r\n').join('')+'END:VCALENDAR\r\n';
}
async function readJSON(request,limit=100000){
 if(Number(request.headers.get('content-length'))>limit)throw Error('Zu gross');
 const reader=request.body?.getReader();let size=0,chunks=[];if(!reader)throw Error('Daten fehlen');
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Zu gross')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return JSON.parse(new TextDecoder().decode(bytes));
}
async function updateEmojis(db,id,editHash,enabled){
 const data=await db.prepare('SELECT key,month,ics FROM months WHERE calendar=? ORDER BY month').bind(id).all(),now=Date.now();
 const changes=data.results.map(row=>({...row,next:validateICS(rewriteCalendar(row.ics,{emojis:enabled}),row.month)})).filter(row=>row.next!==row.ics);
 if(changes.length)await db.batch([...changes.map(row=>db.prepare('UPDATE months SET ics=? WHERE key=? AND calendar=? AND ics=? AND EXISTS(SELECT 1 FROM calendars WHERE id=? AND edit_hash=?)').bind(row.next,row.key,id,row.ics,id,editHash)),db.prepare('UPDATE calendars SET updated=? WHERE id=? AND edit_hash=?').bind(now,id,editHash)]);
 return changes.length;
}
export async function handle(request,db){
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);
 const origin=request.headers.get('Origin');
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin'};
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(parts[0]==='feed'){
  const [_,id,file]=parts,token=file?.replace(/\.ics$/,'');
  const services=url.searchParams.getAll('dienst'),service=services[0]||null;
  const groups=url.searchParams.getAll('gruppe'),group=groups[0]||null;
  if(parts.length!==3||[...url.searchParams.keys()].some(key=>!['dienst','gruppe'].includes(key))||services.length+groups.length>1||(services.length&&!serviceOK(service))||(groups.length&&!groupOK(group))||!tokenOK(id)||!tokenOK(token)||!['GET','HEAD'].includes(request.method))return reply({error:'Nicht gefunden'},404);
  const row=await db.prepare('SELECT read_hash, updated FROM calendars WHERE id=?').bind(id).first();
  if(!row||row.read_hash!==await hash(token))return reply({error:'Nicht gefunden'},404);
  const data=await db.prepare('SELECT ics FROM months WHERE calendar=? ORDER BY month').bind(id).all();
  return new Response(request.method==='HEAD'?null:mergeCalendars(data.results,service,group),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="SchichtKompass.ics"'}});
 }
 if(parts[0]!=='api'||parts[1]!=='calendar')return reply({error:'Nicht gefunden'},404);
 if(!allowedOrigins.has(origin))return reply({error:'Ursprung nicht erlaubt'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(['PUT','PATCH'].includes(request.method)){
  const now=Date.now(),bucket=Math.floor(now/3600000),ip=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hash(ip+':'+bucket);
  const row=await db.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+7200000).first();
  if(row.count>30)return reply({error:'Zu viele Versuche. Bitte später erneut versuchen.'},429);
  await db.prepare('DELETE FROM limits WHERE expires<?').bind(now).run();
 }
 const id=parts[2],edit=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(!tokenOK(id)||!tokenOK(edit))return reply({error:'Zugriff verweigert'},401);
 const editHash=await hash(edit),existing=await db.prepare('SELECT edit_hash FROM calendars WHERE id=?').bind(id).first();
 if(existing&&existing.edit_hash!==editHash)return reply({error:'Zugriff verweigert'},403);
 if(request.method==='GET'){
  if(!existing)return reply({error:'Nicht gefunden'},404);
  const data=await db.prepare('SELECT ics FROM months WHERE calendar=? ORDER BY month').bind(id).all();
  return reply({services:listServices(data.results),groups:listGroups(data.results)});
 }
 if(request.method==='DELETE'){
  if(!existing)return reply({ok:true});
  await db.batch([db.prepare('DELETE FROM months WHERE calendar=?').bind(id),db.prepare('DELETE FROM calendars WHERE id=? AND edit_hash=?').bind(id,editHash)]);return reply({ok:true});
 }
 if(request.method==='PATCH'){
  if(!existing)return reply({error:'Nicht gefunden'},404);
  try{const body=await readJSON(request,1024);if(typeof body.emojis!=='boolean')throw Error('Ungültige Auswahl');const updatedMonths=await updateEmojis(db,id,editHash,body.emojis);return reply({ok:true,emojis:body.emojis,updatedMonths});}
  catch{return reply({error:'Die Emoji-Auswahl konnte nicht gespeichert werden. Bitte erneut versuchen.'},400)}
 }
 if(request.method!=='PUT')return reply({error:'Methode nicht erlaubt'},405);
 try{
  if(Number(request.headers.get('content-length'))>100000)return reply({error:'Zu gross'},413);
  const body=await readJSON(request);
  if(!tokenOK(body.readToken))throw Error('Leseschlüssel fehlt');
  let ics=validateICS(body.ics,body.month);const now=Date.now();
  const previous=await db.prepare('SELECT ics FROM months WHERE calendar=? AND month=?').bind(id,body.month).first();
  ics=validateICS(rewriteCalendar(ics,{previous:previous?.ics||'',emojis:typeof body.emojis==='boolean'?body.emojis:undefined}),body.month);
  // Cap each subscription to a rolling 25-month planning window.
  const monthIndex=Number(body.month.slice(0,4))*12+Number(body.month.slice(5))-1;
  const d=new Date(),current=d.getUTCFullYear()*12+d.getUTCMonth();
  if(Math.abs(monthIndex-current)>12)throw Error('Monat liegt mehr als ein Jahr entfernt');
  const cutoff=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-12,1)).toISOString().slice(0,7);
  await db.batch([
   db.prepare('INSERT INTO calendars(id,read_hash,edit_hash,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE calendars.edit_hash=excluded.edit_hash').bind(id,await hash(body.readToken),editHash,now),
   db.prepare('INSERT INTO months(key,calendar,month,ics) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM calendars WHERE id=? AND edit_hash=?) ON CONFLICT(key) DO UPDATE SET ics=excluded.ics').bind(id+':'+body.month,id,body.month,ics,id,editHash),
   db.prepare('DELETE FROM months WHERE calendar=? AND month<?').bind(id,cutoff)
  ]);
  if(typeof body.emojis==='boolean')await updateEmojis(db,id,editHash,body.emojis);
  const data=await db.prepare('SELECT ics FROM months WHERE calendar=? ORDER BY month').bind(id).all();
  return reply({ok:true,services:listServices(data.results),groups:listGroups(data.results)});
 }catch{return reply({error:'Kalenderdaten ungültig. Monat und bestätigte Termine prüfen.'},400)}
}
