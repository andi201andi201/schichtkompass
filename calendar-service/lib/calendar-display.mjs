const unfold=ics=>ics.replace(/\r\n[ \t]/g,'');
const eventPattern=/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g;
const field=(text,key)=>new RegExp('^'+key+':([^\\r\\n]*)','m').exec(text)?.[1];
const stripRevision=event=>event.replace(/^(DTSTAMP|LAST-MODIFIED|SEQUENCE):[^\r\n]*\r\n/gm,'');
const withoutAppEmoji=value=>value.replace(/^(?:☀️?|🌇|🌙|🎓|💻|🏖️?|📅|🏥)\s+/u,'');
function fold(line){let row='',size=0,rows=[];for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>75){rows.push(row);row=' ';size=1}row+=c;size+=n}rows.push(row);return rows.join('\r\n')}
function property(event,key,value){const line=key+':'+value,pattern=new RegExp('^'+key+':[^\\r\\n]*\\r\\n','m');return pattern.test(event)?event.replace(pattern,()=>line+'\r\n'):event.replace('END:VEVENT\r\n',()=>line+'\r\nEND:VEVENT\r\n')}
export function rewriteCalendar(ics,{previous=ics,now=new Date()}={}){
 const oldEvents=new Map((unfold(previous).match(eventPattern)||[]).map(event=>[field(event,'UID'),event]));
 const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 let calendar=unfold(ics);
 calendar=calendar.replace(eventPattern,event=>{
  const old=oldEvents.get(field(event,'UID'));
  const plain=field(event,'X-SCHICHTKOMPASS-ORIGINAL-TITLE')??withoutAppEmoji(field(event,'SUMMARY')||'');
  if(field(event,'SUMMARY')!==plain)event=property(event,'SUMMARY',plain);
  const changed=!old||stripRevision(old)!==stripRevision(event);
  const oldSequence=Number(field(old||'','SEQUENCE')||0),incomingSequence=Number(field(event,'SEQUENCE')||0);
  const sequence=Math.max(Number.isSafeInteger(oldSequence)&&oldSequence>=0?oldSequence:0,Number.isSafeInteger(incomingSequence)&&incomingSequence>=0?incomingSequence:0)+(old&&changed?1:0);
  const modified=changed?stamp:field(old||'','LAST-MODIFIED')||field(old||'','DTSTAMP')||stamp;
  return stripRevision(event).replace('BEGIN:VEVENT\r\n',()=>`BEGIN:VEVENT\r\nDTSTAMP:${modified}\r\nLAST-MODIFIED:${modified}\r\nSEQUENCE:${sequence}\r\n`);
 });
 return calendar.split('\r\n').filter(Boolean).map(fold).join('\r\n')+'\r\n';
}

// Stable read projection also removes old generated prefixes without changing stored user data.
const retiredAt=new Date('2026-11-13T00:22:40Z');
export const plainStoredCalendar=ics=>rewriteCalendar(ics,{now:retiredAt});
