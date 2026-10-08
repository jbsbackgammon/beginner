import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS,eligibleEventPlayers,isEventEntrant} from '../src/ranking.mjs';

const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const start=js.indexOf('function matchPlayerField(');
const end=js.indexOf('\nfunction updateSubmitEnabled(form){',start);
assert.ok(start>=0&&end>start);
const edition={players:[{id:1,name:'一',entries:['day1','two']},{id:2,name:'二',entries:['day1','two']}],matches:[]};
const env={edition,event:'day1',editing:null,pair:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The full entry renderer also requires surrounding page helpers and mutable state.
const makeRender=Function('ctx','eventById','isEventEntrant','eligibleEventPlayers','esc',`
  const ed=()=>ctx.edition;
  const activeEvent=ctx.event;
  const editingMatch=ctx.editing;
  const preselectedPair=ctx.pair;
  const resultsFor=(id)=>ctx.edition.matches.filter(m=>m.event===id);
  const availableWaitingPlayers=()=>[];
  const unplayedPairs=()=>[];
  const pairingTable=()=>'';
  const historyTable=()=>'';
  const historySearch='';
  ${js.slice(js.indexOf('function playerOptions('),js.indexOf('\nfunction renderEditionPicker(){'))}
  ${js.slice(start,end)}
  return renderEntry();
`);
const render=(ctx=env)=>makeRender(ctx,id=>EVENTS.find(x=>x.id===id),isEventEntrant,eligibleEventPlayers,esc);

test('outcome buttons are above both player dropdowns and default to left WIN / right LOSE',()=>{
 const html=render();
 const form=html.slice(html.indexOf('<form id="match-form"'),html.indexOf('</form>')+7);
 assert.match(form,/data-winner="a"/);
 const top=form.match(/<div class="scoreline outcome-row[^]*?<\/div>/)?.[0];
 assert.ok(top,'top row is rendered');
 assert.match(top,/<button[^>]*data-winner-button="a"[^>]*class="winner-button win"[^>]*aria-pressed="true"[^>]*>勝<\/button>/);
 assert.match(top,/<button[^>]*data-winner-button="b"[^>]*class="winner-button lose"[^>]*aria-pressed="false"[^>]*>負<\/button>/);
 assert.ok(form.indexOf('data-winner-button="b"')<form.indexOf('name="a_no"'));
 assert.ok(form.indexOf('data-winner-button="b"')<form.indexOf('name="b_no"'));
 assert.doesNotMatch(top, /<button[^>]*disabled/,'win and loss remain visibly selected without players');
 assert.match(form, /name="points"[^>]*disabled/,'score selection still needs two players');
 assert.match(form, /type="submit"[^>]*disabled/,'submission still needs two players');
});

test('2pt draw button stays between top-row win / loss controls',()=>{
 const html=render({...env,event:'two'});
 assert.ok(html.indexOf('data-winner-button="a"')<html.indexOf('data-draw-button'));
 assert.ok(html.indexOf('data-draw-button')<html.indexOf('data-winner-button="b"'));
 assert.ok(html.indexOf('data-draw-button')<html.indexOf('name="a_no"'));
 assert.match(html,/class="scoreline outcome-row two-entry"/);
 assert.match(html,/<button[^>]*data-draw-button[^>]*>引分<\/button>/);
 assert.doesNotMatch(html.match(/<button[^>]*data-draw-button[^>]*>引分<\/button>/)?.[0]||'',/ disabled/);
});

test('correcting a result reflects the saved outcome, including right-side wins and 2pt draws',()=>{
 const right={id:'right',event:'day1',a:1,b:2,sa:0,sb:3};
 const rightHtml=render({...env,editing:'right',edition:{...edition,matches:[right]}});
 assert.match(rightHtml,/data-winner="b"/);
 assert.match(rightHtml,/data-winner-button="a"[^>]*class="winner-button lose"[^>]*>負<\/button>/);
 assert.match(rightHtml,/data-winner-button="b"[^>]*class="winner-button win"[^>]*>勝<\/button>/);
 const draw={id:'draw',event:'two',a:1,b:2,sa:1,sb:1};
 const drawHtml=render({...env,event:'two',editing:'draw',edition:{...edition,matches:[draw]}});
 assert.match(drawHtml,/data-winner="draw"/);
 assert.match(drawHtml,/data-draw-button aria-pressed="true"/);
 assert.match(drawHtml,/<option value="1-1" selected>/);
});

test('selecting a different pair resets the default to a left-side win',()=>{
 const start=js.indexOf('function syncMatchPlayer(el){');
 const end=js.indexOf('\nfunction statsTable(',start);
 assert.ok(start>=0&&end>start);
 assert.match(js.slice(start,end),/setWinner\(form,'a'\)/);
 assert.match(js.slice(start,end),/if\(hadPair\)setWinner\(form,'a'\)/);
 assert.match(css,/\.entry-form \.scoreline\.outcome-row\s*\{\s*margin-bottom:10px/);
});

test('draw selected before choosing players remains selected until both players are set',()=>{
 const start=js.indexOf('function syncMatchPlayer(el){');
 const end=js.indexOf('\nfunction statsTable(',start);
 const winnerResets=[];
 const sync=Function('refreshMatchPlayerOptions','setWinner','updateSubmitEnabled',js.slice(start,end)+'\nreturn syncMatchPlayer;')(
  ()=>{},(form,side)=>{winnerResets.push(side);form.dataset.winner=side;},()=>{}
 );
 const fields={a:{value:''},b:{value:''},a_no:{value:''},b_no:{value:''},result:{value:''}};
 const form={dataset:{playerPair:':',winner:'draw'},elements:{namedItem:name=>fields[name]}};
 const select=side=>({tagName:'SELECT',dataset:{matchSide:side},closest:()=>form});
 fields.a.value='1';sync(select('a'));
 assert.equal(form.dataset.winner,'draw');
 fields.b.value='2';sync(select('b'));
 assert.equal(form.dataset.winner,'draw');
 assert.deepEqual(winnerResets,[]);
 fields.b.value='3';sync(select('b'));
 assert.equal(form.dataset.winner,'a');
 assert.deepEqual(winnerResets,['a']);
});
