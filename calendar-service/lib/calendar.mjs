const allowedOrigins=new Set(['https://andi201andi201.github.io','https://schichtkompass.bb-planer.ch','https://schichtkompass-domain.andi201andi201.chatgpt.site']);
const tokenOK=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function validateICS(ics,month){
 if(typeof ics!=='string'||ics.length>65000||!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month))throw Error('Ungültiger Monat');
 const unfolded=ics.replace(/\r\n[ \t]/g,'');
 if(!unfolded.startsWith('BEGIN:VCALENDAR\r\n')||!unfolded.endsWith('END:VCALENDAR\r\n'))throw Error('Ungültiger Kalender');
 const allowed=new Set('BEGIN END VERSION PRODID CALSCALE X-WR-CALNAME X-WR-TIMEZONE TZID DTSTART DTEND TZOFFSETFROM TZOFFSETTO TZNAME RRULE UID DTSTAMP SUMMARY CLASS TRANSP LOCATION DESCRIPTION TRIGGER ACTION'.split(' '));
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
 }
 if(stack.length||count>31)throw Error('Zu viele Termine');return ics;
}
export function mergeCalendars(rows){
 const base=rows[0]?.ics; if(!base)return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SchichtKompass//DE\r\nEND:VCALENDAR\r\n';
 const head=base.split('BEGIN:VEVENT')[0].replace('END:VCALENDAR\r\n','');
 return head+rows.map(r=>(r.ics.match(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g)||[]).join('')).join('')+'END:VCALENDAR\r\n';
}
export async function handle(request,db){
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);
 const origin=request.headers.get('Origin');
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin'};
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(parts[0]==='feed'){
  const [_,id,file]=parts,token=file?.replace(/\.ics$/,'');
  if(!tokenOK(id)||!tokenOK(token)||!['GET','HEAD'].includes(request.method))return reply({error:'Nicht gefunden'},404);
  const row=await db.prepare('SELECT read_hash, updated FROM calendars WHERE id=?').bind(id).first();
  if(!row||row.read_hash!==await hash(token))return reply({error:'Nicht gefunden'},404);
  const data=await db.prepare('SELECT ics FROM months WHERE calendar=? ORDER BY month').bind(id).all();
  return new Response(request.method==='HEAD'?null:mergeCalendars(data.results),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="SchichtKompass.ics"'}});
 }
 if(parts[0]!=='api'||parts[1]!=='calendar')return reply({error:'Nicht gefunden'},404);
 if(!allowedOrigins.has(origin))return reply({error:'Ursprung nicht erlaubt'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(request.method==='PUT'){
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
 if(request.method==='DELETE'){
  if(!existing)return reply({ok:true});
  await db.batch([db.prepare('DELETE FROM months WHERE calendar=?').bind(id),db.prepare('DELETE FROM calendars WHERE id=? AND edit_hash=?').bind(id,editHash)]);return reply({ok:true});
 }
 if(request.method!=='PUT')return reply({error:'Methode nicht erlaubt'},405);
 try{
  if(Number(request.headers.get('content-length'))>100000)return reply({error:'Zu gross'},413);
  const reader=request.body?.getReader();let size=0,chunks=[];if(!reader)throw Error('Daten fehlen');
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();return reply({error:'Zu gross'},413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!tokenOK(body.readToken))throw Error('Leseschlüssel fehlt');
  const ics=validateICS(body.ics,body.month),now=Date.now();
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
  return reply({ok:true});
 }catch{return reply({error:'Kalenderdaten ungültig. Monat und bestätigte Termine prüfen.'},400)}
}
