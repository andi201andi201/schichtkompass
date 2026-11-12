import {calendarLinks} from './calendar-choice.js';
const API='https://schichtkompass-calendar.andi201andi201.chatgpt.site';
const KEY='schichtkompass-subscription-v1',SPLIT_KEY='schichtkompass-separate-duties-v1';
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function identity(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.trim().toLowerCase().replace(/\s+/g,' ')))),b=>b.toString(16).padStart(2,'0')).join('')}
const validServices=values=>Array.isArray(values)?values.filter(s=>s&&/^(frueh|spaet|nacht|sonstiges)$/.test(s.id)&&typeof s.label==='string'&&s.label.length<=600&&Number.isInteger(s.count)&&s.count>=0).map(s=>({id:s.id,label:s.label,count:s.count})):[];
export function setupSubscription({canPublish,getContent,getMonth,getPerson,isDemo,notify,getServices=()=>[],getTarget=()=>'iphone',getPageBase=()=>new URL('./',location.href).href}){
 const $=id=>document.getElementById(id);let busy=false,saved,catalog=[],catalogLoaded=false,catalogLoading=false,catalogRequest=0;
 try{saved=JSON.parse(localStorage.getItem(KEY)||'null');$('subscription-split').checked=localStorage.getItem(SPLIT_KEY)==='true'}catch{}
 if(saved&&![saved.id,saved.edit,saved.read,saved.identity].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))saved=null;
 let lastMonth='';
 const google=()=>['google','timetree-android'].includes(getTarget());
 const feed=(service='')=>API+'/feed/'+saved.id+'/'+saved.read+'.ics'+(service?'?gruppe='+encodeURIComponent(service):'');
 function renderServices(){
  const split=$('subscription-split').checked,isGoogle=google();
  $('subscription-service-mode').hidden=!split;
  $('subscription-combined-links').hidden=split;
  if(!split)return;
  $('subscription-colour-help').textContent=isGoogle?'Jeden gewünschten Dienst separat in Google Kalender hinzufügen. Wähle danach für jeden Kalender eine Farbe. Für das erste Hinzufügen eines Abos benötigt Google einen Computer.':'Tippe bei jedem gewünschten Dienst auf «Abonnieren». Wähle danach in der iPhone-Kalender-App unter «Kalender» → ⓘ neben dem jeweiligen Dienst eine Farbe.';
  const services=catalogLoaded?catalog:validServices(getServices());
  $('subscription-service-status').textContent=catalogLoading?'Gespeicherte Dienstarten werden geladen …':!saved?.published?'Erstelle zuerst das Abo. Danach kannst du die gewünschten Dienste einzeln abonnieren.':!services.length?'Für diesen Kalender sind noch keine Termine gespeichert.':'Vier Kalender: Frühdienst, Spätdienst, Nachtdienst und Sonstiges. Genaue Dienstnamen und Abteilungen bleiben in den Terminen erhalten.';
  $('subscription-service-list').replaceChildren();
  for(const service of services){
   const card=document.createElement('article');card.className='service-subscription';
   const info=document.createElement('div'),name=document.createElement('strong'),count=document.createElement('small');
   name.textContent=service.label;count.textContent=service.count+' '+(service.count===1?'Termin':'Termine')+(catalogLoaded?' im Abo':' in diesem Monat');info.append(name,count);card.append(info);
   if(saved?.published&&catalogLoaded){
    const actions=document.createElement('div');actions.className='service-actions';
    const link=document.createElement('a'),copy=document.createElement('button'),url=feed(service.id),links=calendarLinks(url,getPageBase());
    link.className='primary';link.textContent=isGoogle?'In Google hinzufügen':'Abonnieren';link.href=isGoogle?links.google:links.apple;link.target=isGoogle?'_blank':'_self';link.rel='noopener noreferrer';link.setAttribute('aria-label',service.label+' abonnieren');
    copy.className='text-button';copy.textContent='Link kopieren';copy.setAttribute('aria-label','Abo-Link für '+service.label+' kopieren');copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);notify('Abo-Link für '+service.label+' kopiert. Wer den Link besitzt, kann deine gespeicherten Termine lesen.','success')}catch{const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Abo-Link für '+service.label);actions.append(input);input.select();notify('Link markieren und kopieren.')}};
    actions.append(link,copy);card.append(actions);
   }
   $('subscription-service-list').append(card);
  }
 }
 function paint(){
  const isGoogle=google(),split=$('subscription-split').checked;
  $('subscription-panel').hidden=!getTarget();
  $('subscription-heading').textContent=isGoogle?'Deine Dienste in Google Kalender':'Deine Dienste im iPhone-Kalender';
  $('subscription-intro').textContent='Einmal verbinden. Danach hier jeden neuen oder korrigierten Monat speichern. Derselbe Monat wird ersetzt; andere Monate bleiben erhalten.';
  $('google-device-note').hidden=!isGoogle;
  $('google-subscribe-help').hidden=!isGoogle||split;
  $('subscription-provider-note').textContent=(isGoogle?'Google':'Apple')+' bestimmt, wann Änderungen abgerufen werden. Bereits manuell importierte Termine bleiben bestehen.';
  $('subscription-open').textContent=isGoogle?'Google Kalender am Computer öffnen':'Im iPhone-Kalender abonnieren';
  $('subscription-open').target=isGoogle?'_blank':'_self';
  $('subscription-open').rel='noopener noreferrer';
  if(lastMonth)$('subscription-status').textContent='Monat '+lastMonth+' gespeichert. '+(split?'Abonniere die gewünschten Dienstgruppen in der Liste einzeln.':isGoogle?'Verbinde Google beim ersten Mal am Computer. Nutze dort dasselbe Konto wie auf deinem Handy.':'Tippe beim ersten Mal auf «Im iPhone-Kalender abonnieren» und bestätige dort.');
  $('subscribe-save').disabled=busy||!getTarget()||!canPublish()||!$('subscription-consent').checked||isDemo();
  $('subscribe-save').textContent=saved?.published?'Bestätigten Monat im Abo aktualisieren':'Kalender-Abo erstellen';
  $('subscription-links').hidden=!saved?.published;
  $('subscription-revoke').hidden=!saved;
  $('subscription-revoke').disabled=busy;
  if(saved?.published){const https=feed(),links=calendarLinks(https,getPageBase());$('subscription-open').href=isGoogle?links.google:links.apple;$('subscription-url').value=https;}
  renderServices();
  if(split&&!busy&&saved?.published&&!catalogLoaded&&!catalogLoading)void loadCatalog();
 }
 $('subscription-consent').onchange=paint;
 $('subscription-split').onchange=()=>{try{localStorage.setItem(SPLIT_KEY,String($('subscription-split').checked))}catch{}paint()};
 async function send(method,body){const response=await fetch(API+'/api/calendar/'+saved.id,{method,headers:{Authorization:'Bearer '+saved.edit,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});if(!response.ok){let message='Kalenderdienst momentan nicht erreichbar. Bitte erneut versuchen.';try{message=(await response.json()).error||message}catch{}throw Error(message)}return response.json()}
 async function loadCatalog(){
  const request=++catalogRequest;catalogLoading=true;renderServices();
  try{const result=await send('GET');if(request===catalogRequest)catalog=validServices(result.groups)}catch(e){if(request===catalogRequest)notify(e.message+' Die Einzel-Abos konnten nicht geladen werden.','error')}
  finally{if(request===catalogRequest){catalogLoading=false;catalogLoaded=true;paint()}}
 }
 $('subscribe-save').onclick=async()=>{
  if(busy||!getTarget()||!canPublish()||!$('subscription-consent').checked||isDemo())return;
  if(!getPerson().trim())return notify('Gib deinen Namen ein, damit Dienste verschiedener Personen nicht vermischt werden.','error');
  busy=true;catalogRequest++;catalogLoading=false;paint();
  try{
   const person=await identity(getPerson());
   if(saved&&saved.identity!==person)throw Error('Dieses Abo gehört zu einem anderen Namen. Verwende den ursprünglichen Namen oder widerrufe das bisherige Abo zuerst.');
   const content=await getContent(),month=getMonth();
   if(!saved){saved={id:random(),edit:random(),read:random(),identity:person,published:false};}
   // Save keys before sending so a lost network response never loses management access.
   localStorage.setItem(KEY,JSON.stringify(saved));
   const result=await send('PUT',{ics:content,month,readToken:saved.read});
   saved.published=true;localStorage.setItem(KEY,JSON.stringify(saved));
   catalog=validServices(result.groups);catalogLoaded=true;lastMonth=month;
  }catch(e){notify(e.message,'error')}finally{busy=false;paint()}
 };
 $('subscription-revoke').onclick=async()=>{
  if(busy||!saved||!confirm('Alle Abo-Links sperren und alle gespeicherten Termine auf dem Server löschen? Bereits geladene Termine können bis zum nächsten Kalenderabruf sichtbar bleiben.'))return;
  busy=true;catalogRequest++;catalogLoading=false;paint();try{await send('DELETE');localStorage.removeItem(KEY);saved=null;catalog=[];catalogLoaded=false;lastMonth='';$('subscription-status').textContent='Gesamtabo und Einzel-Abos widerrufen, Serverdaten gelöscht. Entferne die abonnierten Kalender auch in deiner Kalender-App.'}catch(e){notify(e.message,'error')}finally{busy=false;paint()}
 };
 $('subscription-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('subscription-url').value);notify('Privaten Abo-Link kopiert. Wer ihn besitzt, kann deine Termine lesen.','success')}catch{$('subscription-url').select();notify('Link markieren und kopieren.')}};
 $('google-share').onclick=async()=>{
  if(!saved?.published)return;
  const link=calendarLinks(feed(),getPageBase()).setup;
  try{if(navigator.share){await navigator.share({title:'SchichtKompass in Google Kalender einrichten',text:'Diesen persönlichen Link am Computer öffnen. Er erlaubt das Lesen meiner Dienste.',url:link});$('google-share-status').textContent='Link übergeben. Öffne ihn am Computer.'}else{await navigator.clipboard.writeText(link);$('google-share-status').textContent='Einrichtungslink kopiert. Übertrage ihn auf deinen Computer.'}}
  catch(e){if(e.name!=='AbortError'){$('subscription-url').select();notify('Teilen nicht möglich. Kopiere deinen Kalender-Link unten und füge ihn am Computer in Google Kalender unter «Per URL» hinzu.')}}
 };
 $('subscription-backup').onclick=()=>{if(!saved)return;const blob=new Blob([JSON.stringify(saved)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SchichtKompass-Abo-Schluessel-VERTRAULICH.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
 $('subscription-restore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3000)throw Error('Datei ungültig');const data=JSON.parse(await file.text());if(![data.id,data.edit,data.read,data.identity].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))throw Error('Keine gültige Abo-Schlüsseldatei');if(saved&&saved.id!==data.id)throw Error('Widerrufe zuerst das bestehende Abo, bevor du ein anderes wiederherstellst.');localStorage.setItem(KEY,JSON.stringify(data));saved=data;catalogRequest++;catalogLoading=false;catalog=[];catalogLoaded=false;paint();notify('Abo-Schlüssel wiederhergestellt.','success')}catch(e){notify(e.message,'error')}finally{e.target.value=''}};
 paint();return paint;
}
