import test from 'node:test';import assert from 'node:assert/strict';
import {validMatch,standings,allowedCubePoints} from '../src/ranking.mjs';
const ps=[1,2,3].map(id=>({id,name:'選手'+id,entries:[]}));
const fixture=matches=>({players:ps,matches:matches.map((m,i)=>({id:`m${i}`, ...m}))});
test('initial single / gammon scores and rankings',()=>{const e=fixture([{event:'day1',a:1,b:2,sa:2,sb:0},{event:'day1',a:2,b:3,sa:1,sb:0}]);const r=standings(e,'day1');assert.deepEqual(r.map(x=>x.id),[1,2,3]);assert.equal(r[0].diff,2);assert.equal(r[1].diff,-1);});
test('2pt draw counts as a match, not W/L; uses decisive win percentage',()=>{const e=fixture([{event:'two',a:1,b:2,sa:1,sb:1},{event:'two',a:1,b:3,sa:2,sb:0}]);let r=standings(e,'two');assert.equal(r[0].id,1);assert.equal(r[0].draws,1);assert.equal(r[0].rate,1);assert.equal(r[0].matches,2);});
test('overall requires Day3 and another playing day',()=>{const e=fixture([{event:'day1',a:1,b:2,sa:2,sb:0},{event:'day2',a:1,b:2,sa:1,sb:0},{event:'day3',a:1,b:3,sa:0,sb:1}]);let r=standings(e,'overall');assert.deepEqual(r.map(x=>x.id),[1]);assert.deepEqual(r[0].selectedDays,['day1','day2']);assert.equal(r[0].diff,3);});
test('overall Day3-only is not eligible',()=>{const e=fixture([{event:'day3',a:1,b:2,sa:3,sb:0}]);assert.equal(standings(e,'overall').length,0);});
test('score validation',()=>{const p=new Set([1,2]);assert.equal(validMatch({event:'cube',a:1,b:2,sa:12,sb:0},p),'');assert.ok(validMatch({event:'cube',a:1,b:2,sa:5,sb:0},p));assert.equal(validMatch({event:'two',a:1,b:2,sa:1,sb:2},p),'');assert.ok(validMatch({event:'day1',a:1,b:2,sa:4,sb:0},p));});
test('same official rank for exact ties',()=>{const e=fixture([{event:'day1',a:1,b:3,sa:1,sb:0},{event:'day1',a:2,b:3,sa:1,sb:0}]);let r=standings(e,'day1');assert.equal(r[0].rank,1);assert.equal(r[1].rank,1);assert.equal(r[2].rank,3);});


import {unplayedPairs,EVENTS} from '../src/ranking.mjs';
test('event order begins with overall and matchups only include active participants who have not met', () => {
  assert.deepEqual(EVENTS.map(x=>x.id), ['overall','day1','day2','day3','two','cube']);
  const edition={players:[1,2,3,4].map(id=>({id,name:'P'+id})),matches:[
    {id:'m1',event:'day1',a:1,b:2,sa:1,sb:0},
    {id:'m2',event:'day1',a:2,b:3,sa:2,sb:0},
    {id:'m3',event:'day2',a:1,b:3,sa:0,sb:1},
  ]};
  assert.deepEqual(unplayedPairs(edition,'day1').map(x=>[x.a,x.b]), [[1,3]]);
  assert.deepEqual(unplayedPairs(edition,'overall'), []);
  assert.deepEqual(unplayedPairs(edition,'day2'), []);
});
test('repeat results do not create duplicate matchmaking candidates', () => {
  const edition={players:[1,2,3].map(id=>({id,name:String(id)})),matches:[
    {event:'two',a:1,b:2},{event:'two',a:1,b:2},{event:'two',a:2,b:3},
  ]};
  assert.deepEqual(unplayedPairs(edition,'two').map(x=>[x.a,x.b]),[[1,3]]);
});

import {activePairings,reservePairing,cancelPairing,finishPairing,returnPlayersToWaiting} from '../src/ranking.mjs';
const matchupFixture=()=>({players:[1,2,3,4].map(id=>({id,name:`選手${id}`})),matches:[
 {id:'d1',event:'day1',a:1,b:2,sa:1,sb:0},
 {id:'d2',event:'day1',a:2,b:3,sa:1,sb:0},
 {id:'d3',event:'day1',a:3,b:4,sa:1,sb:0},
 {id:'d4',event:'day2',a:1,b:4,sa:1,sb:0},
]});
test('booking a pair removes both players from all day1 suggestions, not just that pair',()=>{
 const ed=matchupFixture();
 assert.deepEqual(unplayedPairs(ed,'day1').map(({a,b})=>[a,b]),[[1,4],[1,3],[2,4]]);
 assert.equal(reservePairing(ed,'day1',3,1),true);
 assert.deepEqual(activePairings(ed,'day1'),[{event:'day1',a:1,b:3}]);
 assert.deepEqual(unplayedPairs(ed,'day1').map(({a,b})=>[a,b]),[[2,4]]);
 assert.equal(reservePairing(ed,'day1',1,4),false);
 assert.equal(reservePairing(ed,'day1',1,3),false);
 assert.equal(reservePairing(ed,'day1',2,4),true);
 assert.equal(unplayedPairs(ed,'day1').length,0);
 assert.deepEqual(unplayedPairs(ed,'day2'),[]);
});
test('cancel restores both participants to the eligible list; double cancellation is harmless',()=>{
 const ed=matchupFixture();
 reservePairing(ed,'day1',1,3);
 assert.equal(cancelPairing(ed,'day1',3,1),true);
 assert.equal(cancelPairing(ed,'day1',3,1),false);
 assert.deepEqual(unplayedPairs(ed,'day1').map(({a,b})=>[a,b]),[[1,4],[1,3],[2,4]]);
});
test('saving a completed match releases its players without changing unrelated reservations',()=>{
 const ed=matchupFixture();
 reservePairing(ed,'day1',1,3);reservePairing(ed,'day1',2,4);
 ed.matches.push({id:'new',event:'day1',a:1,b:3,sa:3,sb:0});
 finishPairing(ed,'day1',1,3);
 returnPlayersToWaiting(ed,'day1',1,3);
 assert.deepEqual(activePairings(ed,'day1'),[{event:'day1',a:2,b:4}]);
 assert.deepEqual(unplayedPairs(ed,'day1'),[]);
 assert.equal(ed.matches.length,5);
 finishPairing(ed,'day1',2,4);
 returnPlayersToWaiting(ed,'day1',2,4);
 assert.deepEqual(unplayedPairs(ed,'day1').map(({a,b})=>[a,b]),[[1,4],[2,4]]);
});
test('legacy data with no pending list remains valid and can be booked',()=>{
 const ed=matchupFixture();delete ed.pendingPairings;
 assert.deepEqual(activePairings(ed,'day1'),[]);
 assert.equal(reservePairing(ed,'day1',1,3),true);
 assert.equal(ed.pendingPairings.length,1);
});
