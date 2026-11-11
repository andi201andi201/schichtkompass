import {dayCount,normalise,validateDefinition,pad,nextDay} from './core.js';
import {calendarSummary,departmentForEntry} from './duty-context.js';

export const GOOGLE_SCOPES=['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const APP='schichtkompass-v1';
const ROOT='https://www.googleapis.com/calendar/v3';
const isoDate=s=>s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');

// A complete, reviewed month is required before any Google request or deletion.
export async function googleMonth({year,month,entries,identity,location='',reminder=''}){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12||!normalise(identity||''))throw Error('Name oder Monat fehlt.');
 const count=dayCount(year,month);
 if(!Array.isArray(entries)||entries.length!==count||new Set(entries.map(e=>e.day)).size!==count||entries.some(e=>!Number.isInteger(e.day)||e.day<1||e.day>count||!validateDefinition(e.definition)))throw Error('Bitte zuerst jeden Tag des vollständigen Monats prüfen.');
 if(![0,15,30,60].includes(Number(reminder)))throw Error('Ungültige Erinnerung.');
 const person=await digest(normalise(identity)),key=year+'-'+pad(month),events=[];
 for(const e of entries){
  const d=e.definition;if(d.type==='skip')continue;
  const date=key+'-'+pad(e.day),next=isoDate(nextDay(year,month,e.day));
  const department=departmentForEntry(e);
  events.push({summary:calendarSummary(e),location:[location,department].filter(Boolean).join(' · '),
   description:'Aus dem persönlich geprüften Dienstplan übernommen. Massgeblich bleibt der offizielle Dienstplan.'+(department?'\nAbteilung: '+department:'')+(e.note?'\nZusatz aus der Zeile darunter: '+e.note:''),
   start:d.type==='allday'?{date}:{dateTime:date+'T'+d.start+':00',timeZone:'Europe/Zurich'},
   end:d.type==='allday'?{date:next}:{dateTime:(d.end<d.start?next:date)+'T'+d.end+':00',timeZone:'Europe/Zurich'},
   visibility:'private',transparency:'opaque',status:'confirmed',
   reminders:{useDefault:false,overrides:d.type==='shift'&&Number(reminder)>0?[{method:'popup',minutes:Number(reminder)}]:[]},
   extendedProperties:{private:{skApp:APP,skPerson:person,skMonth:key,skDay:String(e.day)}}});
 }
 return {person,month:key,events};
}

export function googleAPI(token,fetcher=fetch){
 return async(path,method='GET',body,etag)=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let response;
  try{response=await fetcher(ROOT+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});}
  catch{throw Error('Verbindung zu Google unterbrochen. Einige Termine könnten bereits gespeichert sein. Du kannst denselben Monat erneut übertragen.');}
  finally{clearTimeout(timeout)}
  if(!response.ok){
   const messages={401:'Die Google-Anmeldung ist abgelaufen. Bitte erneut verbinden.',403:'Google hat den Zugriff nicht erlaubt. Prüfe die Kalender-Berechtigungen und ob SchichtKompass für dein Konto freigeschaltet ist.',412:'Der Kalender wurde während der Übertragung geändert. Bitte denselben Monat erneut übertragen.',429:'Google erhält gerade zu viele Anfragen. Bitte später erneut versuchen.'};
   const error=Error(messages[response.status]||'Google konnte die Übertragung nicht abschliessen. Bitte denselben Monat erneut übertragen.');error.status=response.status;throw error;
  }
  if(response.status===204)return null;
  return response.json();
 };
}
async function allPages(api,path){
 const items=[];let pageToken;const seen=new Set();
 do{
  const data=await api(path+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));
  items.push(...(data.items||[]));pageToken=data.nextPageToken;
  if(pageToken&&seen.has(pageToken))throw Error('Google lieferte eine unvollständige Kalenderliste. Bitte erneut versuchen.');
  seen.add(pageToken);
 }while(pageToken);
 return items;
}
const properties=e=>e.extendedProperties?.private||{};
function belongs(e,plan){const p=properties(e);return p.skApp===APP&&p.skPerson===plan.person&&p.skMonth===plan.month;}
function sameDay(a,b){return properties(a).skDay===properties(b).skDay;}

// Upsert every desired event before removing obsolete managed events. Interrupted
// runs are safe to repeat. The deterministic IDs also cover a lost POST response.
export async function syncGoogleMonth(plan,api,onProgress=()=>{}){
 const description='SchichtKompass · Automatisch übertragene Dienste\nKennung: '+plan.person;
 const calendars=await allPages(api,'/users/me/calendarList?maxResults=250&showHidden=true&minAccessRole=owner');
 const matches=calendars.filter(c=>c.description===description&&c.accessRole==='owner');
 if(matches.length>1)throw Error('Mehrere zugehörige SchichtKompass-Kalender gefunden. Entferne zuerst den überzähligen Kalender in Google. Es wurde nichts geändert.');
 let calendar=matches[0];
 if(!calendar&&!plan.events.length)return {count:0,removed:0,calendarId:null};
 if(!calendar){onProgress('Dein SchichtKompass-Kalender wird erstellt …');calendar=await api('/calendars','POST',{summary:'SchichtKompass',description,timeZone:'Europe/Zurich'});}
 if(!calendar?.id||calendar.id==='primary')throw Error('Google hat keinen eigenen SchichtKompass-Kalender zurückgegeben.');
 const path='/calendars/'+encodeURIComponent(calendar.id)+'/events';
 const query=new URLSearchParams({maxResults:'2500',showDeleted:'false'});
 for(const [key,value]of Object.entries({skApp:APP,skPerson:plan.person,skMonth:plan.month}))query.append('privateExtendedProperty',key+'='+value);
 const current=(await allPages(api,path+'?'+query)).filter(e=>belongs(e,plan)&&e.status!=='cancelled');
 const keep=new Set();let done=0;
 for(const event of plan.events){
  const previous=current.find(e=>sameDay(e,event));let id=previous?.id;
  if(previous){await api(path+'/'+encodeURIComponent(id)+'?sendUpdates=none','PATCH',event,previous.etag);}
  else{
   // Deleted Google events reserve their old IDs. Try deterministic generations
   // so a free day can become a shift again without reviving a tombstone.
   let stored=false;
   for(let generation=0;generation<32;generation++){
    id=await digest(plan.person+'|'+plan.month+'|'+properties(event).skDay+'|'+generation);
    try{await api(path+'?sendUpdates=none','POST',{...event,id});stored=true;break;}
    catch(error){
     if(error.status!==409)throw error;
     let existing;
     try{existing=await api(path+'/'+id);}catch(e){if(e.status===410)continue;throw e;}
     if(existing?.status==='cancelled')continue;
     if(!belongs(existing||{},plan)||!sameDay(existing,event))throw Error('Eine Terminkennung ist bereits anders belegt. Es wurde kein fremder Termin überschrieben.');
     await api(path+'/'+id+'?sendUpdates=none','PATCH',event,existing.etag);stored=true;break;
    }
   }
   if(!stored)throw Error('Dieser Tag wurde zu oft gelöscht und neu angelegt. Bitte den Kalender prüfen.');
  }
  keep.add(id);onProgress(++done+' von '+plan.events.length+' Diensten übertragen …');
 }
 let removed=0;
 for(const event of current){
  if(keep.has(event.id))continue;
  try{await api(path+'/'+encodeURIComponent(event.id)+'?sendUpdates=none','DELETE',undefined,event.etag);}catch(e){if(![404,410].includes(e.status))throw e;}
  removed++;
 }
 return {count:plan.events.length,removed,calendarId:calendar.id};
}
