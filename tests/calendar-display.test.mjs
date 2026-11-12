import test from 'node:test';import assert from 'node:assert/strict';
import {makeICS} from '../dist/core.js';import {rewriteCalendar} from '../calendar-service/lib/calendar-display.mjs';
const base={year:2027,month:1,identity:'Fictional QA',entries:[{day:3,definition:{code:'FS',name:'Frühdienst Stroke',department:'Stroke Unit',type:'shift',start:'07:00',end:'16:06'}},{day:4,definition:{code:'B',name:'Büro',type:'shift',start:'08:00',end:'12:00'}}]};
const unfolded=ics=>ics.replace(/\r\n /g,'');const uids=ics=>[...ics.matchAll(/^UID:(.+)/gm)].map(m=>m[1]);const sequences=ics=>[...ics.matchAll(/^SEQUENCE:(\d+)/gm)].map(m=>Number(m[1]));
test('Existing events gain and lose emojis without a roster upload; revisions increase and repeat requests are idempotent',async()=>{
 const raw=await makeICS({...base,emojis:false});const plain=rewriteCalendar(raw,{previous:'',now:new Date('2026-11-12T08:00:00Z')});
 const icons=rewriteCalendar(plain,{emojis:true,now:new Date('2026-11-12T09:00:00Z')});assert.match(unfolded(icons),/SUMMARY:☀️ Frühdienst Stroke · Stroke Unit/);assert.match(icons,/SUMMARY:💻 Büro/);assert.deepEqual(uids(icons),uids(plain));assert.deepEqual(sequences(icons),[1,1]);assert.match(icons,/LAST-MODIFIED:20261112T090000Z/);
 assert.equal(rewriteCalendar(icons,{emojis:true,now:new Date('2026-11-12T10:00:00Z')}),icons);
 const removed=rewriteCalendar(icons,{emojis:false,now:new Date('2026-11-12T11:00:00Z')});assert.match(removed,/SUMMARY:Büro/);assert.doesNotMatch(removed,/SUMMARY:💻/);assert.deepEqual(sequences(removed),[2,2]);assert.deepEqual(uids(removed),uids(raw));
 const upload=await makeICS({...base,emojis:true,entries:base.entries.map(e=>({...e,definition:{...e.definition,end:'17:00'}}))});const updated=rewriteCalendar(upload,{previous:icons,emojis:true,now:new Date('2026-11-12T12:00:00Z')});assert.deepEqual(sequences(updated),[2,2]);assert.match(updated,/DTEND;TZID=Europe\/Zurich:20270103T170000/);
});
test('Titles and special Unicode remain intact; old app emojis are not duplicated',async()=>{
 const raw=await makeICS({...base,entries:[{day:2,definition:{code:'B',name:'🔔 Büro; A,B $& '+ 'Ä'.repeat(70),type:'shift',start:'08:00',end:'12:00'}}]});
 const withIcons=rewriteCalendar(raw,{emojis:true});assert.match(unfolded(withIcons),/SUMMARY:🔔 Büro\\; A\\,B \$&/);assert.doesNotMatch(withIcons,/SUMMARY:💻 🔔/);
 assert.match(unfolded(rewriteCalendar(withIcons,{emojis:false})),/SUMMARY:🔔 Büro/);
 for(const line of withIcons.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const legacy=raw.replace(/^X-SCHICHTKOMPASS-ORIGINAL-TITLE:[^\r]*(?:\r\n [^\r]*)*\r\n/gm,'').replace(/SUMMARY:🔔 Büro[^\r]+(?:\r\n [^\r]*)*/,'SUMMARY:☀️ Frühdienst');assert.match(rewriteCalendar(legacy,{emojis:true}),/SUMMARY:☀️ Frühdienst/);assert.doesNotMatch(rewriteCalendar(legacy,{emojis:true}),/☀️ ☀️/);
});
