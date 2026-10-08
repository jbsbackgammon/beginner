import test from 'node:test';
import assert from 'node:assert/strict';
import {historySearchMatches} from '../src/ranking.mjs';

const players=[
 {id:2,name:'あいう',kana:'あいう'},
 {id:10,name:'かきく',kana:'カキク'},
 {id:3,name:'さしす',kana:'さしす'},
];
const match={a:2,b:10,sa:1,sb:0,matchNo:17};

test('result scores and match numbers are never searched',()=>{
 assert.equal(historySearchMatches(match,'1',players),false); // score 1-0 is not a hit
 assert.equal(historySearchMatches(match,'1-0',players),false);
 assert.equal(historySearchMatches(match,'17',players),false);
 assert.equal(historySearchMatches(match,'0',players),false);
});
test('player number search matches full IDs, not substrings',()=>{
 assert.equal(historySearchMatches(match,'2',players),true);
 assert.equal(historySearchMatches(match,'#10',players),true);
 assert.equal(historySearchMatches(match,'10',players),true);
 assert.equal(historySearchMatches(match,'1',players),false); // #10 is not #1
 assert.equal(historySearchMatches(match,'3',players),false);
});
test('names, readings, mixed number and name can be searched',()=>{
 assert.equal(historySearchMatches(match,'あい',players),true);
 assert.equal(historySearchMatches(match,'カキ',players),true);
 assert.equal(historySearchMatches(match,'#2 あいう',players),true);
 assert.equal(historySearchMatches(match,'さし',players),false);
 assert.equal(historySearchMatches(match,'',players),true);
});
