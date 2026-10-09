import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EVENTS,standings,standingsWithUnranked,createDemoEdition} from '../src/ranking.mjs';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start=source.indexOf('function personalMatchSequence(eventId,row){');
const end=source.indexOf('function renderExport(){',start);
assert.ok(start>0&&end>start);
const demo=createDemoEdition(()=>0.417);
const helpers={
  ed:()=>demo,
  standings,
  standingsWithUnranked,
  EVENTS,
  player:id=>demo.players.find(p=>p.id===id),
  eventById:id=>EVENTS.find(e=>e.id===id),
  dateFor:id=>EVENTS.find(e=>e.id===id)?.date||'',
  venueFor:()=> 'ワイヤーズホテル品川シーサイド',
  pdfEditionTitle:()=> 'BACKGAMMON CLASSIC 2026',
  esc:s=>String(s??''),
  formatRate:n=>`${(n*100).toFixed(1)}%`
};
const {personalReportHTML}=runInNewContext(
  `${source.slice(start,end)}\n({personalReportHTML})`,helpers
);

for(const id of ['overall','day1','day2','day3','two','cube','elementary']){
 test(`personal PDF ${id} uses a plus sign only for positive win spread`,()=>{
  const rows=standings(demo,id).slice().sort((a,b)=>a.id-b.id);
  const html=personalReportHTML(id);
  const entries=[...html.matchAll(/<div class="personal-summary">([^<]+)<\/div>/g)];
  assert.equal(entries.length,rows.length);
  for(let i=0;i<rows.length;i++){
   const {spread}=rows[i];
   const formatted=spread>0?`+${spread}`:String(spread);
   assert.ok(entries[i][1].includes(`勝越${formatted}　勝率`));
  }
  if(id==='day1'||id==='overall'){
   assert.ok(rows.some(r=>r.spread>0));
   assert.ok(rows.some(r=>r.spread<0));
   assert.ok(rows.some(r=>r.spread===0));
  }
 });
}
