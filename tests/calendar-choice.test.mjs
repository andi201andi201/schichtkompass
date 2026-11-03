import {test} from 'node:test';import assert from 'node:assert/strict';import {initialCalendar,suggestedCalendar,calendarLinks} from '../dist/calendar-choice.js';
test('Device suggestions stay overridable and desktop does not guess',()=>{
 assert.equal(suggestedCalendar({userAgent:'Mozilla iPhone'}),'iphone');assert.equal(suggestedCalendar({userAgent:'Mozilla Android'}),'google');assert.equal(suggestedCalendar({platform:'MacIntel',maxTouchPoints:5}),'iphone');assert.equal(suggestedCalendar({userAgent:'Windows Chrome'}),'');assert.equal(initialCalendar('google',{userAgent:'iPhone'}),'google');assert.equal(initialCalendar('iphone',{userAgent:'Android'}),'iphone');
});
test('Google link contains only validated read URL and survives handoff encoding',()=>{
 const feed='https://schichtkompass-calendar.andi201andi201.chatgpt.site/feed/'+'a'.repeat(64)+'/'+'b'.repeat(64)+'.ics';
 const links=calendarLinks(feed,'https://andi201andi201.github.io/schichtkompass/#old');assert.equal(new URL(links.google).searchParams.get('cid'),feed.replace('https:','webcal:'));assert.equal(decodeURIComponent(new URL(links.setup).hash.slice(12)),feed);assert.throws(()=>calendarLinks('https://evil.test/calendar.ics','https://example.test'));assert.throws(()=>calendarLinks(feed+'?edit=secret','https://example.test'));
});
