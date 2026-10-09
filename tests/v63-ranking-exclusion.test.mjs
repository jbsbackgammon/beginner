import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EVENTS,standings,isEventEntrant,eligibleEventPlayers,validMatch,unplayedPairs} from '../src/ranking.mjs';

const mk=()=>({players:[
  {id:1,name:'一般A',entries:['day1','day2','day3','two','cube','school']},
  {id:2,name:'一般B',entries:['day1','day2','day3','two','cube','school']},
  {id:3,name:'一般C',entries:['day1','day2','day3','two','cube','school']},
  {id:4,name:'スタッフ',excludeFromRanking:true,entries:['day1','day2','day3','two','cube','school']},
],matches:[],waitingPlayers:{day1:[1,2,3,4]}});

const m=(event,a,b,sa,sb)=>({id:`${event}-${a}-${b}`,event,a,b,sa,sb});

test('global checkbox excludes staff from each event while counting the opponent match',()=>{
 const ed=mk();
 for(const e of EVENTS.filter(e=>e.id!=='overall')){
   const [sa,sb]=e.id==='two'?[2,0]:[3,0];
   ed.matches.push(m(e.id,1,4,sa,sb));
   assert.equal(validMatch(m(e.id,1,4,sa,sb),new Set([1,2,3,4])),'');
   assert.equal(isEventEntrant(ed,e.id,4),true,'excluded staff stays eligible for results');
   assert.ok(eligibleEventPlayers(ed,e.id).some(p=>p.id===4));
   assert.deepEqual(standings(ed,e.id).map(r=>r.id),[1]);
   const a=standings(ed,e.id)[0];
   assert.deepEqual([a.matches,a.wins,a.scored,a.conceded],[1,1,sa,sb===0?0:-sb]);
 }
 const overall=standings(ed,'overall');
 assert.deepEqual(overall.map(r=>r.id),[1]);
 assert.equal(overall[0].matches,2);
 assert.equal(overall[0].wins,2);
});

test('staff stays in history and event-specific unplayed matching; unchecked returns to rankings',()=>{
 const ed=mk();
 ed.matches.push(m('day1',1,4,1,0));
 assert.deepEqual(ed.matches.map(x=>x.b),[4]);
 assert.ok(unplayedPairs(ed,'day1').some(({a,b})=>a===2&&b===4));
 assert.deepEqual(standings(ed,'day1').map(r=>r.id),[1]);
 ed.players.find(p=>p.id===4).excludeFromRanking=false;
 assert.deepEqual(standings(ed,'day1').map(r=>r.id),[1,4]);
 assert.equal(standings(ed,'day1')[1].rank,2);
});

test('legacy JSON defaults to ranking eligible and boolean setting survives JSON roundtrip',()=>{
 const ed=mk();
 const converted=JSON.parse(JSON.stringify(ed));
 assert.equal(converted.players.find(p=>p.id===4).excludeFromRanking,true);
 converted.players.find(p=>p.id===4).excludeFromRanking=undefined;
 converted.matches.push(m('day1',1,4,1,0));
 assert.deepEqual(standings(converted,'day1').map(r=>r.id),[1,4]);
});

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const pick=(a,b)=>{
 const start=app.indexOf(a),end=app.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,`missing function ${a}`);
 return app.slice(start,end);
};
test('roster checkbox is between reading and Day1, disabled when blank, and footer colspan follows',()=>{
 const ed=mk();
 const mock={ed:()=>ed,eventIds:EVENTS.filter(e=>e.id!=='overall').map(e=>e.id),esc:x=>String(x)};
 const code=pick('function rosterNumbers(e){','function rosterRowState(tr){');
 const render=runInNewContext(`${code}\nrenderPlayers`,mock);
 const html=render();
 assert.match(html,/<th>よみ<\/th><th>順位対象外<\/th><th>初級戦Day1<\/th>/);
 assert.match(html,/<input type="checkbox" data-roster-rank-excluded[^>]*checked/);
 assert.match(html,/<td colspan="10">/);
 assert.match(html, /data-roster-id="5"[^>]*>[\s\S]*?data-roster-rank-excluded[^>]*disabled/);
});

test('checkbox handler persists boolean without altering event registration',()=>{
 const ed=mk(),p=ed.players[0];
 let saves=0;
 const change=runInNewContext(`${pick('function rosterRankExclusionChange(input){','function rosterEventChange(button){')}\nrosterRankExclusionChange`,{player:()=>p,save:()=>saves++});
 const input={checked:true,closest:()=>({dataset:{rosterId:'1'}})};
 change(input);
 assert.equal(p.excludeFromRanking,true);
 assert.equal(saves,1);
 assert.deepEqual(p.entries,['day1','day2','day3','two','cube','school']);
 input.checked=false;change(input);
 assert.equal(p.excludeFromRanking,false);
 assert.equal(saves,2);
 assert.match(app,/else if\(e\.target\.matches\('\[data-roster-rank-excluded\]'\)\)\{rosterRankExclusionChange\(e\.target\)\}/);
});
