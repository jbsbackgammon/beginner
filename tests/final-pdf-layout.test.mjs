import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const get=(start,end)=>{
 const from=src.indexOf(start),to=src.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,`missing helper: ${start}`);
 return src.slice(from,to);
};
const funcs=get('function pdfHeading(eventId, participantCount){','function save()')
  +get('function reportHTML(id){','// A4 portrait: two columns by four rows');
const fakeRows=Array.from({length:28},(_,i)=>({
 rank:i+1,id:i+1,name:`選手${i+1}`,matches:6,wins:4,losses:2,draws:0,
 spread:2,rate:2/3,scored:10,conceded:6,diff:4,selectedDays:['day1','day3']
}));
const render=runInNewContext(`${funcs}\nreportHTML`,{
 ed:()=>({name:'BACKGAMMON CLASSIC 2026',venue:'ワイヤーズホテル品川シーサイド'}),
 eventById:(id)=>({label:id==='overall'?'初級戦総合':'初級戦Day1'}),
 dateFor:(id)=> id==='day3'?'2026-10-12':'2026-10-10',
 venueFor:()=> 'ワイヤーズホテル品川シーサイド',
 pdfEditionTitle:()=> 'BACKGAMMON CLASSIC 2026',
 DEFAULT_EDITION_NAME:'BACKGAMMON FESTIVAL 20XX',
 standingsWithUnranked:()=>fakeRows,
 esc:(s)=>String(s),formatRate:()=> '66.7%',adoptedDayIcons:()=>'<span class="adopted-days">①②③</span>'
});
for(const id of ['day1','overall']){
 test(`${id}: PDF heading includes participant count and omits footer`,()=>{
  const html=render(id);
  assert.match(html,/BACKGAMMON CLASSIC 2026 初級戦/);
  assert.match(html,/2026-10-(10|12)・出場28名・ワイヤーズホテル品川シーサイド・主催 日本バックギャモン協会/);
  assert.doesNotMatch(html,/28名\s*／/);
  assert.doesNotMatch(html,/得失点差→勝越→勝率/);
 });
 test(`${id}: all PDF statistical columns have the same width`,()=>{
  const html=render(id);
  const widths=[...html.matchAll(/<col style="width:([\d.]+)%">/g)].map(v=>Number(v[1]));
  const expected=id==='overall'?11:10;
  assert.equal(widths.length,expected);
  assert.equal(widths[0],7);assert.equal(widths[1],24);
  for(const width of widths.slice(2)) assert.ok(Math.abs(width - 69/(expected-2))<0.00001);
  assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-100)<0.00001);
 });
}

test('2pt final-results PDF prints 引分 rather than 引 in the column header',()=>{
 const html=render('two');
 assert.match(html,/<th>引分<\/th>/);
 assert.doesNotMatch(html,/<th>引<\/th>/);
 assert.match(html,/data-label="引分"/);
});
