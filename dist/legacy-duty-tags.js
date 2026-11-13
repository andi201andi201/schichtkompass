// Compatibility metadata for existing subscriptions. No new individual subscriptions are offered.
import {departmentForEntry} from './duty-context.js';
import {DUTY_GROUPS,dutyGroup} from './legacy-duty-groups.js';

const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function serviceHash(value){
 let a=0xcbf29ce484222325n,b=0x84222325cbf29ce4n;
 for(const byte of new TextEncoder().encode(value)){a=BigInt.asUintN(64,(a^BigInt(byte))*0x100000001b3n);b=BigInt.asUintN(64,(b^BigInt(byte))*0x100000001b3n)}
 return a.toString(16).padStart(16,'0')+b.toString(16).padStart(16,'0');
}
export function serviceForEntry(entry){
 const d=entry.definition;if(!d||d.type==='skip')return null;
 const department=departmentForEntry(entry),official=entry.zgksId||/^zgks:(\d+)/.exec(entry.serviceKey||'')?.[1];
 // Dates, times, image variants and daily supplementary notes never change a feed.
 const key=official?['zgks',official,normal(d.code),normal(department)]:['custom',normal(d.code),normal(d.name),normal(department)];
 return {id:serviceHash(JSON.stringify(key)),label:[d.name,department].filter(Boolean).join(' · ')};
}
export function colourGroupForEntry(entry){const id=dutyGroup(entry.definition);return {id,label:DUTY_GROUPS[id]}}
