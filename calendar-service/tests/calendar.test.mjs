import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {handle,validateICS} from '../lib/calendar.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_sour_dragon_man.sql',import.meta.url),'utf8'));
const db={prepare(sql){let vals=[];return{bind(...v){vals=v;return this},async first(){return sqlite.prepare(sql).get(...vals)},async all(){return{results:sqlite.prepare(sql).all(...vals)}},async run(){return sqlite.prepare(sql).run(...vals)}}},async batch(q){return Promise.all(q.map(x=>x.run()))}};
const id='a'.repeat(64),edit='b'.repeat(64),read='c'.repeat(64),origin='https://andi201andi201.github.io',base='https://example.test';
const month=new Date().toISOString().slice(0,7),date=month.replace('-','')+'06';
const ics=label=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:abc\r\nDTSTART;VALUE=DATE:${date}\r\nSUMMARY:${label}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
function req(method,body,token=edit){return new Request(base+'/api/calendar/'+id,{method,headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body&&JSON.stringify(body)})}
test('Create, update same month, read-only link, rejection and revocation',async()=>{
 assert.equal((await handle(req('PUT',{ics:ics('A'),month,readToken:read}),db)).status,200);
 const feed=()=>handle(new Request(base+'/feed/'+id+'/'+read+'.ics'),db);
 assert.match(await (await feed()).text(),/SUMMARY:A/);
 assert.equal((await handle(req('PUT',{ics:ics('B'),month,readToken:read},read),db)).status,403);
 assert.equal((await handle(req('PUT',{ics:ics('B'),month,readToken:read}),db)).status,200);
 const updated=await(await feed()).text();assert.match(updated,/SUMMARY:B/);assert.doesNotMatch(updated,/SUMMARY:A/);assert.equal((updated.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.equal((await handle(req('PUT',{ics:ics('B').replace('SUMMARY:B','ATTACH:https://evil.test'),month,readToken:read}),db)).status,400);
 assert.equal((await handle(req('DELETE',null,read),db)).status,403);
 assert.equal((await handle(req('DELETE'),db)).status,200);assert.equal((await feed()).status,404);
});
test('Only the original and explicitly registered app origins can manage subscriptions',async()=>{
 for(const allowed of [origin,'https://schichtkompass.bb-planer.ch','https://schichtkompass-domain.andi201andi201.chatgpt.site']){
  const response=await handle(new Request(base+'/api/calendar/'+id,{method:'OPTIONS',headers:{Origin:allowed}}),db);
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),allowed);assert.equal(response.headers.get('Vary'),'Origin');
 }
 for(const denied of ['https://evil.test','https://schichtkompass.bb-planer.ch.evil.test','http://schichtkompass.bb-planer.ch','null',null]){
  const response=await handle(new Request(base+'/api/calendar/'+id,{method:'OPTIONS',headers:denied?{Origin:denied}:{}}),db);
  assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
 }
});

test('Multiple daily services stay bounded to four entries per calendar day',()=>{
 const head='BEGIN:VCALENDAR\r\nVERSION:2.0\r\n',tail='END:VCALENDAR\r\n';
 const event=i=>'BEGIN:VEVENT\r\nUID:'+i+'\r\nDTSTART;VALUE=DATE:'+date+'\r\nSUMMARY:Test\r\nEND:VEVENT\r\n';
 assert.doesNotThrow(()=>validateICS(head+Array.from({length:124},(_,i)=>event(i)).join('')+tail,month));
 assert.throws(()=>validateICS(head+Array.from({length:125},(_,i)=>event(i)).join('')+tail,month));
});
test('Optional duty feeds span months, move corrected events, retain alarms and are revoked together',async()=>{
 const early='d'.repeat(32),night='e'.repeat(32),unknown='f'.repeat(32);
 const tagged=(kind,label,title)=>ics(title).replace('SUMMARY:'+title,'X-SCHICHTKOMPASS-SERVICE:'+kind+'\r\nX-SCHICHTKOMPASS-SERVICE-NAME:'+label+'\r\nSUMMARY:'+title+'\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nDESCRIPTION:Reminder\r\nEND:VALARM');
 const first=tagged(early,'Frühdienst Stroke','☀️ Frühdienst Stroke');
 assert.equal((await handle(req('PUT',{ics:first,month,readToken:read}),db)).status,200);
 const otherDate=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)),otherMonth=otherDate.toISOString().slice(0,7);
 const second=tagged(night,'Nachtdienst Stroke','🌙 Nachtdienst Stroke').replaceAll(date,otherMonth.replace('-','')+'06');
 assert.equal((await handle(req('PUT',{ics:second,month:otherMonth,readToken:read}),db)).status,200);
 const readFeed=service=>handle(new Request(base+'/feed/'+id+'/'+read+'.ics'+(service?'?dienst='+service:'')),db);
 const earlyFeed=await(await readFeed(early)).text();assert.match(earlyFeed,/SUMMARY:☀️ Frühdienst/);assert.doesNotMatch(earlyFeed,/SUMMARY:🌙/);assert.match(earlyFeed,/BEGIN:VALARM/);assert.match(earlyFeed,/X-WR-CALNAME:SchichtKompass · Frühdienst Stroke/);
 assert.equal(((await(await readFeed()).text()).match(/BEGIN:VEVENT/g)||[]).length,2);
 const index=await(await handle(req('GET'),db)).json();assert.deepEqual(index.services.map(s=>s.count),[1,1]);assert.equal((await handle(req('GET',null,read),db)).status,403);
 const corrected=tagged(night,'Nachtdienst Stroke','🌙 Korrigierter Nachtdienst');
 assert.equal((await handle(req('PUT',{ics:corrected,month,readToken:read}),db)).status,200);
 assert.doesNotMatch(await(await readFeed(early)).text(),/BEGIN:VEVENT/);assert.equal(((await(await readFeed(night)).text()).match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.equal((await readFeed(unknown)).status,200);assert.doesNotMatch(await(await readFeed(unknown)).text(),/BEGIN:VEVENT/);
 for(const query of ['?dienst=bad','?dienst=','?dienst=legacy&dienst='+early,'?other=1'])assert.equal((await handle(new Request(base+'/feed/'+id+'/'+read+'.ics'+query),db)).status,404);
 assert.equal((await handle(req('DELETE'),db)).status,200);assert.equal((await readFeed(early)).status,404);assert.equal((await readFeed(night)).status,404);
});
test('Older untagged months remain available as Bisherige Dienste instead of silently disappearing',async()=>{
 const created=await handle(req('PUT',{ics:ics('Alter Dienst'),month,readToken:read}),db);assert.equal(created.status,200);
 assert.deepEqual((await created.json()).services,[{id:'legacy',label:'Bisherige Dienste',count:1}]);
 const response=await handle(new Request(base+'/feed/'+id+'/'+read+'.ics?dienst=legacy'),db);assert.match(await response.text(),/SUMMARY:Alter Dienst/);
 assert.equal((await handle(req('DELETE'),db)).status,200);
});
