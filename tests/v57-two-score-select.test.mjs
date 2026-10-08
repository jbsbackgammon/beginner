import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS,eligibleEventPlayers,isEventEntrant,canRegisterSelection} from '../src/ranking.mjs';

const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const helpers=js.slice(js.indexOf('function twoScoreOptions('),js.indexOf('function renderEntry(){'));
assert.ok(helpers.startsWith('function twoScoreOptions('));
const outcome=js.slice(js.indexOf('function setWinner(form,side){'),js.indexOf('// Keep each player\'s name dropdown'));
const {twoScoreOptions,setWinner}=Function('updateSubmitEnabled',helpers+'\n'+outcome+'\nreturn {twoScoreOptions,setWinner};')(()=>{});
const options=html=>[...html.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(m=>({value:m[1],selected:/\sselected/.test(m[2])}));

const players=[{id:1,name:'A',entries:['two']},{id:2,name:'B',entries:['two']}];
const env={edition:{players,matches:[]},event:'two',editing:null,pair:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=Function('ctx','eventById','isEventEntrant','eligibleEventPlayers','esc',`
 const ed=()=>ctx.edition;
 const activeEvent=ctx.event;
 const editingMatch=ctx.editing;
 const preselectedPair=ctx.pair;
 const resultsFor=id=>ctx.edition.matches.filter(m=>m.event===id);
 const availableWaitingPlayers=()=>[];
 const unplayedPairs=()=>[];
 const pairingTable=()=>'';
 const historyTable=()=>'';
 const historySearch='';
 ${js.slice(js.indexOf('function playerOptions('),js.indexOf('function renderEditionPicker(){'))}
 ${js.slice(js.indexOf('function matchPlayerField('),js.indexOf('function updateSubmitEnabled(form){'))}
 return renderEntry();
`);
const renderTwo=ctx=>render(ctx,id=>EVENTS.find(e=>e.id===id),isEventEntrant,eligibleEventPlayers,esc);
const scoreSelectHtml=html=>html.match(/<select name="result"[^>]*>(.*?)<\/select>/)?.[1];

class FakeSelect {
 constructor(){this.value='';this._html='';}
 set innerHTML(html){this._html=html;const opts=options(html);this.value=(opts.find(o=>o.selected)||opts[0])?.value||'';}
 get innerHTML(){return this._html;}
}
function fakeForm(){
 const score=new FakeSelect();
 score.innerHTML=twoScoreOptions('a');
 const wins=['a','b'].map(side=>({dataset:{winnerButton:side},classList:{toggle(){}},setAttribute(){},textContent:''}));
 const draw={classList:{toggle(){}},setAttribute(){}};
 const form={dataset:{kind:'two',winner:'a'},elements:{namedItem:name=>name==='result'?score:null},
   querySelectorAll:()=>wins,querySelector:()=>draw};
 return {form,score};
}

test('2pt score dropdown has only the candidates for the chosen winner, in the requested order',()=>{
 assert.deepEqual(options(twoScoreOptions('a')).map(o=>o.value),['','2-0','2-1']);
 assert.deepEqual(options(twoScoreOptions('b')).map(o=>o.value),['','0-2','1-2']);
 assert.deepEqual(options(twoScoreOptions('draw')).map(o=>o.value),['1-1']);
 assert.deepEqual(options(twoScoreOptions('draw')).filter(o=>o.selected).map(o=>o.value),['1-1']);
});

test('new 2pt entries start with the two left-win scores; saved corrections retain their score',()=>{
 const initial=options(scoreSelectHtml(renderTwo(env)));
 assert.deepEqual(initial.map(o=>o.value),['','2-0','2-1']);
 const examples=[
  {sa:2,sb:0,winner:'a',value:'2-0',expected:['','2-0','2-1']},
  {sa:0,sb:2,winner:'b',value:'0-2',expected:['','0-2','1-2']},
  {sa:1,sb:1,winner:'draw',value:'1-1',expected:['1-1']},
 ];
 for(const [i,example] of examples.entries()){
  const match={id:'m'+i,event:'two',a:1,b:2,sa:example.sa,sb:example.sb};
  const html=renderTwo({...env,editing:match.id,edition:{...env.edition,matches:[match]}});
  assert.match(html,new RegExp(`data-winner="${example.winner}"`));
  const items=options(scoreSelectHtml(html));
  assert.deepEqual(items.map(o=>o.value),example.expected);
  assert.deepEqual(items.filter(o=>o.selected).map(o=>o.value),[example.value]);
 }
});

test('changing WIN side clears an invalid prior score; DRAW automatically selects 1-1',()=>{
 const {form,score}=fakeForm();
 score.value='2-1';
 setWinner(form,'b');
 assert.deepEqual(options(score.innerHTML).map(o=>o.value),['','0-2','1-2']);
 assert.equal(score.value,'');
 score.value='1-2';
 setWinner(form,'draw');
 assert.deepEqual(options(score.innerHTML).map(o=>o.value),['1-1']);
 assert.equal(score.value,'1-1');
 assert.equal(canRegisterSelection('two','draw',score.value),true);
 setWinner(form,'a');
 assert.deepEqual(options(score.innerHTML).map(o=>o.value),['','2-0','2-1']);
 assert.equal(score.value,'');
});

test('a draw score remains fixed even when draw is reselected; mismatching results remain invalid',()=>{
 const {form,score}=fakeForm();
 setWinner(form,'draw');
 setWinner(form,'draw');
 assert.equal(score.value,'1-1');
 assert.equal(canRegisterSelection('two','a','1-1'),false);
 assert.equal(canRegisterSelection('two','b','2-0'),false);
 assert.equal(canRegisterSelection('two','draw','1-2'),false);
});

test('choosing players after an early DRAW selection keeps the prefilled 1-1',()=>{
 const start=js.indexOf('function syncMatchPlayer(el){');
 const end=js.indexOf('\nfunction statsTable(',start);
 const resetCalls=[];
 const sync=Function('refreshMatchPlayerOptions','setWinner','updateSubmitEnabled',js.slice(start,end)+'\nreturn syncMatchPlayer;')(
   ()=>{},(_,side)=>resetCalls.push(side),()=>{}
 );
 const inputs={a:{value:''},b:{value:''},a_no:{value:''},b_no:{value:''},result:{value:'1-1'}};
 const form={dataset:{kind:'two',winner:'draw',playerPair:':'},elements:{namedItem:key=>inputs[key]}};
 const el=side=>({tagName:'SELECT',dataset:{matchSide:side},closest:()=>form});
 inputs.a.value='1';sync(el('a'));
 inputs.b.value='2';sync(el('b'));
 assert.equal(form.dataset.winner,'draw');
 assert.equal(inputs.result.value,'1-1');
 assert.deepEqual(resetCalls,[]);
});
