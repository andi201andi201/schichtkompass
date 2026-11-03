import {calendarLinks} from './calendar-choice.js';
const API='https://schichtkompass-calendar.andi201andi201.chatgpt.site';
const KEY='schichtkompass-subscription-v1';
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function identity(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.trim().toLowerCase().replace(/\s+/g,' ')))),b=>b.toString(16).padStart(2,'0')).join('')}
export function setupSubscription({canPublish,getContent,getMonth,getPerson,isDemo,notify,getTarget=()=>'iphone'}){
 const $=id=>document.getElementById(id);let busy=false,saved;
 try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
 if(saved&&![saved.id,saved.edit,saved.read,saved.identity].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))saved=null;
 let lastMonth='';
 const google=()=>['google','timetree-android'].includes(getTarget());
 function paint(){
  const isGoogle=google();
  $('subscription-panel').hidden=!getTarget();
  $('subscription-heading').textContent=isGoogle?'Deine Dienste in Google Kalender':'Deine Dienste im iPhone-Kalender';
  $('subscription-intro').textContent='Einmal verbinden. Danach hier jeden neuen oder korrigierten Monat speichern. Derselbe Monat wird ersetzt; andere Monate bleiben erhalten.';
  $('google-device-note').hidden=!isGoogle;
  $('google-subscribe-help').hidden=!isGoogle;
  $('subscription-provider-note').textContent=(isGoogle?'Google':'Apple')+' bestimmt, wann Änderungen abgerufen werden. Bereits manuell importierte Termine bleiben bestehen.';
  $('subscription-open').textContent=isGoogle?'Google Kalender am Computer öffnen':'Im iPhone-Kalender abonnieren';
  $('subscription-open').target=isGoogle?'_blank':'_self';
  $('subscription-open').rel='noopener noreferrer';
  if(lastMonth)$('subscription-status').textContent='Monat '+lastMonth+' gespeichert. '+(isGoogle?'Verbinde Google beim ersten Mal am Computer. Nutze dort dasselbe Konto wie auf deinem Handy.':'Tippe beim ersten Mal auf «Im iPhone-Kalender abonnieren» und bestätige dort.');
  $('subscribe-save').disabled=busy||!getTarget()||!canPublish()||!$('subscription-consent').checked||isDemo();
  $('subscribe-save').textContent=saved?.published?'Bestätigten Monat im Abo aktualisieren':'Kalender-Abo erstellen';
  $('subscription-links').hidden=!saved?.published;
  $('subscription-revoke').hidden=!saved;
  $('subscription-revoke').disabled=busy;
  if(saved?.published){const https=API+'/feed/'+saved.id+'/'+saved.read+'.ics';const links=calendarLinks(https,'https://andi201andi201.github.io/schichtkompass/');$('subscription-open').href=isGoogle?links.google:links.apple;$('subscription-url').value=https;}
 }
 $('subscription-consent').onchange=paint;
 async function send(method,body){const response=await fetch(API+'/api/calendar/'+saved.id,{method,headers:{Authorization:'Bearer '+saved.edit,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});if(!response.ok){let message='Kalenderdienst momentan nicht erreichbar. Bitte erneut versuchen.';try{message=(await response.json()).error||message}catch{}throw Error(message)}}
 $('subscribe-save').onclick=async()=>{
  if(busy||!getTarget()||!canPublish()||!$('subscription-consent').checked||isDemo())return;
  if(!getPerson().trim())return notify('Gib deinen Namen ein, damit Dienste verschiedener Personen nicht vermischt werden.','error');
  busy=true;paint();
  try{
   const person=await identity(getPerson());
   if(saved&&saved.identity!==person)throw Error('Dieses Abo gehört zu einem anderen Namen. Verwende den ursprünglichen Namen oder widerrufe das bisherige Abo zuerst.');
   const content=await getContent(),month=getMonth();
   if(!saved){saved={id:random(),edit:random(),read:random(),identity:person,published:false};}
   // Save keys before sending so a lost network response never loses management access.
   localStorage.setItem(KEY,JSON.stringify(saved));
   await send('PUT',{ics:content,month,readToken:saved.read});
   saved.published=true;localStorage.setItem(KEY,JSON.stringify(saved));
   lastMonth=month;
  }catch(e){notify(e.message,'error')}finally{busy=false;paint()}
 };
 $('subscription-revoke').onclick=async()=>{
  if(busy||!saved||!confirm('Abo-Link sperren und alle gespeicherten Termine auf dem Server löschen? Bereits geladene Termine können bis zum nächsten Kalenderabruf sichtbar bleiben.'))return;
  busy=true;paint();try{await send('DELETE');localStorage.removeItem(KEY);saved=null;lastMonth='';$('subscription-status').textContent='Abo widerrufen und Serverdaten gelöscht. Entferne den abonnierten Kalender auch in deiner Kalender-App.'}catch(e){notify(e.message,'error')}finally{busy=false;paint()}
 };
 $('subscription-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('subscription-url').value);notify('Privaten Abo-Link kopiert. Wer ihn besitzt, kann deine Termine lesen.','success')}catch{$('subscription-url').select();notify('Link markieren und kopieren.')}};
 $('google-share').onclick=async()=>{
  if(!saved?.published)return;
  const feed=API+'/feed/'+saved.id+'/'+saved.read+'.ics',link=calendarLinks(feed,'https://andi201andi201.github.io/schichtkompass/').setup;
  try{if(navigator.share){await navigator.share({title:'SchichtKompass in Google Kalender einrichten',text:'Diesen persönlichen Link am Computer öffnen. Er erlaubt das Lesen meiner Dienste.',url:link});$('google-share-status').textContent='Link übergeben. Öffne ihn am Computer.'}else{await navigator.clipboard.writeText(link);$('google-share-status').textContent='Einrichtungslink kopiert. Übertrage ihn auf deinen Computer.'}}
  catch(e){if(e.name!=='AbortError'){$('subscription-url').select();notify('Teilen nicht möglich. Kopiere deinen Kalender-Link unten und füge ihn am Computer in Google Kalender unter «Per URL» hinzu.')}}
 };
 $('subscription-backup').onclick=()=>{if(!saved)return;const blob=new Blob([JSON.stringify(saved)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SchichtKompass-Abo-Schluessel-VERTRAULICH.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
 $('subscription-restore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3000)throw Error('Datei ungültig');const data=JSON.parse(await file.text());if(![data.id,data.edit,data.read,data.identity].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))throw Error('Keine gültige Abo-Schlüsseldatei');if(saved&&saved.id!==data.id)throw Error('Widerrufe zuerst das bestehende Abo, bevor du ein anderes wiederherstellst.');localStorage.setItem(KEY,JSON.stringify(data));saved=data;paint();notify('Abo-Schlüssel wiederhergestellt.','success')}catch(e){notify(e.message,'error')}finally{e.target.value=''}};
 paint();return paint;
}
