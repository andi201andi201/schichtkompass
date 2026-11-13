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
 const earlyFeed=await(await readFeed(early)).text();assert.match(earlyFeed,/SUMMARY:Frühdienst/);assert.doesNotMatch(earlyFeed,/SUMMARY:🌙/);assert.match(earlyFeed,/BEGIN:VALARM/);assert.match(earlyFeed,/X-WR-CALNAME:SchichtKompass · Frühdienst Stroke/);
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
test('Four colour groups cover every event, including older months, without replacing detailed event names',async()=>{
 const event=(uid,title,{allDay=false,group=''}={})=>'BEGIN:VEVENT\r\nUID:'+uid+'\r\nDTSTART'+(allDay?';VALUE=DATE:':';TZID=Europe/Zurich:')+date+(allDay?'':'T070000')+'\r\nSUMMARY:'+title+'\r\n'+(group?'X-SCHICHTKOMPASS-GROUP:'+group+'\r\n':'')+'END:VEVENT\r\n';
 const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+event('early','☀️ Frühdienst Stroke · Stroke Unit')+event('late','Spätdienst')+event('night','Nachtdienst Stroke')+event('office','Büro')+event('training','Weiterbildung Arbeitstag')+event('holiday','Ferien',{allDay:true})+'END:VCALENDAR\r\n';
 const saved=await handle(req('PUT',{ics:content,month,readToken:read}),db);assert.equal(saved.status,200);assert.deepEqual((await saved.json()).groups.map(({id,count})=>[id,count]),[['frueh',1],['spaet',1],['nacht',1],['sonstiges',3]]);
 const groupFeed=group=>handle(new Request(base+'/feed/'+id+'/'+read+'.ics?gruppe='+group),db);
 const other=await(await groupFeed('sonstiges')).text();assert.equal((other.match(/BEGIN:VEVENT/g)||[]).length,3);assert.match(other,/SUMMARY:Büro/);assert.match(other,/SUMMARY:Weiterbildung Arbeitstag/);assert.match(other,/SUMMARY:Ferien/);assert.doesNotMatch(other,/SUMMARY:.*dienst/);assert.match(other,/X-WR-CALNAME:SchichtKompass · Sonstiges/);
 assert.match(await(await groupFeed('frueh')).text(),/SUMMARY:Frühdienst Stroke · Stroke Unit/);
 for(const query of ['?gruppe=bad','?gruppe=','?gruppe=frueh&gruppe=nacht','?gruppe=frueh&dienst=legacy'])assert.equal((await handle(new Request(base+'/feed/'+id+'/'+read+'.ics'+query),db)).status,404);
 const corrected='BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+event('early','Frühdienst',{group:'frueh'})+'END:VCALENDAR\r\n';assert.equal((await handle(req('PUT',{ics:corrected,month,readToken:read}),db)).status,200);assert.doesNotMatch(await(await groupFeed('sonstiges')).text(),/BEGIN:VEVENT/);
 assert.equal((await handle(req('DELETE'),db)).status,200);assert.equal((await groupFeed('frueh')).status,404);
});
test('Stored legacy titles are corrected on read, PATCH is removed and future updates advance the visible revision',async()=>{
 const plain=ics('Frühdienst Stroke');assert.equal((await handle(req('PUT',{ics:plain,month,readToken:read}),db)).status,200);
 const stored=sqlite.prepare('SELECT ics FROM months WHERE calendar=? AND month=?').get(id,month).ics;
 const legacy=stored.replace('SUMMARY:Frühdienst Stroke','SUMMARY:☀️ Frühdienst Stroke');
 sqlite.prepare('UPDATE months SET ics=? WHERE calendar=? AND month=?').run(legacy,id,month);
 const feed=()=>handle(new Request(base+'/feed/'+id+'/'+read+'.ics'),db);
 const first=await(await feed()).text();assert.match(first,/SUMMARY:Frühdienst Stroke/);assert.doesNotMatch(first,/SUMMARY:☀️/);assert.match(first,/SEQUENCE:1/);
 assert.equal(await(await feed()).text(),first);assert.equal(sqlite.prepare('SELECT ics FROM months WHERE calendar=? AND month=?').get(id,month).ics,legacy);
 assert.equal((await handle(req('PATCH',{emojis:true}),db)).status,405);
 assert.equal((await handle(req('PUT',{ics:ics('Frühdienst Stroke korrigiert'),month,readToken:read,emojis:true}),db)).status,200);
 const updated=await(await feed()).text();assert.match(updated,/SUMMARY:Frühdienst Stroke korrigiert/);assert.match(updated,/SEQUENCE:2/);assert.doesNotMatch(updated,/SUMMARY:☀️/);
 assert.equal((await handle(req('DELETE'),db)).status,200);
});
