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


test('3 does not match players #13 or #30 but matches #3 on either side',()=>{
 const p=[{id:3,name:'三村',kana:'みむら'}, {id:13,name:'十三',kana:'じゅうさん'}, {id:30,name:'三十',kana:'さんじゅう'}];
 const other={a:13,b:30,sa:3,sb:0,matchNo:3};
 assert.equal(historySearchMatches(other,'3',p),false);
 assert.equal(historySearchMatches(other,'#3',p),false);
 assert.equal(historySearchMatches(other,'３',p),false);
 assert.equal(historySearchMatches(other,'13',p),true);
 assert.equal(historySearchMatches(other,'30',p),true);
 assert.equal(historySearchMatches({a:3,b:13,sa:0,sb:3},'3',p),true);
 assert.equal(historySearchMatches({a:30,b:3,sa:0,sb:3},'#3',p),true);
});
