import assert from 'node:assert/strict';
import test from 'node:test';
import {EVENTS, DEMO_EDITION_ID, createDemoEdition, validMatch, isEventEntrant, standings, overallStandings, unplayedPairs, waitingPlayerIds, availableWaitingPlayers} from '../src/ranking.mjs';

const events=EVENTS.filter(e=>e.id!=='overall');
test('30 player records, exactly 300 matches per tournament and 1,800 total',()=>{
 const d=createDemoEdition();
 assert.equal(d.id,DEMO_EDITION_ID);
 assert.equal(d.players.length,30);
 assert.equal(d.matches.length,1800);
 assert.equal(d.rosterVisibleRows,30);
 assert.equal(new Set(d.players.map(p=>p.id)).size,30);
 for(const event of events){
  const matches=d.matches.filter(m=>m.event===event.id);
  assert.equal(matches.length,300);
  assert.equal(new Set(d.players.filter(p=>p.entries.includes(event.id)).map(p=>p.id)).size,30);
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
 assert.equal(a.matches.length,1800);
 assert.equal(b.matches.length,1800);
 assert.deepEqual(a.players.map(p=>p.id),b.players.map(p=>p.id));
});


test('creates thirty distinct Japanese test names with matching readings, randomized each time',()=>{
 const d=createDemoEdition();
 assert.equal(new Set(d.players.map(p=>p.name)).size,30);
 for(const p of d.players){
  assert.match(p.name,/^[^\s]+ [^\s]+$/);
  assert.match(p.kana,/^[ぁ-ゖー]+ [ぁ-ゖー]+$/u);
  assert.ok(!p.name.startsWith('テスト選手'));
 }
 // Injected random values make the contrast deterministic, not probabilistic.
 const first=createDemoEdition(()=>0);
 const second=createDemoEdition(()=>0.999999);
 assert.notDeepEqual(first.players.map(p=>p.name),second.players.map(p=>p.name));
 assert.equal(first.matches.length,1800);
 assert.equal(second.matches.length,1800);
});
