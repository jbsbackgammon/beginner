import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {standings, compareStats} from '../src/ranking.mjs';

const players=[1,2,3,4].map(id=>({id,name:`選手${id}`,entries:['two']}));
const edition={players,matches:[
  {id:'one',event:'two',a:1,b:2,sa:2,sb:0},
  {id:'two',event:'two',a:1,b:3,sa:1,sb:1},
  {id:'three',event:'two',a:1,b:4,sa:1,sb:2},
]};
const rows=standings(edition,'two');
const row=id=>rows.find(r=>r.id===id);

test('2pt RR accumulates points from wins, losses and draws using negative conceded totals',()=>{
  assert.deepEqual([row(1).scored,row(1).conceded,row(1).diff],[4,-3,1]);
  assert.deepEqual([row(2).scored,row(2).conceded,row(2).diff],[0,-2,-2]);
  assert.deepEqual([row(3).scored,row(3).conceded,row(3).diff],[1,-1,0]);
  assert.deepEqual([row(4).scored,row(4).conceded,row(4).diff],[2,-1,1]);
});

test('2pt RR keeps ranking independent of scored, conceded and point difference',()=>{
  const a={spread:1,rate:0.75,matches:5,diff:-20,scored:0,conceded:-20};
  const b={spread:1,rate:0.75,matches:5,diff:20,scored:20,conceded:0};
  assert.equal(compareStats(a,b,'two'),0);
  assert.equal(row(1).matches,3);
  assert.equal(row(1).wins,1);
  assert.equal(row(1).losses,1);
  assert.equal(row(1).draws,1);
  assert.equal(row(1).rate,0.5);
});

const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const pick=(a,b)=>{
  const start=src.indexOf(a),end=src.indexOf(b,start+a.length);
  assert.ok(start>=0 && end>start);
  return src.slice(start,end);
};
const context={ed:()=>edition,standings,eventById:()=>({label:'2ptマッチラウンドロビン'}),dateFor:()=>'',esc:x=>String(x),formatRate:x=>`${(x*100).toFixed(1)}%`,pdfHeading:()=>'<h2>最終成績</h2>'};
const stats=runInNewContext(`${pick('function statsTable(eventId,preview=false){','function rosterNumbers')}\nstatsTable`,context);
const report=runInNewContext(`${pick('function reportHTML(id){','// A4 portrait: two columns by four rows')}\nreportHTML`,context);
const csv=runInNewContext(`${pick('function asCSV(id){','function download(')}\nasCSV`,context);

test('2pt screen and final-results PDF show all three columns without ranking-order markers',()=>{
  for(const render of [stats,report]){
    const html=render('two');
    for(const heading of ['得点','失点','得失点差']) assert.match(html,new RegExp(`<th>${heading}</th>`));
    assert.doesNotMatch(html,/<small class="rank-header-order">[^<]*<\/small>[^<]*得失点差/);
    assert.doesNotMatch(html,/rank-header-label">得失点差/);
    assert.match(html,/data-label="得点"[^>]*>4<\/td>/);
    assert.match(html,/data-label="失点"[^>]*>-3<\/td>/);
    assert.match(html,/data-label="得失点差"[^>]*>\+1<\/td>/);
  }
});

test('2pt CSV includes three point columns and their actual values',()=>{
  const text=csv('two');
  assert.match(text,/"得点","失点","得失点差"/);
  assert.match(text,/"4","-3","1"/);
});