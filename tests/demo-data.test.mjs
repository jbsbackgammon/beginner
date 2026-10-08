import assert from 'node:assert/strict';
import test from 'node:test';
import {EVENTS, DEMO_EDITION_ID, createDemoEdition, validMatch, isEventEntrant, standings, overallStandings, unplayedPairs, waitingPlayerIds, availableWaitingPlayers} from '../src/ranking.mjs';

const events=EVENTS.filter(e=>e.id!=='overall');
test('50 player records, 200 matches, all six tournaments and overall rankings',()=>{
 const d=createDemoEdition();
 assert.equal(d.id,DEMO_EDITION_ID);
 assert.equal(d.players.length,50);
 assert.equal(d.matches.length,200);
 assert.equal(d.rosterVisibleRows,50);
 assert.equal(new Set(d.players.map(p=>p.id)).size,50);
 for(const event of events){
  const matches=d.matches.filter(m=>m.event===event.id);
  assert.ok(matches.length>=30);
  assert.ok(standings(d,event.id).length>0);
  assert.ok(waitingPlayerIds(d,event.id).length>0);
  assert.ok(unplayedPairs(d,event.id).length>0);
  assert.ok(availableWaitingPlayers(d,event.id).length>0);
  const seenPairs=new Set();
  const seenNos=new Set();
  for(const m of matches){
   assert.equal(validMatch(m,new Set(d.players.map(p=>p.id))),'');
   assert.ok(isEventEntrant(d,event.id,m.a));
   assert.ok(isEventEntrant(d,event.id,m.b));
   assert.ok(!seenNos.has(m.matchNo));seenNos.add(m.matchNo);
   const pair=`${Math.min(m.a,m.b)}-${Math.max(m.a,m.b)}`;
   assert.ok(!seenPairs.has(pair));seenPairs.add(pair);
  }
 }
 assert.ok(overallStandings(d).length>0);
});

test('generates distinct random score patterns and can build multiple editions',()=>{
 const a=createDemoEdition();
 const b=createDemoEdition();
 assert.notDeepEqual(a.matches,b.matches);
 assert.equal(a.matches.length,200);
 assert.equal(b.matches.length,200);
 assert.deepEqual(a.players.map(p=>p.id),b.players.map(p=>p.id));
});
