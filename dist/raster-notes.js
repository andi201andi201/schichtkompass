// Local contour reader for the short labels below the duty cells. The templates
// contain silhouettes of ZusA, DIV and MN, without any personal roster data.
import templates from './supplement-templates.json' with {type:'json'};
export function noteMask(rgb,width,height){
 if(!width||!height)return null;const bits=new Uint8Array(width*height);
 for(let i=0;i<bits.length;i++){const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2];bits[i]=Math.max(r,g,b)<135&&Math.max(r,g,b)-Math.min(r,g,b)<65?1:0}
 // Remove thin grid lines, keeping narrow letters such as I.
 for(let x=0;x<width;x++){let count=0;for(let y=0;y<height;y++)count+=bits[y*width+x];if(count>height*.86)for(let y=0;y<height;y++)bits[y*width+x]=0}
 for(let y=0;y<height;y++){let count=0;for(let x=0;x<width;x++)count+=bits[y*width+x];if(count>width*.9)bits.fill(0,y*width,(y+1)*width)}
 const points=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(bits[y*width+x])points.push([x,y]);if(points.length<8)return null;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0+1,h=Math.max(...ys)-y0+1;if(w<4||h<4)return null;
 const mask=[];for(let y=0;y<24;y++)for(let x=0;x<64;x++){let n=0;for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)n+=bits[(y0+Math.min(h-1,Math.floor((y+(sy+.5)/2)*h/24)))*width+x0+Math.min(w-1,Math.floor((x+(sx+.5)/2)*w/64))];mask.push(n/4)}
 return{mask,aspect:w/h};
}
function score(a,b){let best=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let intersection=0,union=0;for(let y=0;y<24;y++)for(let x=0;x<64;x++){const av=a.mask[y*64+x],bv=x+dx>=0&&x+dx<64&&y+dy>=0&&y+dy<24?b.mask[(y+dy)*64+x+dx]:0;intersection+=Math.min(av,bv);union+=Math.max(av,bv)}best=Math.max(best,union?intersection/union:0)}return best*Math.exp(-Math.abs(Math.log(a.aspect/b.aspect))*.2)}
export function readSupplement(rgb,width,height){
 const query=noteMask(rgb,width,height);if(!query)return null;const scores=new Map();for(const ref of templates){const value=score(query,ref);if(value>(scores.get(ref.code)||0))scores.set(ref.code,value)}const ranked=[...scores].sort((a,b)=>b[1]-a[1]);if(!ranked.length||ranked[0][1]<.73||ranked[1]&&ranked[0][1]-ranked[1][1]<.07)return null;return{code:ranked[0][0],confidence:ranked[0][1]};
}
export function supplementStripe(rgb,width,height){
 if(!width||!height)return'';for(let y=0;y<height;y++){let orange=0,pink=0;for(let x=Math.floor(width*.1);x<width*.9;x++){const i=(y*width+x)*3,r=rgb[i],g=rgb[i+1],b=rgb[i+2];if(r>190&&g>65&&g<190&&b<95)orange++;if(r>180&&b>150&&g<180&&r-g>45)pink++}if(orange>width*.55)return'ZusA';if(pink>width*.55)return'DIV'}return'';
}
