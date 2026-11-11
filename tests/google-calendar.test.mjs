import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleMonth,syncGoogleMonth,googleAPI,GOOGLE_SCOPES} from '../dist/google-calendar.js';
import {requestGoogleToken,setupGoogleTransfer} from '../dist/google-transfer-ui.js';
const shift={code:'N',name:'Nachtdienst',type:'shift',start:'22:00',end:'07:00'};
const skip={code:'Frei',name:'Frei',type:'skip'};
const input=(overrides={})=>({year:2026,month:12,identity:'Alex Test',entries:Array.from({length:31},(_,i)=>({day:i+1,definition:i===30?{...shift}:{...skip}})),...overrides});
function fakeGoogle(){
 const state={calendars:[],events:new Map(),calls:[],failWrite:false,loseInsert:false,tombstones:new Set()};
 state.api=async(path,method='GET',body,etag)=>{
  state.calls.push({path,method,body,etag});const url=new URL('https://google.test'+path);
  const error=status=>{throw Object.assign(Error('Testfehler'),{status});};
  if(url.pathname==='/users/me/calendarList')return {items:state.calendars};
  if(path==='/calendars'&&method==='POST'){const calendar={...body,id:'owned-calendar',accessRole:'owner'};state.calendars.push(calendar);return calendar;}
  if(method==='GET'&&url.pathname.endsWith('/events'))return {items:[...state.events.values()]};
  const id=url.pathname.split('/').at(-1);
  if(method==='GET'){if(state.tombstones.has(id))return {id,status:'cancelled'};if(!state.events.has(id))error(404);return state.events.get(id);}
  if(state.failWrite&&method==='PATCH')error(503);
  if(method==='POST'){
   if(state.events.has(body.id)||state.tombstones.has(body.id))error(409);
   state.events.set(body.id,{...structuredClone(body),etag:'version1'});
   if(state.loseInsert){state.loseInsert=false;throw Error('Lost network response');}
   return body;
  }
  if(method==='PATCH'){state.events.set(id,{...state.events.get(id),...structuredClone(body),etag:'version2'});return state.events.get(id);}
  if(method==='DELETE'){state.events.delete(id);state.tombstones.add(id);return null;}
  throw Error('Unexpected call '+path);
 };return state;
}
test('Google month preserves Zurich overnight, all-day dates, department and reminder; blanks stay free',async()=>{
 const source=input();source.entries[0]={day:1,note:'ZusA',definition:{code:'A',name:'Fortbildung',type:'allday',department:'Stroke Unit'}};
 const plan=await googleMonth({...source,location:'Spital',reminder:'30'});
 assert.equal(plan.events.length,2);
 assert.deepEqual(plan.events[0].start,{date:'2026-12-01'});assert.deepEqual(plan.events[0].end,{date:'2026-12-02'});
 assert.match(plan.events[0].location,/Stroke Unit/);assert.match(plan.events[0].description,/ZusA/);
 assert.deepEqual(plan.events[1].end,{dateTime:'2027-01-01T07:00:00',timeZone:'Europe/Zurich'});
 assert.equal(plan.events[1].reminders.overrides[0].minutes,30);assert.deepEqual(plan.events[0].reminders.overrides,[]);
 assert.ok(!JSON.stringify(plan).includes('Alex'));assert.equal(plan.events[1].visibility,'private');
 const march=input({month:3});const dst=await googleMonth(march);assert.equal(dst.events[0].start.timeZone,'Europe/Zurich');
});
test('Incomplete, duplicate-day, invalid-time and unnamed months cannot reach synchronization',async()=>{
 await assert.rejects(googleMonth(input({identity:''})),/Name/);
 const short=input();short.entries.pop();await assert.rejects(googleMonth(short),/vollständigen/);
 const duplicate=input();duplicate.entries[1].day=1;await assert.rejects(googleMonth(duplicate),/vollständigen/);
 const invalid=input();invalid.entries[30].definition.start='25:00';await assert.rejects(googleMonth(invalid),/vollständigen/);
});
test('Repeated month and changed times update the same event and rediscover calendar across devices',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);await syncGoogleMonth(plan,g.api);
 assert.equal(g.calendars.length,1);assert.equal(g.events.size,1);
 const changed=input();changed.entries[30].definition.start='21:30';await syncGoogleMonth(await googleMonth(changed),g.api);
 assert.equal(g.events.size,1);assert.equal([...g.events.values()][0].start.dateTime,'2026-12-31T21:30:00');
 assert.ok(g.calls.find(c=>c.method==='PATCH').etag);
});
test('A lost POST response and retry do not create another calendar or event',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());g.loseInsert=true;await assert.rejects(syncGoogleMonth(plan,g.api));
 assert.equal(g.events.size,1);await syncGoogleMonth(plan,g.api);assert.equal(g.events.size,1);assert.equal(g.calendars.length,1);
});
test('Free month removes only managed events for that person and month, including duplicate managed entries',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);
 const event=[...g.events.values()][0];g.events.set('duplicate',{...structuredClone(event),id:'duplicate'});
 g.events.set('manual',{id:'manual',summary:'Private appointment'});
 g.events.set('other-month',{...structuredClone(event),id:'other-month',extendedProperties:{private:{...event.extendedProperties.private,skMonth:'2026-11'}}});
 g.events.set('other-person',{...structuredClone(event),id:'other-person',extendedProperties:{private:{...event.extendedProperties.private,skPerson:'someone-else'}}});
 const free=input();free.entries.forEach(e=>e.definition={...skip});const result=await syncGoogleMonth(await googleMonth(free),g.api);
 assert.equal(result.removed,2);assert.deepEqual([...g.events.keys()],['manual','other-month','other-person']);
});
test('Free day becoming a shift again uses a new stable ID after Google tombstone',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);const original=[...g.events.keys()][0];
 const free=input();free.entries.forEach(e=>e.definition={...skip});await syncGoogleMonth(await googleMonth(free),g.api);
 await syncGoogleMonth(plan,g.api);assert.equal(g.events.size,1);assert.notEqual([...g.events.keys()][0],original);
 await syncGoogleMonth(plan,g.api);assert.equal(g.events.size,1);
});
test('An unsuccessful upsert never starts removal of obsolete days',async()=>{
 const g=fakeGoogle(),source=input();source.entries[0].definition={...shift};await syncGoogleMonth(await googleMonth(source),g.api);
 g.failWrite=true;g.calls=[];await assert.rejects(syncGoogleMonth(await googleMonth(input()),g.api));assert.ok(!g.calls.some(c=>c.method==='DELETE'));assert.equal(g.events.size,2);
});
test('No empty calendar is created for a first all-free month; ambiguous existing calendars are not modified',async()=>{
 const g=fakeGoogle(),source=input();source.entries.forEach(e=>e.definition={...skip});await syncGoogleMonth(await googleMonth(source),g.api);assert.equal(g.calendars.length,0);
 const plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);g.calendars.push({...g.calendars[0],id:'duplicate-calendar'});g.calls=[];
 await assert.rejects(syncGoogleMonth(plan,g.api),/Mehrere/);assert.ok(g.calls.every(c=>c.method==='GET'));
});
test('Pagination retrieves all calendars and events before writing',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);let pages=0;
 const api=async(path,...args)=>{
  if(path.includes('calendarList')&&!path.includes('pageToken'))return {items:[],nextPageToken:'next'};
  if(path.includes('/events?')&&!args[0]&&!path.includes('pageToken'))return {items:[],nextPageToken:'next'};
  if(path.includes('pageToken'))pages++;
  return g.api(path,...args);
 };
 await syncGoogleMonth(plan,api);assert.equal(pages,2);assert.equal(g.events.size,1);
});
test('Conflict after stale list verifies ownership rather than overwriting unrelated events',async()=>{
 const g=fakeGoogle(),plan=await googleMonth(input());await syncGoogleMonth(plan,g.api);
 const stale=async(path,...args)=>path.includes('/events?')&&!args[0]?{items:[]}:g.api(path,...args);
 await syncGoogleMonth(plan,stale);assert.equal(g.events.size,1);
 [...g.events.values()][0].extendedProperties={private:{skApp:'different-app'}};
 await assert.rejects(syncGoogleMonth(plan,stale),/fremder/);
});
test('Google requests send token only as header; forbidden and expired sessions are actionable',async()=>{
 let request;const api=googleAPI('test-token',async(url,options)=>{request={url,options};return new Response('',{status:401})});
 await assert.rejects(api('/calendars'),/abgelaufen/);assert.equal(request.options.headers.Authorization,'Bearer test-token');assert.ok(!request.url.includes('test-token'));assert.equal(request.options.credentials,'omit');
});
test('OAuth opens in original gesture, checks both scopes and handles popup cancellation',async()=>{
 let config,opened=false;const oauth={initTokenClient:c=>{config=c;return {requestAccessToken:()=>{opened=true;c.callback({access_token:'test-token'})}}},hasGrantedAllScopes:(_r,...s)=>s.length===2};
 const promise=requestGoogleToken(oauth,'test');assert.ok(opened);assert.equal(await promise,'test-token');assert.equal(config.include_granted_scopes,false);assert.equal(config.scope,GOOGLE_SCOPES.join(' '));
 oauth.hasGrantedAllScopes=()=>false;await assert.rejects(requestGoogleToken(oauth,'test'),/beide Berechtigungen/);
 oauth.initTokenClient=c=>({requestAccessToken:()=>c.error_callback({type:'popup_closed'})});await assert.rejects(requestGoogleToken(oauth,'test'),/abgebrochen/);
});
test('Google UI blocks writes without review or consent, in demo and while unconfigured',async()=>{
 const nodes=new Map();global.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{checked:false,hidden:false,textContent:''});return nodes.get(id)}};
 const $=id=>document.getElementById(id);let calls=0,allowed=false,demo=false;
 const oauth={initTokenClient:()=>{calls++;return {requestAccessToken(){}}}};
 const paint=setupGoogleTransfer({getTarget:()=>'google',canPublish:()=>allowed,isDemo:()=>demo,getSnapshot:()=>input(),notify(){},configured:true,load:async()=>oauth});
 await new Promise(r=>setImmediate(r));await $('google-direct-save').onclick();assert.equal(calls,0);
 allowed=true;paint();await $('google-direct-save').onclick();assert.equal(calls,0);
 $('google-direct-consent').checked=true;demo=true;paint();await $('google-direct-save').onclick();assert.equal(calls,0);
 setupGoogleTransfer({getTarget:()=>'google',canPublish:()=>true,isDemo:()=>false,getSnapshot:()=>input(),notify(){},configured:false,load:async()=>oauth});
 await $('google-direct-save').onclick();assert.equal(calls,0);assert.equal($('google-direct-unavailable').hidden,false);
});
test('Google UI completes an authorized transfer with a frozen reviewed snapshot and recovers after failure',async()=>{
 const nodes=new Map();global.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{checked:false,hidden:false,textContent:''});return nodes.get(id)}};
 const $=id=>document.getElementById(id),g=fakeGoogle();let authorizations=0;const source=input();
 const oauth={initTokenClient:c=>({requestAccessToken:()=>{authorizations++;c.callback({access_token:'transient-token'})}}),hasGrantedAllScopes:()=>true};
 const paint=setupGoogleTransfer({getTarget:()=>'google',canPublish:()=>true,isDemo:()=>false,getSnapshot:()=>source,notify(){},configured:true,clientId:'test',load:async()=>oauth,apiFactory:token=>{assert.equal(token,'transient-token');return g.api;}});
 await new Promise(r=>setImmediate(r));$('google-direct-consent').checked=true;paint();
 const transfer=$('google-direct-save').onclick();source.entries[30].definition.start='21:00';await transfer;
 assert.equal(authorizations,1);assert.equal([...g.events.values()][0].start.dateTime,'2026-12-31T22:00:00');
 assert.match($('google-direct-status').textContent,/1 Termine in Google gespeichert/);assert.equal($('google-direct-open').hidden,false);
 g.failWrite=true;await $('google-direct-save').onclick();assert.match($('google-direct-status').textContent,/Erneutes Übertragen/);assert.equal($('google-direct-open').hidden,true);assert.equal($('google-direct-save').disabled,false);
 g.failWrite=false;await $('google-direct-save').onclick();assert.equal(g.events.size,1);assert.match($('google-direct-status').textContent,/gespeichert/);
});
