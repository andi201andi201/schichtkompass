import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPrintedCode} from '../dist/code-reader.js';
import {annotateSymbol,definitionFor,C_DEFINITION} from '../dist/symbol-registry.js';
import {groupSymbols} from '../dist/core.js';
const refs=JSON.parse(readFileSync(new URL('../dist/hospital-symbols.json',import.meta.url)));
const phone=JSON.parse(readFileSync(new URL('./fixtures/phone-glyphs.json',import.meta.url)));

test('Beide C-Zeichen aus dem gemeldeten iPhone-Screenshot werden gelesen',()=>{
 for(const sample of phone.slice(0,2))assert.equal(readPrintedCode(sample.feature,refs)?.code,'C');
 const {groups}=groupSymbols(phone.slice(0,2).map((s,i)=>annotateSymbol({...s,day:i+6},refs)));
 assert.equal(groups.length,1);assert.equal(groups[0].recognizedCode,'C');
 assert.deepEqual(definitionFor(groups[0],[],refs),C_DEFINITION);
});
test('Ein Halbmond aus demselben Screenshot ist kein Buchstabe C',()=>{
 assert.equal(readPrintedCode(phone[2].feature,refs),null);
});
test('Buchstaben werden unabhängig von Rahmen und Füllfarbe erkannt',()=>{
 const source=refs[29].feature;
 const changed=source.map((v,i)=>{const pixel=Math.floor(i/3),x=pixel%20,y=Math.floor(pixel/20),c=i%3;if(x<3||x>=17||y<3||y>=17)return [30,180,100][c];const p=source.slice(pixel*3,pixel*3+3);const blue=p[2]-Math.min(p[0],p[1]);return blue>90?[25,45,65][c]:[130,170,190][c]});
 assert.equal(readPrintedCode(changed,refs)?.code,'C');
});
test('A und PIL werden nach Kürzel und Abteilung gruppiert',()=>{
 for(const [indices,expected] of [[[20,26,31,33,42,47],'A'],[[21,62,65],'PIL']]){
  const cells=indices.map((n,i)=>annotateSymbol({...refs[n-1],day:i+1},refs));
  const result=groupSymbols(cells);assert.equal(result.groups.length,2);assert.ok(result.groups.every(g=>g.recognizedCode===expected));assert.ok(result.groups.some(g=>g.contextKey==='home'));assert.ok(result.groups.some(g=>g.otherDepartment));
 }
});
test('Eine registrierte Zeit gilt über das gelesene Kürzel auch für andere Zeichenbilder',()=>{
 const saved={feature:Array(1200).fill(0),definition:{code:'PIL',name:'Praxisbegleitung',type:'shift',start:'08:00',end:'16:00'}};
 const read=annotateSymbol(refs[20],refs);
 assert.deepEqual(definitionFor(read,[saved],refs),saved.definition);
});
