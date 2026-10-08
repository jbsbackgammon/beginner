import test from 'node:test';
import assert from 'node:assert/strict';
import {waitingPlayerIds,availableWaitingPlayers,addWaitingPlayer,removeWaitingPlayer,returnPlayersToWaiting,unplayedPairs,reservePairing,finishPairing,cancelPairing} from '../src/ranking.mjs';
const fixture=()=>({players:[1,2,3,4,5].map(id=>({id,name:`選手${id}`,entries:['day1','day2','cube']})),matches:[
 {id:'m12',event:'day1',a:1,b:2,sa:1,sb:0},
 {id:'m34',event:'day1',a:3,b:4,sa:2,sb:0},
 {id:'m13',event:'day2',a:1,b:3,sa:1,sb:0}
]});
test('legacy results still seed waiting list, but manual removal is persistent per event',()=>{
 const e=fixture();
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,3,4]);
 assert.deepEqual(waitingPlayerIds(e,'day2'),[1,3]);
 assert.equal(removeWaitingPlayer(e,'day1',2),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,3,4]);
 assert.deepEqual(e.waitingPlayers.day1,[1,3,4]);
 assert.deepEqual(waitingPlayerIds(e,'day2'),[1,3]);
 assert.ok(unplayedPairs(e,'day1').every(x=>x.a!==2&&x.b!==2));
 assert.equal(removeWaitingPlayer(e,'day1',2),false);
 assert.deepEqual(waitingPlayerIds(JSON.parse(JSON.stringify(e)),'day1'),[1,3,4]);
});
test('only an entered, non-waiting, non-busy player can be added; invalid and duplicate additions fail',()=>{
 const e=fixture();
 assert.equal(addWaitingPlayer(e,'day1',5),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,3,4,5]);
 assert.equal(addWaitingPlayer(e,'day1',5),false);
 assert.equal(addWaitingPlayer(e,'day1',999),false);
 assert.equal(addWaitingPlayer(e,'overall',1),false);
 assert.deepEqual(unplayedPairs(e,'day1').filter(x=>x.a===5||x.b===5).map(x=>[x.a,x.b]),[[1,5],[2,5],[3,5],[4,5]]);
 assert.equal(reservePairing(e,'day1',1,5),true);
 assert.equal(addWaitingPlayer(e,'day1',1),false);
 assert.equal(cancelPairing(e,'day1',1,5),true);
 assert.ok(unplayedPairs(e,'day1').some(x=>x.a===1&&x.b===5));
});
test('completed results restore player availability after manual removal',()=>{
 const e=fixture();
 removeWaitingPlayer(e,'day1',2);
 assert.equal(addWaitingPlayer(e,'day1',5),true);
 assert.equal(reservePairing(e,'day1',3,5),true);
 e.matches.push({id:'new',event:'day1',a:3,b:5,sa:2,sb:0});
 finishPairing(e,'day1',3,5);
 returnPlayersToWaiting(e,'day1',3,5);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,3,4,5]);
 assert.equal(removeWaitingPlayer(e,'day1',3),true);
 e.matches.push({id:'more',event:'day1',a:2,b:4,sa:1,sb:0});
 returnPlayersToWaiting(e,'day1',2,4);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,4,5]);
});
test('first manual addition works for an event with no previous matches',()=>{
 const e={players:[1,2,3].map(id=>({id,name:`選手${id}`,entries:['day1','day2','cube']})),matches:[]};
 assert.deepEqual(unplayedPairs(e,'cube'),[]);
 assert.equal(addWaitingPlayer(e,'cube',1),true);
 assert.equal(addWaitingPlayer(e,'cube',3),true);
 assert.deepEqual(unplayedPairs(e,'cube').map(x=>[x.a,x.b]),[[1,3]]);
});

test('dropdown candidate list respects per-event attendance and current waiting, independent of other events',()=>{
 const e={players:[
  {id:1,name:'参加1',entries:['day1','day2']},
  {id:2,name:'参加2',entries:['day1']},
  {id:3,name:'不参加3',entries:['day2']},
  {id:4,name:'参加4',entries:['day1']},
  {id:5,name:'参加5',entries:['day1']},
  {id:6,name:'未登録6'},
 ],matches:[{id:'m',event:'day1',a:1,b:2,sa:1,sb:0}]};
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[4,5]);
 assert.deepEqual(availableWaitingPlayers(e,'day2').map(p=>p.id),[1,3]);
 assert.deepEqual(availableWaitingPlayers(e,'overall'),[]);
 assert.equal(addWaitingPlayer(e,'day1',3),false);
 assert.equal(addWaitingPlayer(e,'day1',6),false);
 assert.equal(addWaitingPlayer(e,'day1',4),true);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[5]);
 assert.equal(removeWaitingPlayer(e,'day1',4),true);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[4,5]);
});

test('assigned player cannot be manually added even when excluded from explicit waiting state',()=>{
 const e={players:[1,2,3].map(id=>({id,name:'P'+id,entries:['day1']})),matches:[],pendingPairings:[{event:'day1',a:1,b:2}],waitingPlayers:{day1:[3]}};
 assert.deepEqual(availableWaitingPlayers(e,'day1'),[]);
 assert.equal(addWaitingPlayer(e,'day1',1),false);
});
