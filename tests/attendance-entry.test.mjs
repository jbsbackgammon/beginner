import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isEventEntrant,eligibleEventPlayers} from '../src/ranking.mjs';

const edition={players:[
  {id:1,name:'あ',entries:['day1','school']},
  {id:2,name:'い',entries:['day2']},
  {id:3,name:'う',entries:['day1']},
  {id:4,name:'え',entries:[]},
  {id:5,name:'お'},
  {id:6,name:'',entries:['day1']},
]};

test('results use only the per-event attendance recorded in player management',()=>{
 assert.deepEqual(eligibleEventPlayers(edition,'day1').map(p=>p.id),[1,3]);
 assert.deepEqual(eligibleEventPlayers(edition,'day2').map(p=>p.id),[2]);
 assert.deepEqual(eligibleEventPlayers(edition,'school').map(p=>p.id),[1]);
 assert.deepEqual(eligibleEventPlayers(edition,'overall'),[]);
 assert.equal(isEventEntrant(edition,'day1',2),false);
 assert.equal(isEventEntrant(edition,'day2',2),true);
 assert.equal(isEventEntrant(edition,'day1',6),false);
 assert.equal(isEventEntrant(edition,'day1',99),false);
});

test('adding attendance updates allowed entrants without affecting other events',()=>{
 edition.players[1].entries.push('day1');
 assert.deepEqual(eligibleEventPlayers(edition,'day1').map(p=>p.id),[1,2,3]);
 edition.players[1].entries=['day2'];
 assert.equal(isEventEntrant(edition,'day1',2),false);
});

test('result registration rechecks both players instead of trusting numeric inputs',()=>{
 const code=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(code,/if\(!isEventEntrant\(ed\(\),activeEvent,a\)\|\|!isEventEntrant\(ed\(\),activeEvent,b\)\)/);
 assert.match(code,/出場登録されている選手だけが結果登録できます/);
 assert.match(code,/isEventEntrant\(ed\(\),activeEvent,parsed\)/);
});
