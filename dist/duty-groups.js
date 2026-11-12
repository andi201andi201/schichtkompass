export const DUTY_GROUPS={frueh:'Frühdienst',spaet:'Spätdienst',nacht:'Nachtdienst',sonstiges:'Sonstiges'};
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function dutyGroup({name='',code='',type='shift'}={}){
 if(type!=='shift')return 'sonstiges';
 const title=normal(name),short=normal(code);
 if(/ferien|urlaub|weiterbildung|fortbildung|schulung|schultag|lerntag|lerntreffen|lernforum|buro|planungstag|\bpil\b/.test(title)||short==='pil')return 'sonstiges';
 if(/nachtdienst/.test(title)||['n','ns'].includes(short)||/^(n|ns)$/.test(title))return 'nacht';
 if(/spatdienst/.test(title)||['s','ss','c'].includes(short)||/^(s|ss|c)$/.test(title))return 'spaet';
 if(/fruhdienst/.test(title)||['f','fs'].includes(short)||/^(f|fs)$/.test(title))return 'frueh';
 return 'sonstiges';
}

export function emojiForDuty({name='',code='',type='shift'}={}){
 const title=normal(name),short=normal(code),shift=type==='shift';
 if(/ferien|urlaub/.test(title))return '🏖️';
 if(/weiterbildung|fortbildung|schulung|schultag|lerntag|lerntreffen|lernforum|pil\b/.test(title)||short==='pil')return '🎓';
 if(/buro|planungstag/.test(title))return '💻';
 if(/nachtdienst/.test(title)||(shift&&['n','ns'].includes(short)))return '🌙';
 if(/spatdienst/.test(title)||(shift&&['s','ss','c'].includes(short)))return '🌇';
 if(/fruhdienst/.test(title)||(shift&&['f','fs'].includes(short)))return '☀️';
 return type==='allday'?'📅':'🏥';
}
