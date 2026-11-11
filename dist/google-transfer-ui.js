import {GOOGLE_CLIENT_ID} from './google-config.js';
import {GOOGLE_SCOPES,googleMonth,googleAPI,syncGoogleMonth} from './google-calendar.js';

export const googleConfigured=/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
let scriptPromise;
function loadGoogle(){
 if(globalThis.google?.accounts?.oauth2)return Promise.resolve(globalThis.google.accounts.oauth2);
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='no-referrer';
  const timer=setTimeout(()=>fail(),20000);
  const fail=()=>{clearTimeout(timer);script.remove();scriptPromise=null;reject(Error('Google konnte nicht geladen werden. Prüfe deine Internetverbindung und tippe erneut.'));};
  script.onload=()=>{clearTimeout(timer);const oauth=globalThis.google?.accounts?.oauth2;if(oauth)resolve(oauth);else fail();};script.onerror=fail;document.head.append(script);
 });return scriptPromise;
}
export function requestGoogleToken(oauth,clientId){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Die Google-Anmeldung wurde nicht abgeschlossen. Bitte erneut versuchen.')),180000);
  const fail=message=>{clearTimeout(timer);reject(Error(message));};
  try{
   const client=oauth.initTokenClient({client_id:clientId,scope:GOOGLE_SCOPES.join(' '),include_granted_scopes:false,
    callback:response=>{
     clearTimeout(timer);
     if(response.error||!response.access_token)return reject(Error('Keine Google-Freigabe erteilt. Es wurden keine Dienste übertragen.'));
     if(!oauth.hasGrantedAllScopes(response,...GOOGLE_SCOPES))return reject(Error('Bitte beide Berechtigungen erlauben: SchichtKompass-Kalender verwalten und die Kalenderliste lesen.'));
     resolve(response.access_token);
    },
    error_callback:e=>fail(e.type==='popup_failed_to_open'?'Öffne SchichtKompass direkt in Safari oder Chrome und erlaube das Google-Anmeldefenster.':'Google-Anmeldung abgebrochen. Es wurden keine Dienste übertragen.')});
   // Must remain in the original button gesture, before any await.
   client.requestAccessToken({prompt:'select_account'});
  }catch{fail('Google-Anmeldung konnte nicht gestartet werden. Bitte erneut versuchen.');}
 });
}
export function setupGoogleTransfer({getTarget,canPublish,isDemo,getSnapshot,notify,configured=googleConfigured,clientId=GOOGLE_CLIENT_ID,load=loadGoogle,apiFactory=googleAPI}){
 const $=id=>document.getElementById(id);let busy=false,loading=false,oauth=null;
 const status=message=>{$('google-direct-status').textContent=message;};
 function paint(){
  const selected=getTarget()==='google';$('google-direct-panel').hidden=!selected;
  $('google-direct-unavailable').hidden=configured;
  $('google-direct-consent-label').hidden=!configured;
  $('google-direct-save').hidden=!configured;
  $('google-direct-save').disabled=busy||loading||!canPublish()||isDemo()||!$('google-direct-consent').checked;
  $('google-direct-save').textContent=busy?'Dienste werden übertragen …':loading?'Google wird vorbereitet …':oauth?'In Google Kalender übertragen':'Google-Verbindung laden';
  $('google-direct-consent').disabled=busy;
  if(selected&&configured&&!oauth&&!loading)prepare();
 }
 async function prepare(){
  loading=true;$('google-direct-save').disabled=true;
  try{oauth=await load();status('Bereit. Beim Übertragen wählst du dein Google-Konto.');}
  catch(e){status(e.message);}
  finally{loading=false; // Do not automatically retry a failed external script.
   $('google-direct-save').disabled=busy||!canPublish()||isDemo()||!$('google-direct-consent').checked;
   $('google-direct-save').textContent=oauth?'In Google Kalender übertragen':'Google-Verbindung erneut laden';
  }
 }
 $('google-direct-consent').onchange=paint;
 $('google-direct-save').onclick=async()=>{
  if(busy||loading||!configured||getTarget()!=='google'||!canPublish()||isDemo()||!$('google-direct-consent').checked)return;
  if(!oauth){await prepare();return;}
  const snapshot=structuredClone(getSnapshot());
  if(!snapshot.identity?.trim())return notify('Gib deinen Namen ein, damit die richtigen Dienste aktualisiert werden.','error');
  busy=true;$('google-direct-open').hidden=true;status('Wähle dein Google-Konto und bestätige den Zugriff.');
  const authorization=requestGoogleToken(oauth,clientId);paint();
  let token;
  try{
   token=await authorization;
   const plan=await googleMonth(snapshot),api=apiFactory(token);
   const sync=()=>syncGoogleMonth(plan,api,status);
   const result=globalThis.navigator?.locks?await navigator.locks.request('schichtkompass-google-sync',sync):await sync();
   status(plan.month+': '+result.count+' Termine in Google gespeichert.'+(result.removed?' '+result.removed+' überholte Einträge entfernt.':'')+' Öffne deine Google-Kalender-App und aktiviere «SchichtKompass», falls er noch ausgeblendet ist.');
   $('google-direct-open').hidden=false;
  }catch(e){status(e.message+' Falls die Übertragung bereits begonnen hatte, können einzelne Termine gespeichert sein. Erneutes Übertragen gleicht den Monat ab.');notify('Google-Übertragung nicht abgeschlossen. Beachte den Hinweis beim Google-Button.','error');}
  finally{token=null;busy=false;paint();}
 };
 paint();return paint;
}
