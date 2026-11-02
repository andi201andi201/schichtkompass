import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSupplement,supplementStripe} from '../dist/raster-notes.js';
import {annotateSymbol,definitionFor,FREE_DEFINITION,isEmptySymbol} from '../dist/symbol-registry.js';
import {groupSymbols,makeICS,validateDefinition} from '../dist/core.js';
import {contextFor,registeredContext} from '../dist/duty-context.js';
const refs=JSON.parse(readFileSync(new URL('../dist/hospital-symbols.json',import.meta.url)));
const crops=JSON.parse(readFileSync(new URL('./fixtures/supplement-crops.json',import.meta.url)));
const A={code:'A',name:'Frühdienst',type:'shift',start:'07:00',end:'16:00'};
test('Alte falsche ZusA-Registrierungen können leere Kästchen nicht zu Diensten machen',()=>{
 for(const index of [0,4,7,18,54]){
  const blank=refs[index],bad={...blank,definition:{...A,code:'ZusA',name:'Zusätzlich geplant'}};
  const cell=annotateSymbol({...blank,day:3,note:'ZusA'},refs,[bad]);
  assert.equal(cell.serviceKey,'free');assert.deepEqual(definitionFor(cell,[bad],refs),FREE_DEFINITION);
  assert.deepEqual(definitionFor({...cell,serviceKey:'code:ZUSA'},[bad],refs),FREE_DEFINITION);
 }
 // A new flat background also stays free; faint printed letters stay duties.
 assert.equal(isEmptySymbol(Array(1200).fill(170),refs),true);
 for(const index of [60,63])assert.equal(isEmptySymbol(refs[index].feature,refs),false);
});
test('ZusA, DIV und MN aus den gelieferten Bildausschnitten werden lokal gelesen',()=>{
 for(const sample of crops)assert.equal(readSupplement(sample.rgb,sample.width,sample.height)?.code,sample.code,sample.code);
 assert.equal(readSupplement(Array(96*40*3).fill(255),96,40),null);
 const stripe=color=>Array.from({length:40*8},()=>color).flat();
 assert.equal(supplementStripe(stripe([255,130,0]),40,8),'ZusA');
 assert.equal(supplementStripe(stripe([252,122,255]),40,8),'DIV');
 assert.equal(supplementStripe(stripe([250,155,145]),40,8),'');
});
test('ZusA und DIV benötigen eigene erste Zuordnungen, keine erfundene Abteilung',()=>{
 const home=annotateSymbol({...refs[30],day:1},refs);
 const extra=annotateSymbol({...refs[30],day:2,note:'ZusA'},refs);
 const div=annotateSymbol({...refs[30],day:3,note:'DIV'},refs);
 const {groups}=groupSymbols([home,extra,div]);assert.equal(groups.length,3);
 const saved={...home,definition:A};
 assert.equal(definitionFor(extra,[saved],refs),null);assert.equal(definitionFor(div,[saved],refs),null);
 assert.equal(extra.requiresDepartment,false);assert.deepEqual(extra.supplementLabels,['Zusätzlich geplant']);
 assert.equal(validateDefinition({...A,requiresDepartment:extra.requiresDepartment}),true);
 const assigned={...extra,definition:A};
 assert.deepEqual(definitionFor(extra,[assigned],refs),A);assert.equal(definitionFor(div,[assigned],refs),null);
 const c=annotateSymbol({...refs[29],note:'DIV'},refs);assert.equal(definitionFor(c,[],refs),null);
});
test('MN und kombinierte Zusätze erhalten Abteilung und Zuordnung getrennt',()=>{
 const mn=annotateSymbol({...refs[42],day:2,note:'MN ZusA'},refs);
 assert.equal(mn.departmentLabel,'Medizin Nord');assert.equal(mn.contextKey,'other:MN|extra:ZUSA');
 assert.equal(mn.requiresDepartment,true);
 assert.equal(registeredContext({contextKey:'other:unassigned|extra:ZUSA'},{department:'Medizin Nord'}),'other:MN|extra:ZUSA');
 assert.equal(contextFor({...refs[30],note:'ZusA StU'}).contextKey,contextFor({...refs[30],note:'StU ZusA'}).contextKey);
});
test('Bestätigte Ausnahmen stehen beim zugehörigen Tag im Kalender; Blank bleibt ohne Termin',async()=>{
 const cells=[annotateSymbol({...refs[0],day:1,note:'ZusA'},refs),annotateSymbol({...refs[30],day:2,note:'DIV'},refs),annotateSymbol({...refs[42],day:3,note:'MN ZusA'},refs)];
 const entries=cells.map(c=>({...c,definition:c.serviceKey==='free'?FREE_DEFINITION:{...A,department:c.departmentLabel}}));
 const ics=(await makeICS({year:2026,month:11,entries})).replace(/\r\n[ \t]/g,'');
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.match(ics,/SUMMARY:Frühdienst · Weiterbildung divers \(DIV\)/);
 assert.match(ics,/SUMMARY:Frühdienst · Medizin Nord · Zusätzlich geplant \(ZusA\)/);
 assert.match(ics,/DTSTART;TZID=Europe\/Zurich:20261103T070000/);
});
