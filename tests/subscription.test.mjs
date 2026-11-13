import {test} from 'node:test';import assert from 'node:assert/strict';import {setupSubscription} from '../dist/subscription.js';
test('Subscription requires consent, preserves retry keys, separates people and revokes',async()=>{
 const nodes=new Map();global.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{checked:false,hidden:false,value:'',textContent:''});return nodes.get(id)}};
 const saved=new Map();global.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const $=id=>document.getElementById(id);let person='Alex Test',allowed=true,calls=0,errors=[],target='iphone';
 global.confirm=()=>true;global.fetch=async(url,options)=>{calls++;if(options.method==='PUT')assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(),['ics','month','readToken']);assert.ok(saved.size,'keys saved before request');return new Response('{"ok":true}',{status:200})};
 global.location={href:'https://schichtkompass.bb-planer.ch/#old-fragment'};
 const paint=setupSubscription({getTarget:()=>target,canPublish:()=>allowed,getContent:async()=>'',getMonth:()=> '2026-11',getPerson:()=>person,isDemo:()=>false,notify:m=>errors.push(m)});
 assert.equal($('subscribe-save').disabled,true);await $('subscribe-save').onclick();assert.equal(calls,0);
 $('subscription-consent').checked=true;paint();assert.equal($('subscribe-save').disabled,false);
 await $('subscribe-save').onclick();assert.equal(calls,1);assert.match($('subscription-open').href,/^webcal:/);assert.equal($('subscription-links').hidden,false);
 let shared;Object.defineProperty(globalThis,'navigator',{value:{share:async data=>{shared=data}},configurable:true});await $('google-share').onclick();assert.equal(new URL(shared.url).origin,'https://schichtkompass.bb-planer.ch');assert.equal(new URL(shared.url).pathname,'/');assert.match(new URL(shared.url).hash,/^#google-abo=/);assert.doesNotMatch(shared.url,/old-fragment/);
 target='google';paint();assert.equal($('google-subscribe-help').hidden,false);assert.match($('subscription-open').href,/^https:\/\/calendar.google.com/);assert.match($('subscription-status').textContent,/Google/);target='iphone';paint();assert.equal($('google-subscribe-help').hidden,true);assert.match($('subscription-open').href,/^webcal:/);person='Other Person';await $('subscribe-save').onclick();assert.equal(calls,1);assert.match(errors.at(-1),/anderen Namen/);
 allowed=false;paint();assert.equal($('subscribe-save').disabled,true);
 await $('subscription-revoke').onclick();assert.equal(calls,2);assert.equal(saved.size,0);assert.equal($('subscription-links').hidden,true);
});
test('Retired preferences cannot enable hidden modes or send background display updates',()=>{
 const forbidden=new Set(['calendar-emojis','emoji-apply','subscription-split','subscription-service-list','subscription-combined-links']);
 const nodes=new Map();global.document={getElementById(id){assert.equal(forbidden.has(id),false);if(!nodes.has(id))nodes.set(id,{checked:false,hidden:false,value:'',textContent:''});return nodes.get(id)}};
 const keys={id:'a'.repeat(64),read:'b'.repeat(64),edit:'c'.repeat(64),identity:'d'.repeat(64),published:true};
 const store=new Map([['schichtkompass-subscription-v1',JSON.stringify(keys)],['schichtkompass-emojis-v1','true'],['schichtkompass-separate-duties-v1','true']]);
 global.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 global.location={href:'https://schichtkompass.bb-planer.ch/'};global.fetch=()=>{throw Error('No network update is needed to open the page')};
 const paint=setupSubscription({canPublish:()=>false,getContent:()=>'',getMonth:()=>'',getPerson:()=>'',isDemo:()=>false,notify:()=>{}});paint();
 assert.equal(store.size,1);assert.equal(store.get('schichtkompass-subscription-v1'),JSON.stringify(keys));
 assert.equal(new URL(nodes.get('subscription-open').href).search,'');assert.equal(nodes.get('subscription-links').hidden,false);
});
