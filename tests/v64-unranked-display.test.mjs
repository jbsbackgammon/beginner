import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {standings,standingsWithUnranked,EVENTS} from '../src/ranking.mjs';

const players=[
 {id:1,name:'正規A',entries:['day1','day2','day3','two']},
 {id:2,name:'正規B',entries:['day1','day2','day3','two']},
 {id:3,name:'スタッフA',excludeFromRanking:true,entries:['day1','day2','day3','two']},
 {id:4,name:'スタッフB',excludeFromRanking:true,entries:['day1','day2','day3','two']},
 {id:5,name:'スタッフC',excludeFromRanking:true,entries:['day1','day2','day3','two']},
];
const m=(event,a,b,sa,sb)=>({id:`${event}:${a}-${b}`,event,a,b,sa,sb});
const edition={players,matches:[
 m('day1',1,2,2,0),m('day1',1,3,3,0),m('day1',4,2,3,0),m('day1',5,1,1,0),
 m('day2',3,1,1,0),m('day3',4,1,1,0),m('day3',5,2,3,0),
 m('two',1,2,2,0),m('two',4,1,2,0),m('two',5,2,1,1),m('two',3,1,0,2),
]};

test('all ranked players keep official placements; unranked players follow in comparison order',()=>{
 const official=standings(edition,'day1');
 assert.deepEqual(official.map(r=>[r.id,r.rank]),[[1,1],[2,2]]);
 const all=standingsWithUnranked(edition,'day1');
 assert.deepEqual(all.map(r=>r.id),[1,2,4,5,3]);
 assert.deepEqual(all.map(r=>r.rank),[1,2,'-','-','-']);
 assert.ok(all.slice(0,2).every(r=>!r.isUnranked));
 assert.ok(all.slice(2).every(r=>r.isUnranked===true));
 assert.deepEqual([all[0].matches,all[0].wins,all[0].losses,all[0].diff],[3,2,1,4]);
 assert.equal(all.find(r=>r.id===4).diff,3);
});

test('2pt RR uses win margin / win rate / match count for the unranked ordering',()=>{
 const official=standings(edition,'two');
 const all=standingsWithUnranked(edition,'two');
 assert.deepEqual(all.slice(0,official.length).map(r=>r.id),official.map(r=>r.id));
 assert.deepEqual(all.slice(official.length).map(r=>r.id),[4,5,3]);
 assert.ok(all.slice(official.length).every(r=>r.rank==='-'));
 assert.equal(all.find(r=>r.id===5).draws,1);
});

test('all event types can show unranked players without affecting official standings',()=>{
 for(const e of EVENTS.filter(e=>e.id!=='overall')){
  const official=standings(edition,e.id);
  const full=standingsWithUnranked(edition,e.id);
  assert.deepEqual(full.slice(0,official.length).map(r=>[r.id,r.rank]),official.map(r=>[r.id,r.rank]));
  assert.ok(full.slice(official.length).every(r=>r.rank==='-'));
 }
});

test('overall includes eligible unranked staff, with day3 and another day required',()=>{
 const official=standings(edition,'overall');
 const all=standingsWithUnranked(edition,'overall');
 assert.deepEqual(all.slice(0,official.length).map(r=>r.id),official.map(r=>r.id));
 assert.deepEqual(all.slice(official.length).map(r=>r.id),[4,5]);
 assert.equal(all.find(r=>r.id===3),undefined,'no Day3 participation means no overall result');
 assert.deepEqual(all.find(r=>r.id===4).selectedDays,['day1','day3']);
 assert.ok(all.slice(official.length).every(r=>r.rank==='-' && r.isUnranked));
});

test('unchecking exclusion instantly restores usual rank numbering; prior rank is unaffected',()=>{
 const before=standingsWithUnranked(edition,'day1');
 assert.equal(before.find(r=>r.id===4).rank,'-');
 const changed=structuredClone(edition);
 changed.players.find(p=>p.id===4).excludeFromRanking=false;
 const after=standingsWithUnranked(changed,'day1');
 assert.ok(after.find(r=>r.id===4).rank!== '-');
 assert.equal(after.at(-1).isUnranked,true);
 assert.deepEqual(standings(changed,'day1').map(r=>r.id),after.filter(r=>!r.isUnranked).map(r=>r.id));
});

const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const pick=(start,end)=>{
 const i=src.indexOf(start),j=src.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,`${start} not found`);
 return src.slice(i,j);
};
const ctx={ed:()=>edition,standings,standingsWithUnranked,esc:x=>String(x),formatRate:x=>`${(x*100).toFixed(1)}%`,adoptedDayIcons:()=>'<span>①③</span>',eventById:id=>({label:id}),dateFor:()=>'',pdfHeading:()=>'<h2>成績表</h2>'};
const renderTable=runInNewContext(pick('function statsTable(eventId,preview=false){','function rosterNumbers')+'\nstatsTable',ctx);
const renderPdf=runInNewContext(pick('function reportHTML(id){','// A4 portrait: two columns by four rows')+'\nreportHTML',ctx);

test('ranking screen and final PDF show numbered ranks then grey-styled dash rows',()=>{
 for(const render of [renderTable,renderPdf]){
  const html=render('day1');
  assert.match(html,/<tr class="is-unranked">/);
  assert.equal((html.match(/<tr class="is-unranked">/g)||[]).length,3);
  assert.ok(html.indexOf('正規B #2')<html.indexOf('スタッフB #4'));
  assert.ok(html.indexOf('スタッフB #4')<html.indexOf('スタッフC #5'));
  assert.match(html,/data-label="順位"[^>]*>(?:<strong>)?-(?:<\/strong>)?<\/td>/);
 }
 assert.match(css,/#app \.standings-table tbody tr\.is-unranked > td/);
 assert.match(css,/#print-area \.report-data-table tbody tr\.is-unranked > td/);
 assert.match(css,/print-color-adjust:exact/);
});

test('roster column and checkbox labels say 順位外',()=>{
 assert.match(src,/<th>順位外<\/th>/);
 assert.match(src,/data-label="順位外"/);
 assert.doesNotMatch(src,/順位対象外/);
});
