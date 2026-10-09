import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createDemoEdition, standings, standingsWithUnranked, EVENTS} from '../src/ranking.mjs';

const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const demo=createDemoEdition(()=>0.417);
const start=src.indexOf('function personalMatchSequence(eventId,row){');
const end=src.indexOf('function renderExport(){',start);
assert.ok(start>=0 && end>start);
const functions=runInNewContext(`${src.slice(start,end)}\n({overallPersonalDayDetails,personalReportHTML})`,{
 ed:()=>demo,
 player:id=>demo.players.find(p=>p.id===id),
 standings,standingsWithUnranked,EVENTS,
 eventById:id=>EVENTS.find(e=>e.id===id),
 dateFor:id=>EVENTS.find(e=>e.id===id)?.date||'',
 venueFor:()=> 'ワイヤーズホテル品川シーサイド',
 pdfEditionTitle:()=> 'BACKGAMMON CLASSIC 2026',
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 formatRate:n=>`${(n*100).toFixed(1)}%`
});

test('3 lines include all three event-local ranking criteria and the adopted Day label',()=>{
 const player=demo.players[0];
 player.entries=['day1','day3'];
 const stats={
  day1:new Map([[player.id,{diff:10,spread:7,rate:0.652}]]),
  day2:new Map(),
  day3:new Map([[player.id,{diff:9,spread:2,rate:0.502}]])
 };
 const html=functions.overallPersonalDayDetails({id:player.id,selectedDays:['day1','day3']},stats);
 assert.equal((html.match(/class="personal-overall-day"/g)||[]).length,3);
 assert.match(html,/Day1：得失点差\+10　勝越\+7　勝率65\.2%　採用/);
 assert.match(html,/Day2：不出場/);
 assert.match(html,/Day3：得失点差\+9　勝越\+2　勝率50\.2%　採用/);
});

test('a played but non-adopted Day is shown with stats but no non-adoption marker',()=>{
 const player=demo.players[0];
 player.entries=['day1','day2','day3'];
 const stats={
  day1:new Map([[player.id,{diff:-3,spread:-2,rate:0.25}]]),
  day2:new Map([[player.id,{diff:0,spread:0,rate:0.5}]]),
  day3:new Map([[player.id,{diff:2,spread:1,rate:0.75}]])
 };
 const html=functions.overallPersonalDayDetails({id:player.id,selectedDays:['day1','day3']},stats);
 assert.match(html,/Day1：得失点差-3　勝越-2　勝率25\.0%　採用/);
 assert.match(html,/Day2：得失点差0　勝越0　勝率50\.0%<\/div>/);
 assert.doesNotMatch(html,/不採用/);
 assert.match(html,/Day3：得失点差\+2　勝越\+1　勝率75\.0%　採用/);
});

test('overall card contains three Day rows before venue and organizer; other events never gain rows',()=>{
 const html=functions.personalReportHTML('overall');
 const n=standings(demo,'overall').length;
 assert.equal((html.match(/class="personal-overall-days"/g)||[]).length,n);
 assert.equal((html.match(/class="personal-overall-day"/g)||[]).length,n*3);
 assert.match(html,/class="personal-overall-days"[\s\S]*?Day1：[\s\S]*?Day2：[\s\S]*?Day3：[\s\S]*?class="personal-footer"/);
 assert.match(html,/2026-10-12　ワイヤーズホテル品川シーサイド/);
 assert.doesNotMatch(html,/class="personal-dot/);
 const one=functions.personalReportHTML('day1');
 assert.doesNotMatch(one,/personal-overall-day/);
 assert.match(one,/class="personal-dot/);
});

test('overall Day list is black and centered as a block, keeping each row left-aligned',()=>{
 const styles=css.slice(css.indexOf('/* v66: Three per-Day'));
 assert.match(styles,/@media print/);
 assert.match(styles,/\.personal-overall-days/);
 assert.match(styles,/margin:auto 0!important/);
 assert.match(styles,/align-self:center!important/);
 assert.match(styles,/align-items:flex-start!important/);
 assert.match(styles,/width:max-content!important/);
 assert.match(styles,/text-align:left!important/);
 assert.match(styles,/color:#000!important/);
 assert.match(styles,/white-space:nowrap!important/);
 assert.doesNotMatch(styles,/#16804e/);
});
