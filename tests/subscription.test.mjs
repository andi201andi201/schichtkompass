import {test} from 'node:test';import assert from 'node:assert/strict';import {setupSubscription} from '../dist/subscription.js';
test('Subscription requires consent, preserves retry keys, separates people and revokes',async()=>{
 const nodes=new Map();global.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{checked:false,hidden:false,value:'',textContent:''});return nodes.get(id)}};
 const saved=new Map();global.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const $=id=>document.getElementById(id);let person='Alex Test',allowed=true,calls=0,errors=[];
 global.confirm=()=>true;global.fetch=async(url,options)=>{calls++;assert.ok(saved.size,'keys saved before request');return new Response('{"ok":true}',{status:200})};
 const paint=setupSubscription({canPublish:()=>allowed,getContent:async()=>'',getMonth:()=> '2026-11',getPerson:()=>person,isDemo:()=>false,notify:m=>errors.push(m)});
 assert.equal($('subscribe-save').disabled,true);await $('subscribe-save').onclick();assert.equal(calls,0);
 $('subscription-consent').checked=true;paint();assert.equal($('subscribe-save').disabled,false);
 await $('subscribe-save').onclick();assert.equal(calls,1);assert.match($('subscription-open').href,/^webcal:/);assert.equal($('subscription-links').hidden,false);
 person='Other Person';await $('subscribe-save').onclick();assert.equal(calls,1);assert.match(errors.at(-1),/anderen Namen/);
 allowed=false;paint();assert.equal($('subscribe-save').disabled,true);
 await $('subscription-revoke').onclick();assert.equal(calls,2);assert.equal(saved.size,0);assert.equal($('subscription-links').hidden,true);
});
