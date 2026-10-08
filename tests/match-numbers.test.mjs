import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureMatchNumbers,nextMatchNumber} from '../src/ranking.mjs';

const original=()=>({matches:[
 {id:'d1a',event:'day1',a:1,b:2,sa:1,sb:0},
 {id:'d2a',event:'day2',a:1,b:2,sa:2,sb:0},
 {id:'d1b',event:'day1',a:2,b:3,sa:3,sb:0},
 {id:'t1',event:'two',a:1,b:3,sa:1,sb:1},
]});

test('legacy matches are numbered in original order separately for each event',()=>{
 const e=ensureMatchNumbers(original());
 assert.deepEqual(e.matches.map(m=>m.matchNo),[1,1,2,1]);
 assert.equal(e.nextMatchNumbers.day1,3);
 assert.equal(e.nextMatchNumbers.day2,2);
 assert.equal(e.nextMatchNumbers.two,2);
 assert.equal(e.nextMatchNumbers.cube,1);
});
test('new results always receive higher numbers and appear first in a descending history',()=>{
 const e=ensureMatchNumbers(original());
 e.matches.push({id:'d1c',event:'day1',matchNo:nextMatchNumber(e,'day1')});
 e.matches.push({id:'d2b',event:'day2',matchNo:nextMatchNumber(e,'day2')});
 assert.deepEqual(e.matches.filter(m=>m.event==='day1').sort((a,b)=>b.matchNo-a.matchNo).map(m=>m.id),['d1c','d1b','d1a']);
 assert.equal(e.matches.at(-2).matchNo,3);
 assert.equal(e.matches.at(-1).matchNo,2);
});
test('editing preserves the number; deleting cannot cause a number to be reused',()=>{
 const e=ensureMatchNumbers(original());
 const i=e.matches.findIndex(m=>m.id==='d1b');
 e.matches[i]={...e.matches[i],sa:0,sb:1};
 assert.equal(e.matches[i].matchNo,2);
 e.matches.splice(i,1);
 assert.equal(nextMatchNumber(e,'day1'),3);
 assert.equal(nextMatchNumber(e,'day1'),4);
});
test('numbered JSON data retains existing numbers and counters after round-trip',()=>{
 const e=ensureMatchNumbers(original());
 nextMatchNumber(e,'day1'); // Simulate an allocated number which was later deleted.
 const after=ensureMatchNumbers(JSON.parse(JSON.stringify(e)));
 assert.deepEqual(after.matches.map(m=>m.matchNo),[1,1,2,1]);
 assert.equal(nextMatchNumber(after,'day1'),4);
});
test('repeated or invalid imported numbers are repaired without altering valid numbers',()=>{
 const e={matches:[
  {id:'a',event:'cube',matchNo:1},
  {id:'b',event:'cube',matchNo:1},
  {id:'c',event:'cube',matchNo:-1},
  {id:'d',event:'cube',matchNo:9},
 ]};
 ensureMatchNumbers(e);
 assert.deepEqual(e.matches.map(m=>m.matchNo),[1,10,11,9]);
 assert.equal(nextMatchNumber(e,'cube'),12);
});
