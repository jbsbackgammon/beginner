import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS,eligibleEventPlayers,isEventEntrant,canRegisterSelection} from '../src/ranking.mjs';

const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const helperStart=js.indexOf('function twoScoreOptions(');
const helperEnd=js.indexOf('function renderEntry(){',helperStart);
const outcomeStart=js.indexOf('function setWinner(form,side){');
const outcomeEnd=js.indexOf('// Keep each player\'s name dropdown',outcomeStart);
assert.ok(helperStart>=0&&helperEnd>helperStart&&outcomeEnd>outcomeStart);
const {pointsScoreOptions,setWinner}=Function('updateSubmitEnabled',js.slice(helperStart,helperEnd)+'\n'+js.slice(outcomeStart,outcomeEnd)+'\nreturn {pointsScoreOptions,setWinner}')(()=>{});
const options=html=>[...html.matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[1],selected:/\sselected/.test(m[2]),label:m[3]}));

const players=[{id:1,name:'左選手',entries:['day1','cube','two']},{id:2,name:'右選手',entries:['day1','cube','two']}];
const env={edition:{players,matches:[]},event:'day1',editing:null,pair:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=Function('ctx','eventById','isEventEntrant','eligibleEventPlayers','esc',`
 const ed=()=>ctx.edition,activeEvent=ctx.event,editingMatch=ctx.editing,preselectedPair=ctx.pair;
 const resultsFor=id=>ctx.edition.matches.filter(m=>m.event===id);
 const availableWaitingPlayers=()=>[],unplayedPairs=()=>[],pairingTable=()=>' ',historyTable=()=>' ',historySearch='';
 ${js.slice(js.indexOf('function playerOptions('),js.indexOf('function renderEditionPicker(){'))}
 ${js.slice(js.indexOf('function matchPlayerField('),js.indexOf('function updateSubmitEnabled(form){'))}
 return renderEntry();
`);
const renderPage=ctx=>render(ctx,id=>EVENTS.find(e=>e.id===id),isEventEntrant,eligibleEventPlayers,esc);
const scoreHtml=html=>html.match(/<select name="points"[^>]*>(.*?)<\/select>/)?.[1];

class FakeSelect{
 constructor(html){this.innerHTML=html;}
 set innerHTML(html){this.html=html;this.value=(options(html).find(o=>o.selected)||options(html)[0])?.value||'';}
 get innerHTML(){return this.html;}
}
function formFor(kind='points'){
 const score=new FakeSelect(pointsScoreOptions(kind,'a'));
 const buttons=['a','b'].map(side=>({dataset:{winnerButton:side},classList:{toggle(){}},setAttribute(){},textContent:''}));
 return {score,form:{dataset:{kind,winner:'a'},elements:{namedItem:name=>name==='points'?score:null},querySelectorAll:()=>buttons,querySelector:()=>null}};
}

test('result entry uses 番号, not No., on both player number fields',()=>{
 const html=renderPage(env);
 assert.equal((html.match(/placeholder="番号"/g)||[]).length,2);
 assert.doesNotMatch(html,/placeholder="No\."/);
});

test('point-event score choices mirror when the right player wins',()=>{
 const forward=options(pointsScoreOptions('points','a'));
 const reverse=options(pointsScoreOptions('points','b'));
 assert.deepEqual(forward.slice(1).map(o=>o.label),['1-0 シングル勝ち','2-0 ギャモン勝ち','3-0 バックギャモン勝ち']);
 assert.deepEqual(reverse.slice(1).map(o=>o.label),['0-1 シングル勝ち','0-2 ギャモン勝ち','0-3 バックギャモン勝ち']);
 assert.deepEqual(forward.map(o=>o.value),reverse.map(o=>o.value));
});

test('cube-event choices also mirror up to 12 points',()=>{
 assert.deepEqual(options(pointsScoreOptions('cube','b')).slice(1).map(o=>o.label),['0-1','0-2','0-3','0-4','0-6','0-8','0-12']);
});

test('switching winning side updates all visible scores without losing a selected point value',()=>{
 for(const kind of ['points','cube']){
  const {form,score}=formFor(kind);
  score.value='2';
  setWinner(form,'b');
  assert.equal(score.value,'2');
  assert.equal(options(score.innerHTML).find(o=>o.selected)?.label,'0-2'+(kind==='points'?' ギャモン勝ち':''));
  assert.equal(canRegisterSelection(kind,form.dataset.winner),true);
  setWinner(form,'a');
  assert.equal(score.value,'2');
  assert.equal(options(score.innerHTML).find(o=>o.selected)?.label,'2-0'+(kind==='points'?' ギャモン勝ち':''));
 }
});

test('saved right-win result initially shows the reversed score without altering the saved match',()=>{
 for(const event of ['day1','cube']){
  const match={id:'m1',event,a:1,b:2,sa:0,sb:2};
  const html=renderPage({...env,event,editing:'m1',edition:{...env.edition,matches:[match]}});
  assert.match(html,/data-winner="b"/);
  const chosen=options(scoreHtml(html)).find(o=>o.selected);
  assert.equal(chosen?.value,'2');
  assert.equal(chosen?.label,event==='day1'?'0-2 ギャモン勝ち':'0-2');
  assert.deepEqual([match.sa,match.sb],[0,2]);
 }
});

test('2pt match dropdown retains its right-win scores as before',()=>{
 const html=renderPage({...env,event:'two'});
 assert.match(html,/<option value="2-0"/);
 assert.match(html,/<option value="2-1"/);
});
