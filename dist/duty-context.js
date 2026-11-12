const normal=s=>{const value=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');return value==='STUN'?'STU':value};
export function mergeDutyNotes(...values){const tokens=new Map();for(const value of values)for(const token of String(value||'').split(/\s+/)){const key=normal(token);if(key&&!tokens.has(key))tokens.set(key,token)}return [...tokens.values()].join(' ')}
export function hasRedBackground(feature){
 if(!feature||feature.length!==1200)return false;let red=0,total=0;
 // Only the fill counts. A red border around a white/grey C is not another unit.
 for(let y=4;y<16;y++)for(let x=4;x<16;x++){const i=(y*20+x)*3,r=feature[i],g=feature[i+1],b=feature[i+2];total++;if(r>140&&r-g>28&&r-b>22)red++}
 return red/total>.6;
}
export function contextFor(symbol){
 const note=String(symbol.note||'').trim(),tokens=note.split(/[\s,;]+/).map(normal);
 const known=tokens.includes('STU')?{code:'STU',label:'Stroke Unit'}:tokens.includes('MN')?{code:'MN',label:'Medizin Nord'}:tokens.includes('MS')?{code:'MS',label:'Medizin Süd'}:null;
 const other=symbol.otherDepartment??hasRedBackground(symbol.feature);
 const extraTokens=[...new Set(tokens.filter(t=>t&&t!==known?.code))].sort();
 const base=other?'other:'+(known?.code||'unassigned'):known?'unit:'+known.code:'home';
 const key=base+(extraTokens.length?'|extra:'+extraTokens.join('+'):'')+(symbol.partCount>1?'|part:'+(symbol.partialDate||'')+':'+symbol.partIndex+'/'+symbol.partCount:'');
 const labels={ZUSA:'Zusätzlich geplant',DIV:'Weiterbildung divers'};
 return{contextKey:key,otherDepartment:other,requiresDepartment:other||!!known,departmentCode:known?.code||'',departmentLabel:known?.label||'',supplementLabels:extraTokens.map(t=>labels[t]||t),note};
}
export function contextMatches(symbol,profile){
 const context=symbol.contextKey||contextFor(symbol).contextKey;
 if(profile.contextKey)return profile.contextKey===context;
 // Old profiles were code-only. They cannot certify an external-unit assignment.
 return context==='home'&&!hasRedBackground(profile.feature);
}
export function registeredContext(symbol,definition){
 const key=symbol.contextKey||'home';if(!key.startsWith('other:unassigned')||!definition.department?.trim())return key;
 const value=normal(definition.department),aliases={STROKEUNIT:'STU',MEDIZINNORD:'MN',MEDIZINSUD:'MS'};
 return key.replace('other:unassigned','other:'+(aliases[value]||value));
}
export function notesBelowRow(items,rect,days,placements=[]){
 const step=rect.w/days;
 const nextRows=placements.filter(p=>p.y>rect.y+rect.h*.9&&p.x>=rect.x-step*.1&&p.x<rect.x+rect.w);
 const upper=Math.min(rect.y+rect.h*1.8,...nextRows.map(p=>p.y));
 const notes=Array.from({length:days},()=>[]);
 for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)){
  // In this PDF a supplement's baseline can overlap the next icon row. Its
  // character centre, rather than its baseline, identifies the owning row.
  const centre=item.y-(item.height||0)*.5;
  if(!item.text?.trim()||centre<=rect.y+rect.h*.96||centre>=upper)continue;
  const day=Math.floor((item.x-rect.x+step*.08)/step);
  if(day>=0&&day<days&&!notes[day].includes(item.text.trim()))notes[day].push(item.text.trim());
 }
 return notes.map(parts=>parts.join(' '));
}
export function departmentForEntry(entry){return entry.definition?.department?.trim()||entry.departmentLabel||''}
export function calendarSummary(entry){
 const title=entry.definition.name,department=departmentForEntry(entry),parts=[title];if(department)parts.push(department);
 const note=String(entry.note||'').trim();
 // Keep additional flags, without repeating StU next to the expanded unit name.
 const labels={ZUSA:'Zusätzlich geplant (ZusA)',DIV:'Weiterbildung divers (DIV)'};
 const extras=note.split(/\s+/).filter(token=>token&&!(entry.departmentCode&&normal(token)===entry.departmentCode)).map(token=>labels[normal(token)]||token);
 if(extras.length)parts.push(extras.join(' '));
 return parts.join(' · ');
}
