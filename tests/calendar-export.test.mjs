import test from 'node:test';
import assert from 'node:assert/strict';
import {makeICS} from '../dist/core.js';
import {serviceForEntry} from '../dist/legacy-duty-tags.js';
const entry={day:2,definition:{code:'FS',name:'Frühdienst Stroke',type:'shift',start:'07:00',end:'16:06',department:'Stroke Unit'},zgksId:'182',note:'ZusA'};
test('Export always uses original titles, including when an older caller still sends the removed option',async()=>{
 const settings={year:2027,month:1,entries:[entry],identity:'Synthetic Test',now:new Date('2026-11-13T00:00:00Z')};
 const plain=await makeICS(settings),oldCaller=await makeICS({...settings,emojis:true});
 assert.equal(oldCaller,plain);
 assert.match(plain.replace(/\r\n /g,''),/SUMMARY:Frühdienst Stroke · Stroke Unit · Zusätzlich geplant/);
 assert.match(plain,/DTSTART;TZID=Europe\/Zurich:20270102T070000/);
 for(const row of plain.split('\r\n'))assert.ok(Buffer.byteLength(row)<=75);
});
test('Compatibility tags keep already issued links stable across dates and time corrections',()=>{
 const id=serviceForEntry(entry).id;
 assert.equal(serviceForEntry({...entry,day:18,definition:{...entry.definition,start:'08:00',end:'12:00'}}).id,id);
 assert.notEqual(serviceForEntry({...entry,definition:{...entry.definition,department:'Medizin Nord'}}).id,id);
});
