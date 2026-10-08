import test from 'node:test';
import assert from 'node:assert/strict';
import {waitingPlayerIds,availableWaitingPlayers,addWaitingPlayer,removeWaitingPlayer,returnPlayersToWaiting,unplayedPairs,arrangeWaitingPair,migrateReservedWaiting} from '../src/ranking.mjs';
const fixture=()=>({players:[1,2,3,4,5].map(id=>({id,name:`選手${id}`,entries:['day1','day2','cube']})),matches:[
 {id:'m12',event:'day1',a:1,b:2,sa:1,sb:0},
 {id:'m34',event:'day1',a:3,b:4,sa:2,sb:0},
 {id:'m13',event:'day2',a:1,b:3,sa:1,sb:0}
]});
test('saved waiting list supports independent manual removal',()=>{
 const e=fixture();
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,3,4]);
 removeWaitingPlayer(e,'day1',2);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,3,4]);
 assert.ok(unplayedPairs(e,'day1').every(x=>x.a!==2&&x.b!==2));
 assert.deepEqual(waitingPlayerIds(JSON.parse(JSON.stringify(e)),'day1'),[1,3,4]);
});
test('arrangement removes both participants, but they may return individually',()=>{
 const e=fixture();
 assert.equal(addWaitingPlayer(e,'day1',5),true);
 assert.equal(arrangeWaitingPair(e,'day1',1,5),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[2,3,4]);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[1,5]);
 assert.equal(addWaitingPlayer(e,'day1',1),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,3,4]);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[5]);
 assert.equal(addWaitingPlayer(e,'day1',5),true);
 assert.ok(unplayedPairs(e,'day1').some(x=>x.a===1&&x.b===5));
 assert.equal('pendingPairings' in e,false);
});
test('completed results restore players to waiting even after arrangement',()=>{
 const e=fixture();addWaitingPlayer(e,'day1',5);
 arrangeWaitingPair(e,'day1',3,5);
 e.matches.push({id:'new',event:'day1',a:3,b:5,sa:2,sb:0});
 returnPlayersToWaiting(e,'day1',3,5);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,2,3,4,5]);
});
test('manual addition possible even without earlier results',()=>{
 const e={players:[1,2,3].map(id=>({id,name:`選手${id}`,entries:['cube']})),matches:[]};
 assert.equal(addWaitingPlayer(e,'cube',1),true);
 assert.equal(addWaitingPlayer(e,'cube',3),true);
 assert.deepEqual(unplayedPairs(e,'cube').map(x=>[x.a,x.b]),[[1,3]]);
});
test('add picker is limited to registered entrants missing from waiting',()=>{
 const e={players:[{id:1,name:'A',entries:['day1']},{id:2,name:'B',entries:['day1']},{id:3,name:'C',entries:['day2']}],matches:[]};
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[1,2]);
 assert.equal(addWaitingPlayer(e,'day1',3),false);
 assert.equal(addWaitingPlayer(e,'day1',1),true);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[2]);
});
test('legacy pending reservations are removed from explicit waiting only for unmigrated records',()=>{
 const e={players:[1,2,3].map(id=>({id,name:'P'+id,entries:['day1']})),matches:[],pendingPairings:[{event:'day1',a:1,b:2}],waitingPlayers:{day1:[1,2,3]}};
 migrateReservedWaiting(e);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[3]);
 assert.equal('pendingPairings' in e,false);
 assert.equal(addWaitingPlayer(e,'day1',1),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,3]);
 migrateReservedWaiting(e);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[1,3]);
});
test('legacy v47 already-migrated waiting state remains untouched when pending is stripped',()=>{
 const e={players:[1,2,3].map(id=>({id,name:'P'+id,entries:['day1']})),matches:[],pendingPairings:[{event:'day1',a:1,b:2}],waitingPlayers:{day1:[3]},reservationWaitingVersion:1};
 migrateReservedWaiting(e);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[3]);
 assert.equal('pendingPairings' in e,false);
 assert.equal('reservationWaitingVersion' in e,false);
 assert.equal(addWaitingPlayer(e,'day1',1),true);
});
test('old pending without an explicit waiting list keeps the unrelated players',()=>{
 const e=fixture();e.pendingPairings=[{event:'day1',a:1,b:3}];
 migrateReservedWaiting(e);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[2,4]);
 assert.deepEqual(availableWaitingPlayers(e,'day1').map(p=>p.id),[1,3,5]);
 assert.equal(arrangeWaitingPair(e,'day1',2,4),true);
 assert.deepEqual(waitingPlayerIds(e,'day1'),[]);
});
