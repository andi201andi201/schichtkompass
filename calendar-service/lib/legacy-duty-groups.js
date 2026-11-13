// Compatibility for already issued filtered feed URLs.
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

