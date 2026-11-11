import {featureDistance,validateDefinition} from './core.js';
import {contextFor,contextMatches} from './duty-context.js';

export const ZGKS_SETTINGS_KEY='schichtkompass-zgks-v1';
export function initialZGKSSettings(saved){
 return {enabled:typeof saved?.enabled==='boolean'?saved.enabled:true};
}
// Full icon matching deliberately retains colours and underlines. E in red,
// green or blue and S/M in presence vs absence must never share a code-only key.
export function recognizeZGKS(feature,registry){
 if(!Array.isArray(feature)||feature.length!==1200)return null;
 const ranked=registry.symbols.map(ref=>({ref,distance:featureDistance(feature,ref.feature)})).sort((a,b)=>a.distance-b.distance);
 const best=ranked[0];
 // Canvas and PDF decoders resample a black/white icon more sharply than the
 // reference extractor. Permit that difference only with a very clear lead.
 const lead=ranked[1]?ranked[1].distance-best.distance:1;
 if(!best||best.distance>.13||lead<.018||(best.distance>.085&&lead<.12))return null;
 return best.ref;
}
export function annotateZGKS(symbol,registry){
 const ref=recognizeZGKS(symbol.feature,registry);if(!ref)return null;
 const context=contextFor(symbol);
 return {...symbol,...context,recognizedCode:ref.type==='skip'?'':ref.code,serviceKey:ref.type==='skip'?'free':'zgks:'+ref.id+(context.contextKey==='home'?'':'|'+context.contextKey)};
}
export function zgksIdFor(group){return /^zgks:(\d+)(?:\||$)/.exec(group.serviceKey||'')?.[1]||'';}
export function zgksDefinition(group,profiles,registry,{year,month}){
 const id=zgksIdFor(group),ref=registry.symbols.find(r=>r.id===id);if(!ref)return null;
 const date=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';
 const valid=date>=ref.validFrom,period=(valid?'from:':'before:')+ref.validFrom;
 const custom=profiles.filter(p=>p.zgksId===id&&p.zgksPeriod===period&&contextMatches(group,p)&&validateDefinition(p.definition)).at(-1);
 if(custom)return {definition:{...custom.definition},period,id,source:'custom',reason:''};
 const extra=group.contextKey&&group.contextKey!=='home';
 let reason='';
 if(!valid)reason='Diese Vorlage gilt erst ab '+(ref.kind==='presence'?'1. Januar 2027':'1. Oktober 2026')+'. Bitte die Angaben für diesen Plan ergänzen.';
 else if(extra)reason='Abteilung oder Zusatz beim ersten Mal bestätigen. Dafür ist eine eigene Zuordnung nötig.';
 const definition={code:ref.code,name:ref.name,type:reason?'':ref.type,start:valid?ref.start:'',end:valid?ref.end:'',department:group.departmentLabel||'',otherDepartment:!!group.otherDepartment,requiresDepartment:!!group.requiresDepartment};
 return {definition,period,id,source:'official',reason};
}
