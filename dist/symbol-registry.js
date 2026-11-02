import {featureDistance,validateDefinition} from './core.js';
import {readPrintedCode,normalizeCode,characterMask} from './code-reader.js';
import {contextFor,contextMatches} from './duty-context.js';

export const FREE_DEFINITION=Object.freeze({code:'Frei',name:'Frei',type:'skip',start:'',end:''});
export const C_DEFINITION=Object.freeze({code:'C',name:'Spätdienst',type:'shift',start:'14:00',end:'23:00'});

// Only documented equivalences are shared across images. Similarity alone must
// never turn a faint symbol into a free day or combine unrelated duty codes.
export function referenceFor(feature,references){
 const ranked=references.map(r=>({ref:r,distance:featureDistance(feature,r.feature)})).sort((a,b)=>a.distance-b.distance);
 const best=ranked[0];if(!best||best.distance>.085)return null;
 const key=r=>r.serviceKey||r.id;
 if(ranked.some(r=>r.distance<best.distance+.015&&key(r.ref)!==key(best.ref)))return null;
 return best.ref;
}
export function annotateSymbol(symbol,references,profiles=[]){
 const context=contextFor(symbol);
 const identified=(key,extra={})=>({...symbol,...context,...extra,serviceKey:key==='free'?key:key+(context.contextKey==='home'?'':'|'+context.contextKey)});
 // A blank is a free day even if an older saved profile called it ZusA.
 // Inspect the actual cell before consulting any user-labelled OCR samples.
 const ref=referenceFor(symbol.feature,references);
 if(ref?.serviceKey==='free'||isEmptySymbol(symbol.feature,references))return identified('free',{recognizedCode:''});
 const read=symbol.printedText?{code:normalizeCode(symbol.printedText),display:symbol.printedText,confidence:1}:readPrintedCode(symbol.feature,references,profiles);
 if(read?.code)return identified('code:'+read.code,{recognizedCode:read.display,codeConfidence:read.confidence});
 if(!ref)return{...symbol,...context};
 if(ref.printedCode)return identified('code:'+normalizeCode(ref.printedCode),{recognizedCode:ref.printedCode});
 return identified(ref.serviceKey||ref.id);
}
export function isEmptySymbol(feature,references){
 const ref=referenceFor(feature,references);if(ref)return ref.serviceKey==='free';
 if(!feature||feature.length!==1200||characterMask(feature))return false;
 // A uniformly empty interior may have a different frame or background hue.
 let variation=0;for(let c=0;c<3;c++){const values=[];for(let y=4;y<16;y++)for(let x=4;x<16;x++)values.push(feature[(y*20+x)*3+c]);const mean=values.reduce((a,b)=>a+b,0)/values.length;variation+=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length}
 return Math.sqrt(variation/3)<5;
}
export function definitionFor(symbol,profiles,references){
 const ref=referenceFor(symbol.feature,references),key=symbol.serviceKey||(ref?.printedCode?'code:'+normalizeCode(ref.printedCode):ref?.serviceKey||ref?.id);
 if(key==='free'||isEmptySymbol(symbol.feature,references))return{...FREE_DEFINITION};
 const context=symbol.contextKey?symbol:contextFor(symbol);
 const eligible=profiles.filter(p=>contextMatches(context,p)&&validateDefinition({...p.definition,requiresDepartment:context.requiresDepartment??/^(other|unit):/.test(context.contextKey)}));
 const code=symbol.recognizedCode?normalizeCode(symbol.recognizedCode):key?.startsWith('code:')?key.slice(5).split('|')[0]:null;
 const codeProfiles=eligible.filter(p=>code&&validateDefinition(p.definition)&&normalizeCode(p.definition.code)===code);
 if(codeProfiles.length)return{...codeProfiles.at(-1).definition};
 if(code)return code==='C'&&context.contextKey==='home'?{...C_DEFINITION}:null;
 // Reuse an existing registration for another confirmed image of the same duty.
 const sameFamily=eligible.filter(p=>validateDefinition(p.definition)&&((p.serviceKey||referenceFor(p.feature,references)?.serviceKey||referenceFor(p.feature,references)?.id)===key?.split('|')[0])&&key);
 if(sameFamily.length)return{...sameFamily.at(-1).definition};
 const ranked=eligible.filter(p=>validateDefinition(p.definition)).map(p=>({p,d:featureDistance(symbol.feature,p.feature)})).sort((a,b)=>a.d-b.d);
 const best=ranked[0];if(best&&best.d<=.085&&!ranked.some(r=>r.d<best.d+.02&&JSON.stringify(r.p.definition)!==JSON.stringify(best.p.definition)))return{...best.p.definition};
 return (key==='C'||code==='C')&&context.contextKey==='home'?{...C_DEFINITION}:null;
}
