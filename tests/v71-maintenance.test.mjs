import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {
  EVENTS, eventById, validMatch, ensureMatchNumbers, migrateReservedWaiting,
  canRegisterSelection, isEventEntrant, nextMatchNumber, returnPlayersToWaiting
} from '../src/ranking.mjs';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const pick=(from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,`missing function ${from}`);
  return source.slice(a,b);
};
const eventIds=EVENTS.filter(e=>e.id!=='overall').map(e=>e.id);
const normalizeImport=runInNewContext(`${pick('function normalizeImport(x){','function fileLoad(){')}\nnormalizeImport`,{
  eventIds,validMatch,ensureMatchNumbers,migrateReservedWaiting,DEFAULT_VENUE:'ワイヤーズホテル品川シーサイド'
});

test('old JSON schema retains tournament data, staff flag and match numbers',()=>{
 const src={schema:1,editions:[{
  id:'2026',name:'大会',players:[
   {id:1,name:'一般',entries:['day1','two','unknown']},
   {id:2,name:'スタッフ',excludeFromRanking:true,entries:['day1','two']},
  ],matches:[{id:'older',event:'day1',a:1,b:2,sa:3,sb:0}],
  waitingPlayers:{day1:[1,2]},dates:{day1:'2026-10-10'}
 }]};
 const result=normalizeImport(structuredClone(src));
 const edition=result.editions[0];
 assert.equal(result.schema,1);
 assert.equal(edition.venue,'ワイヤーズホテル品川シーサイド');
 assert.equal(edition.matches[0].matchNo,1);
 assert.equal(edition.nextMatchNumbers.day1,2);
 assert.equal(edition.players[1].excludeFromRanking,true);
 assert.deepEqual(Array.from(edition.players[0].entries),['day1','two']);
 assert.deepEqual(JSON.parse(JSON.stringify(edition.waitingPlayers)),{day1:[1,2]});
 assert.equal(edition.dates.day1,'2026-10-10');
});

test('CSV still escapes formula-like names and keeps the BOM and CRLF',()=>{
 const row={rank:1,id:1,name:'=SUM(1,2)',matches:2,wins:1,losses:1,draws:0,spread:0,rate:0.5,scored:2,conceded:-2,diff:0,selectedDays:['day1','day3']};
 const asCSV=runInNewContext(`${pick('function asCSV(id){','function download(')}\nasCSV`,{
  ed:()=>({}),standings:()=>[row],formatRate:n=>`${(n*100).toFixed(1)}%`,dayName:x=>x
 });
 const result=asCSV('two');
 assert.ok(result.startsWith('\ufeff'));
 assert.ok(result.includes('"\'=SUM(1,2)"'));
 assert.ok(result.includes('"引分","勝越","勝率","得点","失点","得失点差"'));
 assert.ok(result.includes('\r\n'));
});

function saveResult({event='day1',winner='b',editing=null,score=3}={}){
 const edition={players:[{id:1,name:'選手1',entries:[event]},{id:2,name:'選手2',entries:[event]}],matches:[],waitingPlayers:{[event]:[]},nextMatchNumbers:{[event]:1}};
 if(editing){
  edition.matches=[{id:'old',event,a:1,b:2,sa:3,sb:0,matchNo:7}];
  edition.nextMatchNumbers[event]=8;
  edition.lastResultRegisteredAt=1234;
 }
 const form={dataset:{winner},fake:{a_no:'1',b_no:'2',result:winner==='draw'?'1-1':'0-2',points:String(score)}};
 let saves=0,renders=0,confirmChecks=0;
 const context={
  FormData:class {constructor(f){this.values=f.fake;}get(k){return this.values[k];}},
  ed:()=>edition,activeEvent:event,data:{editions:[edition]},editingMatch:editing?'old':null,
  preselectedPair:null,validMatch,eventById,isEventEntrant,canRegisterSelection,nextMatchNumber,returnPlayersToWaiting,
  evLabel:id=>id,needsTournamentConfirmation:()=>{confirmChecks++;return false;},
  alert:message=>{throw Error('Unexpected alert: '+message);},confirm:()=>true,
  save:()=>saves++,render:()=>renders++,notice:()=>{}
 };
 const code=pick('function matchSave(form){','// All fields are quoted.');
 runInNewContext(`${code}\nmatchSave(form)`,{...context,form});
 return {edition,saves,renders,confirmChecks};
}

test('new result registration still records the reversed score and event match number',()=>{
 const {edition,saves,renders}=saveResult();
 assert.equal(edition.matches.length,1);
 assert.equal(edition.matches[0].matchNo,1);
 assert.deepEqual([edition.matches[0].sa,edition.matches[0].sb],[0,3]);
 assert.deepEqual(edition.waitingPlayers.day1,[1,2]);
 assert.equal(saves,1);assert.equal(renders,1);
});

test('correction retains original match ID/number and registration timestamp',()=>{
 const {edition,confirmChecks}=saveResult({winner:'a',editing:true});
 assert.equal(edition.matches.length,1);
 assert.equal(edition.matches[0].id,'old');
 assert.equal(edition.matches[0].matchNo,7);
 assert.deepEqual([edition.matches[0].sa,edition.matches[0].sb],[3,0]);
 assert.equal(edition.lastResultRegisteredAt,1234);
 assert.equal(confirmChecks,0);
});
