import {calendarSummary,departmentForEntry} from './duty-context.js';
import {DUTY_GROUPS,dutyGroup} from './duty-groups.js';

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
export function serviceCatalog(entries){
 const found=new Map();
 for(const entry of entries){const service=serviceForEntry(entry);if(!service)continue;const row=found.get(service.id)||{...service,count:0};row.count++;found.set(service.id,row)}
 return [...found.values()].sort((a,b)=>a.label.localeCompare(b.label,'de-CH'));
}
export function colourGroupForEntry(entry){const id=dutyGroup(entry.definition);return {id,label:DUTY_GROUPS[id]}}
export function colourGroupCatalog(entries){
 const counts=new Map();for(const entry of entries){if(!entry.definition||entry.definition.type==='skip')continue;const group=colourGroupForEntry(entry),row=counts.get(group.id)||{...group,count:0};row.count++;counts.set(group.id,row)}
 return Object.entries(DUTY_GROUPS).map(([id,label])=>counts.get(id)||{id,label,count:0});
}
export function emojiForEntry(entry){
 const name=normal(entry.definition?.name),code=normal(entry.definition?.code),shift=entry.definition?.type==='shift';
 if(/ferien|urlaub/.test(name))return '🏖️';
 if(/weiterbildung|fortbildung|schulung|schultag|lerntag|lerntreffen|lernforum|pil\b/.test(name)||code==='pil')return '🎓';
 if(/buro|planungstag/.test(name))return '💻';
 if(/nachtdienst/.test(name)||(shift&&['n','ns'].includes(code)))return '🌙';
 if(/spatdienst/.test(name)||(shift&&['s','ss','c'].includes(code)))return '🌇';
 if(/fruhdienst/.test(name)||(shift&&['f','fs'].includes(code)))return '☀️';
 return entry.definition?.type==='allday'?'📅':'🏥';
}
export function styledSummary(entry,emojis=false){
 const title=calendarSummary(entry);
 return emojis&&!/^\p{Extended_Pictographic}/u.test(title)?emojiForEntry(entry)+' '+title:title;
}
