import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {annotateSymbol,definitionFor,referenceFor,FREE_DEFINITION,C_DEFINITION} from '../dist/symbol-registry.js';
import {groupSymbols,makeICS} from '../dist/core.js';
const refs=JSON.parse(readFileSync(new URL('../dist/hospital-symbols.json',import.meta.url)));
const symbol=n=>refs[n-1];

test('Leere graue und farbige Felder gelten ohne Registrierung als frei',()=>{
 for(const n of [1,5,8,19,55]){
  const annotated=annotateSymbol({...symbol(n),day:1},refs);
  assert.equal(annotated.serviceKey,'free');
  assert.deepEqual(definitionFor(annotated,[],refs),FREE_DEFINITION);
 }
});
test('Schwache Buchstaben und kleine Markierungen werden nicht als leer klassifiziert',()=>{
 for(const n of [3,7,9,11,14,16,51,53,54,58,59,61,64,65,76]){
  assert.notEqual(referenceFor(symbol(n).feature,refs)?.serviceKey,'free','Symbol '+n);
 }
});
test('C-Varianten werden als ein Dienst mit drei Tagen zusammengefasst',()=>{
 const cells=[{...symbol(30),day:6},{...symbol(32),day:7},{...symbol(32),day:8}].map(c=>annotateSymbol(c,refs));
 const result=groupSymbols(cells);
 assert.equal(result.groups.length,1);
 assert.deepEqual(result.groups[0].days,[6,7,8]);
 assert.equal(result.groups[0].variants.length,2);
 assert.deepEqual(definitionFor(result.groups[0],[],refs),C_DEFINITION);
});
test('Bestehende Registrierung einer C-Variante gilt für die andere Variante',()=>{
 const saved={...symbol(30),definition:{...C_DEFINITION,name:'Mein Spätdienst'}};
 assert.equal(definitionFor(annotateSymbol(symbol(32),refs),[saved],refs).name,'Mein Spätdienst');
});
test('Nur Diensttermine werden exportiert, leere Felder erzeugen keine Termine',async()=>{
 const cells=[{...symbol(1),day:1},{...symbol(19),day:2},{...symbol(30),day:6},{...symbol(32),day:7},{...symbol(32),day:8}].map(c=>annotateSymbol(c,refs));
 const {groups,cells:assigned}=groupSymbols(cells);
 groups.forEach(g=>g.definition=definitionFor(g,[],refs));
 const entries=assigned.map(c=>({...c,definition:groups.find(g=>g.id===c.groupId).definition}));
 const calendar=await makeICS({year:2026,month:11,entries});
 assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,3);
 assert.equal((calendar.match(/SUMMARY:Spätdienst/g)||[]).length,3);
 assert.match(calendar,/DTSTART;TZID=Europe\/Zurich:20261106T140000/);
 assert.match(calendar,/DTEND;TZID=Europe\/Zurich:20261106T230000/);
 assert.ok(!calendar.includes('SUMMARY:Frei'));
});
