import test from 'node:test';import assert from 'node:assert/strict';
import {makeICS} from '../dist/core.js';import {rewriteCalendar,plainStoredCalendar} from '../calendar-service/lib/calendar-display.mjs';
const base={year:2027,month:1,identity:'Fictional QA',entries:[{day:3,definition:{code:'FS',name:'Frühdienst Stroke',department:'Stroke Unit',type:'shift',start:'07:00',end:'16:06'}},{day:4,definition:{code:'B',name:'Büro',type:'shift',start:'08:00',end:'12:00'}}]};
const unfolded=ics=>ics.replace(/\r\n /g,'');const uids=ics=>[...ics.matchAll(/^UID:(.+)/gm)].map(m=>m[1]);const sequences=ics=>[...ics.matchAll(/^SEQUENCE:(\d+)/gm)].map(m=>Number(m[1]));
test('Old generated prefixes disappear on read with stable revisions and unchanged identities',async()=>{
 const raw=await makeICS(base),saved=rewriteCalendar(raw,{previous:'',now:new Date('2026-11-12T08:00:00Z')});
 const legacy=saved.replace('SUMMARY:Frühdienst','SUMMARY:☀️ Frühdienst').replace('SUMMARY:Büro','SUMMARY:💻 Büro');
 const plain=plainStoredCalendar(legacy);
 assert.match(unfolded(plain),/SUMMARY:Frühdienst Stroke · Stroke Unit/);assert.doesNotMatch(plain,/SUMMARY:☀️|SUMMARY:💻/);
 assert.deepEqual(uids(plain),uids(saved));assert.deepEqual(sequences(plain),[1,1]);
 assert.equal(plainStoredCalendar(legacy),plain);assert.equal(plainStoredCalendar(plain),plain);
 const changed=await makeICS({...base,entries:base.entries.map(e=>({...e,definition:{...e.definition,end:'17:00'}}))});
 const updated=rewriteCalendar(changed,{previous:plain,now:new Date('2026-11-13T12:00:00Z')});
 assert.deepEqual(sequences(updated),[2,2]);assert.match(updated,/DTEND;TZID=Europe\/Zurich:20270103T170000/);
});
test('Authored titles, special characters and folding remain intact',async()=>{
 const raw=await makeICS({...base,entries:[{day:2,definition:{code:'B',name:'🔔 Büro; A,B $& '+ 'Ä'.repeat(70),type:'shift',start:'08:00',end:'12:00'}}]});
 const plain=plainStoredCalendar(raw);assert.match(unfolded(plain),/SUMMARY:🔔 Büro\\; A\\,B \$&/);
 for(const line of plain.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const legacy='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:old\r\nSUMMARY:☀️ Frühdienst\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 assert.match(plainStoredCalendar(legacy),/SUMMARY:Frühdienst\r\n/);
});
