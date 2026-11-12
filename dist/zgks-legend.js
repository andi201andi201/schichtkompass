import {featureDistance,validateDefinition} from './core.js';
import {contextFor,contextMatches} from './duty-context.js';
import {normalizeCode,readPrintedCode} from './code-reader.js';
import {referenceFor} from './symbol-registry.js';
import variants from './zgks-symbol-variants.json' with {type:'json'};

const strokeTypes={FS:{id:'182',name:'Frühdienst Stroke'},SS:{id:'2650',name:'Spätdienst Stroke'},NS:{id:'1470',name:'Nachtdienst Stroke'}};
export function strokeLegend(registry){return Object.entries(strokeTypes).map(([code,value])=>({...registry.symbols.find(r=>r.id===value.id),id:'stroke:'+code,baseId:value.id,strokeCode:code,code,name:value.name,thumb:variants.stroke.find(v=>v.code===code)?.thumb,department:'Stroke Unit'}))}
export const ZGKS_SETTINGS_KEY='schichtkompass-zgks-v1';
export function initialZGKSSettings(saved){
 return {enabled:typeof saved?.enabled==='boolean'?saved.enabled:true};
}
// Full icon matching deliberately retains colours and underlines. E in red,
// green or blue and S/M in presence vs absence must never share a code-only key.
export function recognizeZGKS(feature,registry){
 if(!Array.isArray(feature)||feature.length!==1200)return null;
 const normalized=trimWhiteMargin(feature),strong=trimWhiteMargin(feature,120),dark=trimWhiteMargin(feature,60);
 const distance=sample=>Math.min(featureDistance(feature,sample),featureDistance(normalized,trimWhiteMargin(sample)),featureDistance(strong,trimWhiteMargin(sample,120)),featureDistance(dark,trimWhiteMargin(sample,60)));
 const ranked=registry.symbols.map(ref=>({ref,distance:Math.min(...[ref.feature,...variants.known.filter(v=>v.id===ref.id).map(v=>v.feature)].map(distance))}));
 for(const code of new Set(variants.stroke.map(v=>v.code)))ranked.push({ref:{unknown:true},distance:Math.min(...variants.stroke.filter(v=>v.code===code).map(v=>distance(v.feature)))});
 ranked.sort((a,b)=>a.distance-b.distance);
 const best=ranked[0];
 // Canvas and PDF decoders resample a black/white icon more sharply than the
 // reference extractor. Permit that difference only with a very clear lead.
 const lead=ranked[1]?ranked[1].distance-best.distance:1;
 if(!best||best.ref.unknown||best.distance>.13||lead<.015||(best.distance>.085&&(lead<.04||lead<best.distance*.45)))return null;
 return best.ref;
}
const marginCache=new WeakMap();
// Grid cells may include white space around an icon. Retain the entire coloured
// frame and underline; never normalize by the printed letter alone.
function trimWhiteMargin(feature,threshold=235){
 const cache=marginCache.get(feature)||new Map();if(cache.has(threshold))return cache.get(threshold);marginCache.set(feature,cache);
 let left=20,right=-1,top=20,bottom=-1;
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){const i=(y*20+x)*3;if(Math.min(...feature.slice(i,i+3))<threshold){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
 if(right-left<5||bottom-top<5){cache.set(threshold,feature);return feature}
 const out=[];
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){
  const px=Math.max(left,Math.min(right,left+(x+.5)*(right-left+1)/20-.5)),py=Math.max(top,Math.min(bottom,top+(y+.5)*(bottom-top+1)/20-.5));
  const x0=Math.floor(px),x1=Math.min(right,x0+1),y0=Math.floor(py),y1=Math.min(bottom,y0+1),dx=px-x0,dy=py-y0;
  for(let c=0;c<3;c++)out.push((1-dy)*((1-dx)*feature[(y0*20+x0)*3+c]+dx*feature[(y0*20+x1)*3+c])+dy*((1-dx)*feature[(y1*20+x0)*3+c]+dx*feature[(y1*20+x1)*3+c]));
 }
 cache.set(threshold,out);return out;
}
// Existing roster samples use older lettering. C was explicitly defined as
// Spätdienst; Bü and PIL are the same named duties in the official legend.
const legacyAliases={C:'2650',PIL:'563',PII:'563',BÜ:'5038'};
const moonSamples=new Set(['hospital-15','hospital-16','hospital-22','hospital-41','hospital-52','hospital-58']);
function referenceByCode(code,registry,{legacy=false}={}){
 const raw=String(code||'').trim().toUpperCase();
 const alias=legacyAliases[raw];if(alias)return registry.symbols.find(r=>r.id===alias)||null;
 const normalized=normalizeCode(raw);
 // BU may be Büro with a lost umlaut or Betreuungsurlaub. Keep it unresolved.
 if(legacy&&normalized==='BU')return null;
 const matches=registry.symbols.filter(r=>r.type!=='skip'&&normalizeCode(r.code)===normalized);
 return matches.length===1?matches[0]:null;
}
export function annotateZGKS(symbol,registry,{references=[],profiles=[],year,month}={}){
 const old=referenceFor(symbol.feature,references);if(old?.serviceKey==='free')return null;
 const context=contextFor(symbol);
 const trustedLegacy=old&&featureDistance(symbol.feature,old.feature)<.02?(moonSamples.has(old.id)?registry.symbols.find(r=>r.id==='1470'):referenceByCode(old.printedCode,registry,{legacy:true})):null;
 const unknowns=variants.stroke.map(v=>({ref:v,d:featureDistance(symbol.feature,v.feature)})).sort((a,b)=>a.d-b.d),bestUnknown=unknowns[0],different=unknowns.find(v=>v.ref.code!==bestUnknown?.ref.code);
 const knownDistance=Math.min(...registry.symbols.map(v=>featureDistance(symbol.feature,v.feature)),...variants.known.map(v=>featureDistance(symbol.feature,v.feature)));
 const unmapped=!trustedLegacy&&bestUnknown?.d<=.085&&bestUnknown.d+.015<knownDistance&&(!different||different.d-bestUnknown.d>=.015)&&(!old||bestUnknown.d+.015<featureDistance(symbol.feature,old.feature))?bestUnknown.ref:null;
 if(unmapped){const stroke=contextFor({...symbol,note:[symbol.note,'StUn'].filter(Boolean).join(' '),otherDepartment:true});return {...symbol,...stroke,note:symbol.note||'',recognizedCode:unmapped.code,strokeCode:unmapped.code,serviceKey:'zgks:'+strokeTypes[unmapped.code].id+'|stroke:'+unmapped.code+'|'+stroke.contextKey};}
 let ref=trustedLegacy||recognizeZGKS(symbol.feature,registry),legacyCode=trustedLegacy?old.printedCode||'':'';
 const learned=profiles.filter(p=>{const sample=registry.symbols.find(r=>r.id===p.zgksId);if(!sample||!contextMatches(context,p))return false;const date=year&&String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';return !date||p.zgksPeriod===(date>=sample.validFrom?'from:':'before:')+sample.validFrom}).map(p=>({p,d:featureDistance(symbol.feature,p.feature)})).sort((a,b)=>a.d-b.d);
 const best=learned[0];if(best&&best.d<=(ref?.02:.085)&&!learned.some(r=>r.d<best.d+.02&&r.p.zgksId!==best.p.zgksId))ref=registry.symbols.find(r=>r.id===best.p.zgksId);
 if(!ref){
  if(old){legacyCode=old.printedCode||'';ref=moonSamples.has(old.id)?registry.symbols.find(r=>r.id==='1470'):referenceByCode(legacyCode,registry,{legacy:true});}
  else{
   const read=symbol.printedText?{display:symbol.printedText,confidence:1}:readPrintedCode(symbol.feature,references);
   if(read){legacyCode=read.display;ref=referenceByCode(legacyCode,registry,{legacy:true});}
  }
 }
 if(!ref)return null;
 return {...symbol,...context,legacyCode,recognizedCode:ref.type==='skip'?'':legacyCode||ref.code,serviceKey:ref.type==='skip'?'free':'zgks:'+ref.id+(context.contextKey==='home'?'':'|'+context.contextKey)};
}
export function zgksIdFor(group){return /^zgks:(\d+)(?:\||$)/.exec(group.serviceKey||'')?.[1]||'';}
export function selectZGKSDefinition(group,id,registry,{year,month}){
 const ref=[...registry.symbols,...strokeLegend(registry)].find(r=>r.id===String(id));if(!ref)return null;
 const date=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';
 const context=group.contextKey?group:contextFor(group),needsDepartment=(context.otherDepartment||context.requiresDepartment)&&!context.departmentLabel;
 const partial=group.partCount>1&&ref.type!=='skip';
 return {definition:{code:ref.code,name:ref.name,type:partial?'shift':ref.type,start:partial?'':ref.start,end:partial?'':ref.end,department:ref.strokeCode?'Stroke Unit':context.departmentLabel||'',otherDepartment:!!context.otherDepartment||!!ref.strokeCode,requiresDepartment:!!context.requiresDepartment||!!ref.strokeCode},period:(date>=ref.validFrom?'from:':'before:')+ref.validFrom,id:ref.baseId||ref.id,strokeCode:ref.strokeCode||'',source:'manual',reason:partial?'Mehrere Dienste an diesem Tag: Ergänze die Uhrzeiten für diesen Eintrag. Die Legende beschreibt den ganzen Dienst.':needsDepartment&&ref.type!=='skip'?'Ergänze noch die Abteilung. Name und Zeiten sind bereits hinterlegt.':''};
}
export function zgksDefinition(group,profiles,registry,{year,month}){
 const id=zgksIdFor(group),ref=registry.symbols.find(r=>r.id===id);if(!ref)return null;
 const date=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';
 const valid=date>=ref.validFrom,period=(valid?'from:':'before:')+ref.validFrom;
 const custom=profiles.filter(p=>p.zgksId===id&&p.zgksPeriod===period&&contextMatches(group,p)&&validateDefinition(p.definition)).at(-1);
 if(custom)return {definition:{...custom.definition},period,id,source:'custom',reason:''};
 let reason='';
 if(!valid)reason='Diese Vorlage gilt erst ab '+(ref.kind==='presence'?'1. Januar 2027':'1. Oktober 2026')+'. Bitte die Angaben für diesen Plan ergänzen.';
 else if((group.otherDepartment||group.requiresDepartment)&&!group.departmentLabel)reason='Ergänze noch die Abteilung. Name und Zeiten sind bereits hinterlegt.';
 const stroke=strokeTypes[group.strokeCode];
 const definition={code:stroke?group.strokeCode:ref.code,name:stroke?stroke.name:ref.name,type:valid?ref.type:'',start:valid?ref.start:'',end:valid?ref.end:'',department:group.departmentLabel||'',otherDepartment:!!group.otherDepartment,requiresDepartment:!!group.requiresDepartment};
 if(valid&&group.partCount>1&&ref.type!=='skip'){definition.type='shift';definition.start='';definition.end='';reason='Mehrere Dienste an diesem Tag: Ergänze die Uhrzeiten für diesen Eintrag. Die Legende beschreibt den ganzen Dienst.';}
 return {definition,period,id,source:'official',reason};
}
