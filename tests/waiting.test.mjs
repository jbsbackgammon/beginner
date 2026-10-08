import test from 'node:test';
import assert from 'node:assert/strict';
import {waitingPlayerIds,addWaitingPlayer,removeWaitingPlayer,returnPlayersToWaiting,unplayedPairs,reservePairing,finishPairing,cancelPairing} from '../src/ranking.mjs';
const fixture=()=>({players:[1,2,3,4,5].map(id=>({id,name:`選手${id}`})),matches:[
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
test('any existing player can be added; invalid/busy/duplicate additions fail',()=>{
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
 const e={players:[1,2,3].map(id=>({id,name:`選手${id}`})),matches:[]};
 assert.deepEqual(unplayedPairs(e,'cube'),[]);
 assert.equal(addWaitingPlayer(e,'cube',1),true);
 assert.equal(addWaitingPlayer(e,'cube',3),true);
 assert.deepEqual(unplayedPairs(e,'cube').map(x=>[x.a,x.b]),[[1,3]]);
});
