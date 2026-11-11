import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialZGKSSettings,recognizeZGKS,annotateZGKS,zgksDefinition} from '../dist/zgks-legend.js';
import {groupSymbols,validateDefinition,makeICS} from '../dist/core.js';
const registry=JSON.parse(readFileSync(new URL('../dist/zgks-legend-data.json',import.meta.url)));
const ref=id=>registry.symbols.find(r=>r.id===String(id));
const symbol=(id,extra={})=>({...ref(id),...extra});
const group=(id,extra={})=>annotateZGKS(symbol(id,extra),registry);
const definition=(id,options={},extra={},profiles=[])=>zgksDefinition(group(id,extra),profiles,registry,{year:2027,month:1,...options});

test('ZGKS is selected by default and a remembered opt-out is respected',()=>{
 assert.deepEqual(initialZGKSSettings(null),{enabled:true});
 assert.deepEqual(initialZGKSSettings({enabled:false,timesConfirmed:true}),{enabled:false});
 assert.deepEqual(initialZGKSSettings({enabled:'false',timesConfirmed:'true'}),{enabled:true});
});
test('Official legend contains all 54 individually identified icons with source dates and valid definitions',()=>{
 assert.equal(registry.symbols.length,54);assert.equal(new Set(registry.symbols.map(r=>r.id)).size,54);
 assert.equal(registry.symbols.filter(r=>r.kind==='presence').length,18);
 assert.equal(registry.symbols.filter(r=>r.kind==='absence').length,36);
 for(const r of registry.symbols){assert.equal(r.feature.length,1200);assert.equal(validateDefinition(r),true,r.id);assert.ok(r.thumb.startsWith('data:image/png;base64,'));}
 assert.equal(registry.source.presence.department,'Chirurgie Nord');assert.equal(ref(9510).validFrom,'2026-10-01');
});
test('All extracted icons resolve individually; mild brightness variation never changes their identity',()=>{
 for(const r of registry.symbols){
  assert.equal(recognizeZGKS(r.feature,registry)?.id,r.id,r.id);
  const shifted=r.feature.map(n=>Math.max(0,Math.min(255,n+8)));
  assert.equal(recognizeZGKS(shifted,registry)?.id,r.id,'Brightness '+r.id);
 }
 assert.equal(recognizeZGKS(Array(1200).fill(80),registry),null);
});
test('Colour and underline variants keep distinct identities despite identical printed letters',()=>{
 for(const id of [146,2146,1146,9610,2650,9650,3434,9620,9530,9531,9550,9551])assert.equal(recognizeZGKS(ref(id).feature,registry)?.id,String(id));
 const result=groupSymbols([group(146,{day:1}),group(2146,{day:2}),group(1146,{day:3}),group(146,{day:4})]);
 assert.equal(result.groups.length,3);assert.deepEqual(result.groups[0].days,[1,4]);
 assert.notEqual(group(2650).serviceKey,group(9650).serviceKey);
});
test('Documented presence times are used instead of credited hours',()=>{
 const expected={2:['07:00','16:06'],182:['07:00','16:06'],198:['06:45','15:51'],3434:['10:00','19:06'],2650:['13:54','23:00'],2671:['12:54','22:00'],1470:['22:10','07:11'],146:['07:00','16:06'],2146:['13:54','23:00'],1146:['22:10','07:11'],4562:['08:00','16:54'],4714:['14:45','17:00']};
 for(const [id,times]of Object.entries(expected)){const d=definition(id).definition;assert.equal(d.type,'shift');assert.deepEqual([d.start,d.end],times);}
});
test('Official PEP times apply without confirmation but never before January 2027',()=>{
 assert.equal(definition(182).definition.type,'shift');
 assert.equal(definition(182,{timesConfirmed:false}).definition.type,'shift');
 const old=definition(182,{year:2026,month:12});assert.equal(validateDefinition(old.definition),false);assert.equal(old.definition.start,'');assert.match(old.reason,/2027/);
});
test('Absences use all-day dates, never credit hours as clock times, and respect October 2026 start',()=>{
 for(const r of registry.symbols.filter(r=>r.kind==='absence'&&r.type!=='skip')){
  const d=definition(r.id,{year:2026,month:10,timesConfirmed:false}).definition;assert.equal(d.type,'allday');assert.equal(d.start,'');assert.equal(d.end,'');
 }
 assert.equal(definition(9510,{year:2026,month:9}).definition.type,'');
});
test('Free, Wunschfrei, compensation and the blank red placeholder produce no calendar entry',async()=>{
 for(const id of [1000,9500,9501,9502])assert.equal(group(id).serviceKey,'free');
 const ics=await makeICS({year:2027,month:1,entries:[1000,9500,9501,9502].map((id,i)=>({day:i+1,definition:ref(id)}))});
 assert.ok(!ics.includes('BEGIN:VEVENT'));
});
test('Legacy code-only registrations cannot override different official E/S icons',()=>{
 const saved={...ref(146),contextKey:'home',definition:{code:'E',name:'Wrong old E',type:'shift',start:'10:00',end:'11:00'}};
 const result=definition(2146,{}, {},[saved]);assert.equal(result.definition.start,'13:54');assert.notEqual(result.definition.name,'Wrong old E');
});
test('Custom times are scoped by official icon, context and effective period',()=>{
 const p={...ref(182),zgksId:'182',zgksPeriod:'from:2027-01-01',contextKey:'home',definition:{code:'F',name:'Mein Frühdienst',type:'shift',start:'06:30',end:'15:30'}};
 assert.equal(definition(182,{}, {},[p]).definition.start,'06:30');
 assert.equal(definition(182,{year:2026,month:12},{},[p]).definition.type,'');
 assert.equal(definition(211,{}, {},[p]).definition.start,'07:00');
 assert.equal(definition(182,{},{note:'StU'},[p]).definition.type,'');
});
test('Known units and additional flags require separate confirmation the first time',()=>{
 for(const extra of [{note:'StU'},{note:'ZusA'},{note:'DIV'},{note:'MN'}, {otherDepartment:true}]){
  const result=definition(182,{},extra);assert.equal(result.definition.type,'');assert.match(result.reason,/Abteilung oder Zusatz/);
 }
 const d=definition(182,{}, {note:'StU'}).definition;assert.equal(d.department,'Stroke Unit');assert.equal(d.start,'07:00');
});
test('Automatic legend output exports the documented night shift and an all-day absence',async()=>{
 const entries=[{...group(1470),day:31,definition:definition(1470).definition},{...group(9510),day:1,definition:definition(9510).definition}];
 const ics=await makeICS({year:2027,month:1,entries,identity:'Fiktiver Name'});
 assert.match(ics,/DTSTART;TZID=Europe\/Zurich:20270131T221000/);
 assert.match(ics,/DTEND;TZID=Europe\/Zurich:20270201T071100/);
 assert.match(ics,/DTSTART;VALUE=DATE:20270101/);assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
});
