// A small, on-device OCR reader for the printed duty codes in this hospital's
// pictograms. It compares character contours, not background or frame colours.
const maskCache=new WeakMap();
export function normalizeCode(code){return String(code||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
export function characterMask(feature){
 if(!feature||feature.length!==1200)return null;
 if(maskCache.has(feature))return maskCache.get(feature);
 // Ignore the outer coloured frame. Estimate the background from the interior
 // boundary, then make even faint blue letters independent of the fill colour.
 const lo=3,hi=17,pixels=[],boundary=[];
 for(let y=lo;y<hi;y++)for(let x=lo;x<hi;x++){const i=(y*20+x)*3,p=[feature[i],feature[i+1],feature[i+2]];pixels.push({x,y,p});if(x===lo||x===hi-1||y===lo||y===hi-1)boundary.push(p)}
 const bg=[0,1,2].map(c=>quantile(boundary.map(p=>p[c]),.5));
 const differences=pixels.map(({p})=>Math.sqrt(p.reduce((n,v,c)=>n+(v-bg[c])**2,0)));
 const contrast=quantile(differences,.9);if(contrast<12){maskCache.set(feature,null);return null}
 const threshold=Math.max(10,contrast*.4),mask=pixels.map((p,i)=>differences[i]>threshold?1:0),points=pixels.filter((p,i)=>mask[i]);
 if(points.length<7||points.length>pixels.length*.88){maskCache.set(feature,null);return null}
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const width=maxX-minX+1,height=maxY-minY+1;if(width<3||height<4){maskCache.set(feature,null);return null}
 const out=new Float32Array(400);const scale=Math.min(16/width,16/height),ox=(20-width*scale)/2,oy=(20-height*scale)/2;
 // Supersample the normalized silhouette to tolerate resampling differences
 // between Safari, Chrome and image/PDF decoders.
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){let value=0;for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){const px=Math.floor((x+(sx+.5)/2-ox)/scale)+minX,py=Math.floor((y+(sy+.5)/2-oy)/scale)+minY;if(px>=lo&&px<hi&&py>=lo&&py<hi)value+=mask[(py-lo)*(hi-lo)+px-lo]||0}out[y*20+x]=value/4}
 const result={mask:out,aspect:width/height};maskCache.set(feature,result);return result;
}
function shapeScore(a,b){let best=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let intersection=0,union=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const av=a.mask[y*20+x],bv=(x+dx>=0&&x+dx<20&&y+dy>=0&&y+dy<20)?b.mask[(y+dy)*20+x+dx]:0;intersection+=Math.min(av,bv);union+=Math.max(av,bv)}best=Math.max(best,union?intersection/union:0)}return best*Math.exp(-Math.abs(Math.log(a.aspect/b.aspect))*.15)}
export function readPrintedCode(feature,references,profiles=[]){
 const query=characterMask(feature);if(!query)return null;const scores=new Map();
 for(const ref of [...references,...profiles]){const printed=ref.printedCode||ref.definition?.code;if(!printed||ref.serviceKey==='free'||ref.definition?.type==='skip')continue;const code=normalizeCode(printed);if(!code)continue;const sample=characterMask(ref.feature);if(!sample)continue;const score=shapeScore(query,sample),previous=scores.get(code);if(!previous||score>previous.confidence)scores.set(code,{code,display:printed,confidence:score})}
 const ranked=[...scores.values()].sort((a,b)=>b.confidence-a.confidence),best=ranked[0];
 if(!best||best.confidence<.78||(ranked[1]&&best.confidence-ranked[1].confidence<.055))return null;
 return best;
}
