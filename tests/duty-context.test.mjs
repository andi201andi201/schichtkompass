import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasRedBackground,notesBelowRow,contextFor} from '../dist/duty-context.js';
import {annotateSymbol,definitionFor} from '../dist/symbol-registry.js';
import {groupSymbols,makeICS,validateDefinition} from '../dist/core.js';
const refs=JSON.parse(readFileSync(new URL('../dist/hospital-symbols.json',import.meta.url)));
const A={code:'A',name:'A-Dienst',type:'shift',start:'07:00',end:'16:00'};
test('Rote Füllung wird von einem roten Rahmen unterschieden',()=>{
 assert.equal(hasRedBackground(refs[29].feature),false);
 assert.equal(hasRedBackground(refs[31].feature),false);
 assert.equal(hasRedBackground(refs[42].feature),true);
});
test('Zusätze gehören nur zur darunterliegenden Zusatzzeile der ausgewählten Dienstzeile',()=>{
 const rect={x:0,y:100,w:60,h:20};
 const items=[{text:'StU',x:1,y:97},{text:'C',x:1,y:112},{text:'StU',x:21,y:127},{text:'ZusA',x:41,y:128,width:100},{text:'MN',x:1,y:139}];
 assert.deepEqual(notesBelowRow(items,rect,3,[{x:0,y:134,w:20,h:20}]),['','StU','ZusA']);
});
test('Ein Zusatz gehört weiterhin nach oben, wenn seine Grundlinie die nächste Symbolzeile knapp überlappt',()=>{
 const rect={x:573.894,y:373.277,w:676.8,h:22.578};
 const text=[{text:'StU',x:1183.2,y:403.68,height:7.9197},{text:'ZusA',x:1205.76,y:403.68,height:7.9197}];
 const notes=notesBelowRow(text,rect,30,[{x:574.08,y:403.44,w:21.12,h:22.56}]);
 assert.equal(notes[27],'StU');assert.equal(notes[28],'ZusA');
});
test('A Stammabteilung und rotes A Stroke Unit werden separat registriert',()=>{
 const own=annotateSymbol({...refs[30],day:24},refs);
 const stroke=annotateSymbol({...refs[42],day:28,note:'StU'},refs);
 const grouped=groupSymbols([own,stroke]);assert.equal(grouped.groups.length,2);
 assert.equal(stroke.departmentLabel,'Stroke Unit');assert.equal(stroke.contextKey,'other:STU');
 const legacy=[{...refs[30],definition:A}];
 assert.deepEqual(definitionFor(own,legacy,refs),A);
 assert.equal(definitionFor(stroke,legacy,refs),null);
 const assigned={...stroke,contextKey:stroke.contextKey,definition:{...A,department:'Stroke Unit',otherDepartment:true,requiresDepartment:true}};
 assert.deepEqual(definitionFor(stroke,[assigned],refs),assigned.definition);
 assert.equal(definitionFor({...stroke,contextKey:'other:MN'},[assigned],refs),null);
});
test('Roter C-Dienst übernimmt nicht automatisch die C-Zeit der Stammabteilung',()=>{
 const external=annotateSymbol({...refs[13],note:'StU'},refs);
 assert.equal(external.recognizedCode,'C');assert.equal(definitionFor(external,[],refs),null);
});
test('Kalender enthält Stroke Unit und Zusatz ZusA beim richtigen Dienst',async()=>{
 const e={day:28,note:'StU ZusA',departmentCode:'STU',departmentLabel:'Stroke Unit',definition:{...A,department:'Stroke Unit',otherDepartment:true}};
 const s=await makeICS({year:2026,month:11,entries:[e],location:'Spital'});
 assert.match(s,/SUMMARY:A-Dienst · Stroke Unit · Zusätzlich geplant \(ZusA\)/);
 assert.match(s,/LOCATION:Spital · Stroke Unit/);
 assert.match(s.replace(/\r\n[ \t]/g,''),/Zusatz aus der Zeile darunter: StU ZusA/);
 assert.equal(validateDefinition({...A,otherDepartment:true,department:''}),false);
});
