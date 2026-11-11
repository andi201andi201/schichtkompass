import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {handle} from '../lib/calendar.mjs';
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
