import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceForEntry,serviceCatalog,styledSummary,emojiForEntry} from '../dist/calendar-style.js';
import {makeICS} from '../dist/core.js';
const early={day:2,definition:{code:'FS',name:'Frühdienst Stroke',type:'shift',start:'07:00',end:'16:06',department:'Stroke Unit'},zgksId:'182'};
const night={day:3,definition:{code:'NS',name:'Nachtdienst Stroke',type:'shift',start:'22:10',end:'07:11',department:'Stroke Unit'},zgksId:'1470'};
test('Emojis are opt-in, preserve department and notes and never alter event identities',async()=>{
 const entry={...early,note:'ZusA'},settings={year:2027,month:1,entries:[entry,night],identity:'Synthetic Test'};
 const plain=await makeICS(settings),icons=await makeICS({...settings,emojis:true});
 assert.match(plain,/SUMMARY:Frühdienst Stroke/);assert.doesNotMatch(plain,/SUMMARY:☀️/);
 const unfolded=icons.replace(/\r\n /g,'');assert.match(unfolded,/SUMMARY:☀️ Frühdienst Stroke · Stroke Unit · Zusätzlich geplant/);assert.match(unfolded,/SUMMARY:🌙 Nachtdienst Stroke/);
 assert.deepEqual([...plain.matchAll(/^UID:(.+)/gm)].map(x=>x[1]),[...icons.matchAll(/^UID:(.+)/gm)].map(x=>x[1]));
 assert.equal(plain.match(/X-SCHICHTKOMPASS-SERVICE:(\w+)/)[1],icons.match(/X-SCHICHTKOMPASS-SERVICE:(\w+)/)[1]);
 for(const row of icons.split('\r\n'))assert.ok(Buffer.byteLength(row)<=75);
 assert.equal(emojiForEntry({definition:{code:'F',name:'Ferien',type:'allday'}}),'🏖️');
 assert.equal(emojiForEntry({definition:{code:'S',name:'Schultag',type:'allday'}}),'🎓');
 assert.equal(emojiForEntry({definition:{code:'B',name:'Büro',type:'shift'}}),'💻');
 assert.equal(emojiForEntry({definition:{code:'S',name:'Schwangerschaft',type:'allday'}}),'📅');
 assert.equal(styledSummary({definition:{name:'🌙 Nachtdienst',type:'shift'}},true),'🌙 Nachtdienst');
});
test('Service subscriptions are stable across dates, times and day-specific exceptions but separate Stroke and other units',()=>{
 const expected=serviceForEntry(early).id;
 assert.equal(serviceForEntry({...early,day:18,partIndex:2,partCount:2,note:'DIV',definition:{...early.definition,start:'08:00',end:'12:00',name:'Frühdienst Stroke korrigiert'}}).id,expected);
 assert.notEqual(serviceForEntry({...early,definition:{...early.definition,department:'Medizin Nord'}}).id,expected);
 assert.notEqual(serviceForEntry({...early,definition:{...early.definition,code:'F',name:'Frühdienst',department:''}}).id,expected);
 assert.equal(serviceForEntry({definition:{type:'skip',name:'Frei'}}),null);
 const catalog=serviceCatalog([early,{...early,day:5},night,{definition:{type:'skip'}}]);assert.equal(catalog.length,2);assert.equal(catalog.find(x=>x.id===expected).count,2);
});
test('Colour mode has exactly four groups; Stroke variants join the matching shift and all remaining duties stay Sonstiges',async()=>{
 const {colourGroupCatalog}=await import('../dist/calendar-style.js');
 const office={day:8,definition:{code:'B',name:'Büro',type:'shift',start:'22:00',end:'07:00'}},training={day:9,definition:{code:'WA',name:'Weiterbildung Arbeitstag',type:'shift',start:'07:00',end:'16:00'}},holiday={day:10,definition:{code:'F',name:'Ferien',type:'allday'}};
 const entries=[early,night,{...early,day:4,definition:{...early.definition,code:'F',name:'Frühdienst',department:''}},office,training,holiday];
 assert.deepEqual(colourGroupCatalog(entries).map(({id,count})=>[id,count]),[['frueh',2],['spaet',0],['nacht',1],['sonstiges',3]]);
 const content=(await makeICS({year:2027,month:1,entries,emojis:true})).replace(/\r\n /g,'');
 assert.match(content,/SUMMARY:💻 Büro/);assert.match(content,/SUMMARY:🎓 Weiterbildung Arbeitstag/);assert.match(content,/SUMMARY:🏖️ Ferien/);assert.doesNotMatch(content,/SUMMARY:Sonstiges/);
});
